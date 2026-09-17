/** Money and chip face values are integer cents. No hand-by-hand stack estimates. */
export const BANK_KINDS = ["INITIAL_BUY_IN", "BUY_IN", "CASH_OUT", "CHIP_RETURN", "PAYMENT_IN", "PAYMENT_OUT", "OFFSET_IN", "OFFSET_OUT", "CREDIT", "CHARGE"] as const;
export type BankKind = typeof BANK_KINDS[number];
export type BankRecord = { id: string; playerId: string; kind: string; amount: number; relatedId: string | null; rebuyCount: number; batchId: string; voidedAt: Date | string | null };
export const BANK_LABELS: Record<BankKind, string> = {
  INITIAL_BUY_IN: "Initial buy-in", BUY_IN: "Buy-in", CASH_OUT: "Final chips", CHIP_RETURN: "Chips handed over",
  PAYMENT_IN: "Cash received", PAYMENT_OUT: "Cash paid", OFFSET_IN: "Buy-in cleared with credit", OFFSET_OUT: "Credit used for buy-in", CREDIT: "Player credit", CHARGE: "Player charge",
};
const CHARGES = new Set(["INITIAL_BUY_IN", "BUY_IN", "CHARGE"]);
const CREDITS = new Set(["CASH_OUT", "CHIP_RETURN", "CREDIT"]);
export const isCharge = (kind: string) => CHARGES.has(kind);
export const isCredit = (kind: string) => CREDITS.has(kind);

export class BankError extends Error {}

/** Strict input parsing: never turn malformed or negative inputs into money. */
export function bankAmount(value: unknown, allowZero = false): number {
  if (typeof value !== "string" || !/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new BankError("Enter a valid amount with up to two decimal places.");
  const amount = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(amount) || amount > 1_000_000_000 || amount < (allowZero ? 0 : 1)) throw new BankError(allowZero ? "Enter an amount of zero or more." : "Enter an amount greater than zero.");
  return amount;
}

export function bankSummary(records: BankRecord[], chipBankSize: number | null = null, openingCash = 0) {
  const active = records.filter((row) => !row.voidedAt);
  const byId = new Map(active.map((row) => [row.id, row]));
  const settled = new Map<string, number>();
  const byPlayer = new Map<string, { playerId: string; buyIn: number; cashOut: number; adjustment: number; rebuys: number; cashIn: number; cashPaid: number; owesBank: number; bankOwes: number; netDue: number }>();
  let totalBuyIn = 0, totalReturned = 0, cashIn = 0, cashPaid = 0, chipsLent = 0;
  for (const row of active) {
    if (!BANK_KINDS.includes(row.kind as BankKind) || !Number.isSafeInteger(row.amount) || row.amount <= 0) throw new BankError("The bank history contains an invalid amount or action.");
    let player = byPlayer.get(row.playerId);
    if (!player) { player = { playerId: row.playerId, buyIn: 0, cashOut: 0, adjustment: 0, rebuys: 0, cashIn: 0, cashPaid: 0, owesBank: 0, bankOwes: 0, netDue: 0 }; byPlayer.set(row.playerId, player); }
    if (row.kind === "INITIAL_BUY_IN" || row.kind === "BUY_IN") { player.buyIn += row.amount; totalBuyIn += row.amount; player.rebuys += row.rebuyCount; }
    if (row.kind === "CASH_OUT" || row.kind === "CHIP_RETURN") { player.cashOut += row.amount; totalReturned += row.amount; }
    if (row.kind === "CHIP_RETURN") chipsLent += row.amount;
    if (row.kind === "CREDIT") player.adjustment += row.amount;
    if (row.kind === "CHARGE") player.adjustment -= row.amount;
    if (row.kind === "PAYMENT_IN") { player.cashIn += row.amount; cashIn += row.amount; }
    if (row.kind === "PAYMENT_OUT") { player.cashPaid += row.amount; cashPaid += row.amount; }
    if (["PAYMENT_IN", "PAYMENT_OUT", "OFFSET_IN", "OFFSET_OUT"].includes(row.kind)) {
      const source = row.relatedId ? byId.get(row.relatedId) : null;
      const incoming = row.kind === "PAYMENT_IN" || row.kind === "OFFSET_IN";
      if (!source || source.playerId !== row.playerId || !(incoming ? isCharge(source.kind) : isCredit(source.kind))) throw new BankError("A payment is not linked to a matching buy-in or return.");
      settled.set(source.id, (settled.get(source.id) ?? 0) + row.amount);
    }
  }
  const dues = active.filter((row) => isCharge(row.kind) || isCredit(row.kind)).map((row) => {
    const paid = settled.get(row.id) ?? 0;
    if (paid > row.amount) throw new BankError("A buy-in or cash-out has been cleared for more than its amount.");
    const remaining = row.amount - paid;
    const player = byPlayer.get(row.playerId)!;
    if (isCharge(row.kind)) player.owesBank += remaining; else player.bankOwes += remaining;
    return { ...row, paid, remaining };
  });
  for (const player of byPlayer.values()) player.netDue = player.bankOwes - player.owesBank;
  const chipsInPlay = totalBuyIn - totalReturned;
  const bankCash = openingCash + cashIn - cashPaid;
  return { dues, players: [...byPlayer.values()], totalBuyIn, totalReturned, chipsInPlay, chipsLent, bankCash, cashIn, cashPaid,
    chipsAvailable: chipBankSize === null ? null : chipBankSize - chipsInPlay,
    owedToBank: dues.filter((row) => isCharge(row.kind)).reduce((sum, row) => sum + row.remaining, 0),
    owedToPlayers: dues.filter((row) => isCredit(row.kind)).reduce((sum, row) => sum + row.remaining, 0),
  };
}

export function assertBankBalanced(summary: ReturnType<typeof bankSummary>) {
  if (summary.chipsInPlay < 0) throw new BankError("This returns more chips than are currently at the table. Check the amount first.");
  if (summary.chipsAvailable !== null && summary.chipsAvailable < 0) throw new BankError("Not enough chips in the bank. Recycle a player's chips or update the physical chip supply.");
  if (summary.bankCash < 0) throw new BankError("The bank has not collected enough cash for this payout. Return the chips with payment pending, or clear unpaid buy-ins first.");
}
