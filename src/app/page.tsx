import Link from "next/link";
import { Icon } from "@/components/icons";
import { Avatar, SectionTitle } from "@/components/poker-ui";
import { SubmitButton } from "@/components/form";
import { LiveRefresh } from "@/components/game-bank-forms";
import { getGroupContext } from "@/lib/groups";
import { switchGroup } from "@/lib/group-actions";
import { getGames, getLeagueView } from "@/lib/queries";
import { bankSummary } from "@/lib/bank";
import { fmtMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export default async function Home() {
  const { active, groups } = await getGroupContext();
  if (!active) return <section className="welcome-card"><div className="eyebrow">Your poker nights, together</div><h1>Choose your table.</h1><p>Create a group to save members and start your first game.</p><Link href="/groups" className="btn btn-primary start-game-button">Create a group →</Link></section>;
  const [games, league] = await Promise.all([getGames(), getLeagueView("all")]);
  const live = games.filter((game) => game.status === "ACTIVE");
  const leaders = [...league.players].sort((a, b) => b.profit - a.profit);
  return <div className="home-page"><LiveRefresh />
    <header className="pulse-heading"><div className="eyebrow">Good company. Great nights.</div><h1>Choose your table.</h1><p className="section-caption">Select a group, bring your people, deal in.</p></header>
    <div className="group-picker">{groups.map((group) => <form action={switchGroup} key={group.id}><input type="hidden" name="groupId" value={group.id} /><input type="hidden" name="returnTo" value="/" /><SubmitButton className={`group-choice ${active.id === group.id ? "selected" : ""}`} pendingLabel="Selecting…"><span className="group-spade"><Icon name="spade" size={24} /></span><span><strong>{group.name}</strong><small>{group._count.members} members · {group._count.games} games</small></span><b className="group-check"><Icon name={active.id === group.id ? "check" : "chevron"} size={15} /></b></SubmitButton></form>)}</div>
    <Link href="/groups" className="group-manage"><Icon name="plus" size={16} />Create or manage groups</Link>
    <Link href="/games/new" className="btn btn-primary start-game-button"><span className="start-game-label"><span className="play-badge"><Icon name="play" size={18} /></span>Start a game</span><Icon name="arrow" size={21} /></Link><p className="start-caption">{active.name} · Choose members & initial buy-ins next</p>
    <section className="pulse-section"><SectionTitle href="/players" tone="violet">Group leaderboard</SectionTitle><p className="section-caption">{active.name} · Profit from finished games</p>
      {leaders.length ? <div className="leaderboard">{leaders.slice(0, 5).map((player, index) => <Link className="leaderboard-row" href={`/players/${player.playerId}`} key={player.playerId}><span className="rank-number">{index + 1}</span><Avatar name={player.playerName} /><span className="row-main"><strong>{player.playerName}</strong></span><span className="row-result" style={{ color: player.profit >= 0 ? "var(--up)" : "var(--down)" }}>{fmtMoney(player.profit, { sign: true })}</span></Link>)}</div> : <div className="card empty-leaderboard"><span className="empty-icon"><Icon name="spade" size={28} /></span><strong>The first place is still open.</strong><p>Finish a game to put your group on the board.</p></div>}
    </section>
    <section className="pulse-section"><SectionTitle href="/games" tone="coral">Live game dashboard</SectionTitle><p className="section-caption">Only games in {active.name}</p><div className="live-games">{live.map((game) => {
      const bank = game.bankTracking ? bankSummary(game.bankOperations, game.chipBankSize, game.openingCash) : null;
      return <Link href={`/games/${game.id}`} className="live-game-card" key={game.id}><div className="flex items-center justify-between gap-2"><span className="live-badge">● LIVE</span><span className="mono text-xs">{game.entries.length} players</span></div><h3>{game.name}</h3><div className="live-card-stats"><div><small>{bank ? "Chips in play" : "Total buy-ins"}</small><strong>{fmtMoney(bank?.chipsInPlay ?? game.entries.reduce((sum, entry) => sum + entry.buyIn, 0))}</strong></div><div><small>{bank ? "Bank owes players" : "Tracking"}</small><strong>{bank ? fmtMoney(bank.owedToPlayers) : "Classic game"}</strong></div></div><div className="live-card-footer">{bank ? "Open game bank" : "Continue game"}<span>→</span></div></Link>;
    })}</div>{!live.length ? <p className="section-empty">No game in play. Start one above.</p> : null}</section>
    <Link href="/pulse" className="btn w-full">League pulse & highlights →</Link>
  </div>;
}
