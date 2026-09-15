/**
 * Pure ledger vocabulary — no database import, so client components can use it.
 *
 * Sign convention: `amount` is positive when cash moves TOWARDS the player and
 * negative when it moves AWAY from them. A running total of a player's ledger is
 * therefore their real cash position; if it matches their all-time profit, the
 * books are square.
 */

export const TX_TYPES = ["BUY_IN", "CASH_OUT", "PAYMENT_IN", "PAYMENT_OUT", "ADJUSTMENT"] as const;

export type TxType = (typeof TX_TYPES)[number];

export const TX_META: Record<
  TxType,
  { label: string; help: string; direction: -1 | 1 | 0; tone: "in" | "out" | "neutral" }
> = {
  BUY_IN: {
    label: "Buy-in",
    help: "Player put cash into the game",
    direction: -1,
    tone: "in",
  },
  CASH_OUT: {
    label: "Cash-out",
    help: "Player took chips off the table for cash",
    direction: 1,
    tone: "out",
  },
  PAYMENT_IN: {
    label: "Payment in",
    help: "Player settled up what they owed",
    direction: -1,
    tone: "in",
  },
  PAYMENT_OUT: {
    label: "Payment out",
    help: "Player was paid what they were owed",
    direction: 1,
    tone: "out",
  },
  ADJUSTMENT: {
    label: "Adjustment",
    help: "Tips, table fees or a correction — you choose the direction",
    direction: 0,
    tone: "neutral",
  },
};

export const TX_METHODS = ["CASH", "BANK", "UPI", "CARD", "OTHER"] as const;
export type TxMethod = (typeof TX_METHODS)[number];

export function isTxType(v: string): v is TxType {
  return (TX_TYPES as readonly string[]).includes(v);
}

/** Turn a positive amount + type into the signed cents we store. */
export function signedAmount(type: TxType, magnitudeCents: number, explicitSign?: -1 | 1): number {
  const dir = TX_META[type].direction;
  if (dir === 0) return explicitSign === -1 ? -Math.abs(magnitudeCents) : Math.abs(magnitudeCents);
  return dir * Math.abs(magnitudeCents);
}
