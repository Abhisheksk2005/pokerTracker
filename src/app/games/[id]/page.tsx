import Link from "next/link";
import { LiveGame, EnableLiveBank } from "@/components/live-game";
import { getAllPlayerOptions } from "@/lib/groups";
import { notFound } from "next/navigation";
import { AddSeats } from "@/components/add-seats";
import { Avatar, SectionTitle } from "@/components/poker-ui";
import { EntriesEditor } from "@/components/entries-editor";
import { ActionForm, ConfirmButton, Field, SubmitButton } from "@/components/form";
import {
  Card,
  CardHeader,
  Empty,
  Money,
  PageHeader,
  Pct,
  PlayerLink,
  StatTile,
  StatusChip,
} from "@/components/ui";
import {
  addPlayersToGame,
  deleteGame,
  postGameToLedger,
  removeEntry,
  saveEntries,
  setGameStatus,
  updateGame,
} from "@/lib/actions";
import { fmtDateLong, toDateInput } from "@/lib/dates";
import { buildNights, type NightRow, type RawEntry } from "@/lib/metrics";
import { fmtMoney, fmtNum } from "@/lib/money";
import { getGame, getPlayers } from "@/lib/queries";

export const dynamic = "force-dynamic";

const SORTS: Record<string, (a: NightRow, b: NightRow) => number> = {
  score: (a, b) => (b.nightScore ?? -Infinity) - (a.nightScore ?? -Infinity),
  profit: (a, b) => b.profit - a.profit,
  cashout: (a, b) => b.cashOut - a.cashOut,
  buyin: (a, b) => b.buyIn - a.buyIn,
  roi: (a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity),
  share: (a, b) => (b.tableShare ?? -Infinity) - (a.tableShare ?? -Infinity),
  pws: (a, b) => (b.potWeightedScore ?? -Infinity) - (a.potWeightedScore ?? -Infinity),
  name: (a, b) => a.playerName.localeCompare(b.playerName),
};

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [game, roster] = await Promise.all([getGame(id), getPlayers()]);
  if (!game) notFound();
  if (game.bankTracking) return <LiveGame game={game} allPlayers={await getAllPlayerOptions()} />;

  const raw: RawEntry[] = game.entries.map((e) => ({
    gameId: game.id,
    gameName: game.name,
    date: game.date,
    status: game.status,
    playerId: e.playerId,
    playerName: e.player.name,
    buyIn: e.buyIn,
    cashOut: e.cashOut,
    rebuys: e.rebuys,
    adjustment: e.adjustment,
  }));

  const night = buildNights(raw)[0] ?? null;
  const sortKey = sp.sort && sp.sort in SORTS ? sp.sort : "score";
  const rows = night ? [...night.rows].sort(SORTS[sortKey]) : [];

  const seated = new Set(game.entries.map((e) => e.playerId));
  const candidates = roster.filter((p) => !seated.has(p.id));
  const isOpen = game.status === "ACTIVE";
  const entryIdByPlayer = new Map(game.entries.map((e) => [e.playerId, e.id]));

  return (
    <>
      <PageHeader
        title={game.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {fmtDateLong(game.date)}
            <StatusChip status={game.status} />
            {game.location ? <span>· {game.location}</span> : null}
          </span>
        }
        action={
          <>
            <form action={setGameStatus}>
              <input type="hidden" name="id" value={game.id} />
              <input type="hidden" name="status" value={isOpen ? "CLOSED" : "ACTIVE"} />
              <SubmitButton className={`btn ${isOpen ? "btn-primary" : ""}`} pendingLabel="…">
                {isOpen ? "Close night" : "Reopen for editing"}
              </SubmitButton>
            </form>
            <form action={postGameToLedger}>
              <input type="hidden" name="gameId" value={game.id} />
              <SubmitButton className="btn" pendingLabel="Posting…">
                Post to ledger
              </SubmitButton>
            </form>
            <Link href="/games" className="btn">
              All games
            </Link>
          </>
        }
      />

      {isOpen ? <EnableLiveBank game={game} /> : null}
      {night ? (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile label="Total in" value={fmtMoney(night.pot)} hint={`${night.rebuys} rebuys`} />
          <StatTile label="Total out" value={fmtMoney(night.totalOut)} />
          <StatTile
            label="Bank delta"
            value={night.bankDelta === 0 ? "Balanced" : fmtMoney(night.bankDelta, { sign: true })}
            tone={night.bankDelta === 0 ? "up" : "down"}
            hint={night.bankDelta === 0 ? "In matches out" : "Chips unaccounted for"}
          />
          <StatTile label="Players" value={night.playerCount} />
          <StatTile
            label="Biggest winner"
            value={night.winner ? night.winner.playerName : "—"}
            tone="up"
            hint={night.winner ? fmtMoney(night.winner.profit, { sign: true }) : undefined}
          />
        </div>
      ) : null}

      {game.entries.length === 0 ? (
        <Card className="mb-5">
          <CardHeader title="Nobody is seated yet" subtitle="Add players to start the night." />
          <AddSeats gameId={game.id} candidates={candidates} action={addPlayersToGame} />
        </Card>
      ) : (
        <>
          <Card className="mb-5">
            <CardHeader
              title="Results"
              subtitle={
                <span className="flex flex-wrap items-center gap-1">
                  Sort by:
                  {Object.keys(SORTS).map((k) => (
                    <Link
                      key={k}
                      href={`/games/${game.id}?sort=${k}`}
                      className={`chip cursor-pointer ${k === sortKey ? "chip-accent" : ""}`}
                    >
                      {LABELS[k]}
                    </Link>
                  ))}
                </span>
              }
            />
            <div className="scroll-x">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>Player</th>
                    <th className="num">Buy-in</th>
                    <th className="num">Cash-out</th>
                    <th className="num">Profit</th>
                    <th className="num">ROI</th>
                    <th className="num">Night score</th>
                    <th className="num">Table share</th>
                    <th className="num">Pot-weighted</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.playerId}>
                      <td className="num text-[var(--text-faint)]">{r.place}</td>
                      <td className="font-medium">
                        <PlayerLink id={r.playerId} name={r.playerName} />
                      </td>
                      <td className="num">{fmtMoney(r.buyIn)}</td>
                      <td className="num">{fmtMoney(r.cashOut)}</td>
                      <td className="num">
                        <Money cents={r.profit} signed bold />
                      </td>
                      <td className="num">
                        <Pct value={r.roi} />
                      </td>
                      <td className="num">{fmtNum(r.nightScore)}</td>
                      <td className="num">
                        <Pct value={r.tableShare} signed />
                      </td>
                      <td className="num">{fmtNum(r.potWeightedScore)}</td>
                      <td className="num">
                        {isOpen ? (
                          <form action={removeEntry}>
                            <input
                              type="hidden"
                              name="id"
                              value={entryIdByPlayer.get(r.playerId) ?? ""}
                            />
                            <ConfirmButton
                              message={`Remove ${r.playerName} from this night?`}
                              className="btn btn-sm btn-danger"
                            >
                              Remove
                            </ConfirmButton>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t px-4 py-2 text-xs text-[var(--text-faint)]">
              Night score = ROI × √buy-in · Table share = profit ÷ pot · Pot-weighted = night score ×
              (pot ÷ 100)
            </p>
          </Card>

          <section className="mb-5">
            <SectionTitle>Player cards</SectionTitle>
            <div className="mt-3 grid grid-cols-2 gap-[10px]">
              {rows.map((row) => (
                <Link key={row.playerId} href={`/players/${row.playerId}`} className="card game-player-card">
                  <div className="flex items-center gap-2"><Avatar name={row.playerName} /><span className="mono text-[10px] text-[var(--text-faint)]">#{row.place} of {rows.length}</span></div>
                  <h3 className="mt-3 text-sm font-extrabold">{row.playerName}</h3>
                  <div className="mt-1 text-[19px] font-black"><Money cents={row.profit} signed /></div>
                  <p className="mono mt-2 text-[10px] leading-5 text-[var(--text-dim)]">In {fmtMoney(row.buyIn)} · out {fmtMoney(row.cashOut)}</p>
                  <p className="mono text-[10px] leading-5 text-[var(--text-dim)]">ROI <Pct value={row.roi} /> · score {fmtNum(row.nightScore)}</p>
                </Link>
              ))}
            </div>
          </section>

          <Card className="mb-5">
            <CardHeader
              title="Edit amounts"
              subtitle={
                isOpen
                  ? "Profit and the bank delta update as you type."
                  : "This night is closed. Reopen it to change the numbers."
              }
            />
            {isOpen ? (
              <EntriesEditor
                gameId={game.id}
                defaultBuyIn={game.defaultBuyIn}
                action={saveEntries}
                rows={game.entries.map((e) => ({
                  id: e.id,
                  playerId: e.playerId,
                  playerName: e.player.name,
                  buyIn: e.buyIn,
                  cashOut: e.cashOut,
                  rebuys: e.rebuys,
                  adjustment: e.adjustment,
                  note: e.note,
                }))}
              />
            ) : (
              <Empty>Closed nights are read-only. Use “Reopen for editing” above.</Empty>
            )}
          </Card>

          {isOpen ? (
            <Card className="mb-5">
              <CardHeader title="Seat more players" />
              <AddSeats gameId={game.id} candidates={candidates} action={addPlayersToGame} />
            </Card>
          ) : null}
        </>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Night settings" />
          <ActionForm action={updateGame} className="px-4 py-4">
            <input type="hidden" name="id" value={game.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input name="name" className="field" defaultValue={game.name} required />
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  name="date"
                  className="field"
                  defaultValue={toDateInput(game.date)}
                  required
                />
              </Field>
              <Field label="Default buy-in (₹ INR)">
                <input
                  name="defaultBuyIn"
                  type="number"
                  step="0.01"
                  min="0"
                  className="field"
                  defaultValue={(game.defaultBuyIn / 100).toString()}
                />
              </Field>
              <Field label="Location">
                <input name="location" className="field" defaultValue={game.location ?? ""} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Notes">
                <textarea name="notes" rows={2} className="field" defaultValue={game.notes ?? ""} />
              </Field>
            </div>
            <div className="mt-4">
              <SubmitButton>Save night</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card className="border-[var(--down)]">
          <CardHeader
            title="Danger zone"
            subtitle="Deleting a night removes its results and any ledger rows posted from it."
          />
          <form action={deleteGame} className="px-4 py-4">
            <input type="hidden" name="id" value={game.id} />
            <ConfirmButton
              message={`Delete "${game.name}"? This cannot be undone.`}
              className="btn btn-danger"
            >
              Delete this night
            </ConfirmButton>
          </form>
        </Card>
      </div>
    </>
  );
}

const LABELS: Record<string, string> = {
  score: "Night score",
  profit: "Profit",
  cashout: "Cash-out",
  buyin: "Buy-ins",
  roi: "ROI",
  share: "Table share",
  pws: "Pot-weighted",
  name: "Name A–Z",
};
