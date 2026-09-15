"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveGroupId } from "@/lib/groups";
import { bankAmount, BankError } from "@/lib/bank";
import { runBankCommand, startBankGame, type BankCommand } from "@/lib/bank-service";
import { parseDateInput, toDateInput } from "@/lib/dates";

const text = (fd: FormData, key: string) => typeof fd.get(key) === "string" ? String(fd.get(key)).trim() : "";
function errorMessage(error: unknown) {
  if (error instanceof BankError) return error.message;
  if (error && typeof error === "object" && "code" in error && ["P2002", "P2034", "P2028"].includes(String(error.code))) return "Another action changed this game. Refresh and try again.";
  console.error("Game bank action failed", error);
  return "The action could not be saved. Your balances were not changed. Try again.";
}

export async function startGame(_prev: unknown, fd: FormData) {
  const groupId = await getActiveGroupId();
  let gameId: string;
  try {
    if (text(fd, "groupId") !== groupId) throw new BankError("The selected group changed. Reload before starting the game.");
    const name = text(fd, "name");
    if (!name || name.length > 120) throw new BankError("Give the game a name of up to 120 characters.");
    const rawDate = text(fd, "date");
    const date = parseDateInput(rawDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate) || toDateInput(date) !== rawDate) throw new BankError("Choose a valid game date.");
    const requestId = text(fd, "requestId");
    if (!/^[\da-f-]{36}$/i.test(requestId)) throw new BankError("Reload the game setup and try again.");
    let raw: unknown;
    try { raw = JSON.parse(text(fd, "seats")); } catch { throw new BankError("Choose your players again."); }
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) throw new BankError("Choose between 1 and 50 players.");
    const seats = raw.map((seat: unknown) => {
      if (!seat || typeof seat !== "object" || !("amount" in seat)) throw new BankError("A selected player is missing their buy-in.");
      return { playerId: "playerId" in seat && typeof seat.playerId === "string" ? seat.playerId : undefined,
        name: "name" in seat && typeof seat.name === "string" ? seat.name : undefined,
        amount: bankAmount(seat.amount), paid: "paid" in seat && seat.paid === true };
    });
    gameId = await startBankGame(prisma, groupId, {
      name, date, requestId, seats, defaultBuyIn: bankAmount(text(fd, "defaultBuyIn")),
      chipBankSize: text(fd, "chipBankSize") ? bankAmount(text(fd, "chipBankSize")) : null,
      openingCash: bankAmount(text(fd, "openingCash") || "0", true),
    });
  } catch (error) { return { error: errorMessage(error) }; }
  revalidatePath("/", "layout");
  redirect(`/games/${gameId}`);
}

const ACTIONS = ["BUY_IN", "CASH_OUT", "RECYCLE", "CLEAR", "SETTLE", "UNDO", "CHIPS", "CLOSE", "REOPEN", "SEAT", "ENABLE"] as const;

export async function bankAction(_prev: unknown, fd: FormData) {
  const groupId = await getActiveGroupId();
  try {
    if (text(fd, "groupId") !== groupId) throw new BankError("The selected group changed. Reload this game before recording money.");
    const action = text(fd, "bankAction") as BankCommand["action"];
    if (!ACTIONS.includes(action)) throw new BankError("Choose a valid game action.");
    const version = Number(text(fd, "version"));
    if (!text(fd, "version") || !Number.isSafeInteger(version) || version < 0) throw new BankError("Reload the game before continuing.");
    await runBankCommand(prisma, {
      groupId, gameId: text(fd, "gameId"), version, action,
      playerId: text(fd, "playerId") || undefined, recipientId: text(fd, "recipientId") || undefined,
      playerName: text(fd, "playerName") || undefined, operationId: text(fd, "operationId") || undefined,
      batchId: text(fd, "batchId") || undefined, paid: fd.get("paid") === "on",
      amount: ["BUY_IN", "CASH_OUT", "RECYCLE", "CLEAR", "SEAT"].includes(action) ? bankAmount(text(fd, "amount")) : undefined,
      chipBankSize: action === "CHIPS" ? text(fd, "chipBankSize") ? bankAmount(text(fd, "chipBankSize")) : null : undefined,
      openingCash: action === "ENABLE" ? bankAmount(text(fd, "openingCash") || "0", true) : undefined,
    });
  } catch (error) { return { error: errorMessage(error) }; }
  revalidatePath("/", "layout");
  return { ok: true as const, message: "Saved. The bank and player balances are up to date." };
}
