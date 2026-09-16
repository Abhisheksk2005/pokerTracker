/**
 * Turns net ledger balances into the shortest list of payments that squares
 * everyone up.
 *
 * A negative balance means the player put in more than they took out, so the
 * group owes them; a positive balance means they are holding group money and
 * need to pay. Repeatedly matching the largest payer against the largest
 * receiver settles at least one person per payment, so n players never need
 * more than n-1 transfers.
 */

export type Settlement = {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number; // paise, always positive
};

export type SettleResult = {
  settlements: Settlement[];
  /** Left over when balances do not sum to zero (unrecorded cash). */
  imbalance: number;
  owed: number;
};

export type NetBalance = { playerId: string; playerName: string; balance: number };

export function settleUp(balances: NetBalance[]): SettleResult {
  // Copy before sorting: callers pass arrays they still use for display.
  const payers = balances.filter((b) => b.balance > 0).map((b) => ({ ...b, left: b.balance }));
  const receivers = balances.filter((b) => b.balance < 0).map((b) => ({ ...b, left: -b.balance }));
  payers.sort((a, b) => b.left - a.left || a.playerName.localeCompare(b.playerName));
  receivers.sort((a, b) => b.left - a.left || a.playerName.localeCompare(b.playerName));

  const settlements: Settlement[] = [];
  let payerIndex = 0;
  let receiverIndex = 0;

  while (payerIndex < payers.length && receiverIndex < receivers.length) {
    const payer = payers[payerIndex];
    const receiver = receivers[receiverIndex];
    const amount = Math.min(payer.left, receiver.left);

    if (amount > 0) {
      settlements.push({
        fromId: payer.playerId,
        fromName: payer.playerName,
        toId: receiver.playerId,
        toName: receiver.playerName,
        amount,
      });
      payer.left -= amount;
      receiver.left -= amount;
    }

    if (payer.left === 0) payerIndex += 1;
    if (receiver.left === 0) receiverIndex += 1;
  }

  const owed = balances.reduce((total, b) => total + Math.max(0, b.balance), 0);
  const imbalance = balances.reduce((total, b) => total + b.balance, 0);
  return { settlements, imbalance, owed };
}
