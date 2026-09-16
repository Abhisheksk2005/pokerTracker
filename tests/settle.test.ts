import assert from "node:assert/strict";
import { test } from "node:test";
import { settleUp, type NetBalance } from "../src/lib/settle";

const of = (entries: [string, number][]): NetBalance[] =>
  entries.map(([playerName, balance]) => ({ playerId: playerName.toLowerCase(), playerName, balance }));

/** Applying the payments must leave every player on zero. */
function applied(balances: NetBalance[]) {
  const net = new Map(balances.map((b) => [b.playerId, b.balance]));
  for (const s of settleUp(balances).settlements) {
    net.set(s.fromId, (net.get(s.fromId) ?? 0) - s.amount);
    net.set(s.toId, (net.get(s.toId) ?? 0) + s.amount);
  }
  return [...net.values()];
}

test("no payments when everyone is square", () => {
  assert.deepEqual(settleUp(of([["A", 0], ["B", 0]])).settlements, []);
  assert.deepEqual(settleUp([]).settlements, []);
});

test("one payer and one receiver settle directly", () => {
  const { settlements } = settleUp(of([["Winner", -50000], ["Loser", 50000]]));
  assert.equal(settlements.length, 1);
  assert.deepEqual(
    { from: settlements[0].fromName, to: settlements[0].toName, amount: settlements[0].amount },
    { from: "Loser", to: "Winner", amount: 50000 },
  );
});

test("balanced tables settle to zero in at most n-1 payments", () => {
  const cases: [string, number][][] = [
    [["A", 30000], ["B", 10000], ["C", -25000], ["D", -15000]],
    [["A", 100], ["B", 200], ["C", 300], ["D", -600]],
    [["A", -1], ["B", 1]],
    [["A", 70000], ["B", -20000], ["C", -20000], ["D", -20000], ["E", -10000]],
  ];
  for (const entries of cases) {
    const balances = of(entries);
    const { settlements } = settleUp(balances);
    assert.ok(settlements.length <= balances.length - 1, `too many payments for ${JSON.stringify(entries)}`);
    assert.ok(settlements.every((s) => s.amount > 0 && s.fromId !== s.toId));
    assert.deepEqual(new Set(applied(balances)), new Set([0]));
  }
});

test("reports imbalance when cash is unaccounted for and still pays out what it can", () => {
  const balances = of([["A", 30000], ["B", -20000]]);
  const result = settleUp(balances);
  assert.equal(result.imbalance, 10000);
  assert.equal(result.owed, 30000);
  assert.equal(result.settlements.length, 1);
  assert.equal(result.settlements[0].amount, 20000);
});

test("does not mutate the caller's array", () => {
  const balances = of([["A", 500], ["B", -500]]);
  const copy = structuredClone(balances);
  settleUp(balances);
  assert.deepEqual(balances, copy);
});
