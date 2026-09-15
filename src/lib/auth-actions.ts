"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  authMode,
  createSessionToken,
  passcodeMatches,
  safeNextPath,
  SESSION_COOKIE,
  SESSION_DAYS,
} from "@/lib/auth";

// Brute-force brake: per client, 5 free misses then a doubling cool-down (max 15 min).
// In-memory is right for this single-process SQLite deployment.
const attempts = new Map<string, { fails: number; until: number }>();
const FREE_ATTEMPTS = 5;

async function clientKey() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export async function unlock(_prev: { error?: string } | null, formData: FormData) {
  if (authMode() !== "passcode") return { error: "This app has no passcode configured yet." };

  const who = await clientKey();
  const record = attempts.get(who) ?? { fails: 0, until: 0 };
  const now = Date.now();
  if (record.until > now) {
    return { error: `Too many tries. Wait ${Math.ceil((record.until - now) / 1000)} seconds.` };
  }

  if (!passcodeMatches(String(formData.get("passcode") ?? ""))) {
    record.fails += 1;
    if (record.fails >= FREE_ATTEMPTS) {
      record.until = now + Math.min(15 * 60, 30 * 2 ** (record.fails - FREE_ATTEMPTS)) * 1000;
    }
    attempts.set(who, record);
    await new Promise((resolve) => setTimeout(resolve, 350));
    return { error: "That passcode isn't right." };
  }

  attempts.delete(who);
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  redirect(safeNextPath(String(formData.get("next") ?? "/")));
}

export async function lock() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/unlock");
}
