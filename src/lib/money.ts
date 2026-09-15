/** INR amounts are stored as integer paise (100 paise = ₹1). Legacy `cents` names refer to paise. */

export function toCents(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === "") return 0;
  const n = typeof input === "number" ? input : Number(String(input).replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function toRupees(cents: number): number {
  return cents / 100;
}

/** ₹1,23,456 / -₹1,23,456 — whole rupees when clean, 2dp otherwise. */
export function fmtMoney(cents: number, opts: { sign?: boolean; cents?: boolean } = {}): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const showCents = opts.cents ?? abs % 100 !== 0;
  const body = (abs / 100).toLocaleString("en-IN", {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
  if (neg) return `-₹${body}`;
  if (opts.sign) return cents === 0 ? "₹0" : `+₹${body}`;
  return `₹${body}`;
}

/** Signed money, used for profit columns. */
export function fmtProfit(cents: number): string {
  return fmtMoney(cents, { sign: true });
}

export function fmtPct(ratio: number | null, digits = 1): string {
  if (ratio === null || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function fmtSignedPct(ratio: number | null, digits = 1): string {
  if (ratio === null || !Number.isFinite(ratio)) return "—";
  const v = ratio * 100;
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export function fmtNum(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}
