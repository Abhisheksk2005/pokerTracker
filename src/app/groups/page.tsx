import type { CSSProperties } from "react";
import { ConfirmButton, SubmitButton } from "@/components/form";
import { CopyInvite, CreateGroupForm, JoinGroupForm } from "@/components/group-forms";
import { Card, CardHeader, Empty, Money, PageHeader, StatTile } from "@/components/ui";
import {
  createGroup,
  joinGroup,
  regenerateInvite,
  removeGroupMember,
  switchGroup,
  updateMemberRole,
} from "@/lib/group-actions";
import { fmtDate } from "@/lib/dates";
import { getActiveGroupOverview, getAllPlayerOptions, getGroupContext, roleLabel } from "@/lib/groups";
import { getLeagueView } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const [context, allPlayers] = await Promise.all([getGroupContext(), getAllPlayerOptions()]);

  if (!context.active) {
    return (
      <>
        <PageHeader title="Create your first group" subtitle="Name your table and choose a normal player profile as its owner" />
        <section
          className="group-hero mb-5 overflow-hidden rounded-[28px] border p-6 sm:p-9"
          style={{ "--group-accent": "#ff6a4d" } as CSSProperties}
        >
          <div className="relative z-10 max-w-2xl">
            <div className="eyebrow">Fresh start</div>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-5xl">Your table. Your name.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-dim)]">
              There are no groups yet. Your saved player profiles and poker history are safe; the first group you create
              will adopt them automatically.
            </p>
          </div>
        </section>
        <Card className="mx-auto max-w-2xl overflow-hidden border-[var(--coral-border)] bg-[var(--coral-soft)]">
          <CardHeader title="First group" subtitle="No account, email, login or password is needed." />
          <CreateGroupForm action={createGroup} players={allPlayers} />
        </Card>
      </>
    );
  }

  const [group, league] = await Promise.all([getActiveGroupOverview(), getLeagueView("all")]);
  const leader = [...league.players].sort((a, b) => b.profit - a.profit)[0];

  return (
    <>
      <PageHeader
        title="Groups"
        subtitle="Separate rosters, nights, leaderboards and ledgers—without losing PKRTrackr history"
      />

      <section
        className="group-hero mb-5 overflow-hidden rounded-[28px] border p-5 sm:p-7"
        style={{ "--group-accent": group.accent } as CSSProperties}
      >
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="eyebrow">Active group</div>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">{group.name}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-dim)]">
              {group.description || "A private table for this roster and its poker history."}
            </p>
          </div>
          <div className="rounded-2xl border bg-black/20 px-4 py-3 text-right backdrop-blur">
            <div className="eyebrow">Invite code</div>
            <div className="mt-1 font-mono text-lg font-bold tracking-[0.16em]">{group.inviteCode}</div>
            <div className="mt-2 flex justify-end gap-2">
              <CopyInvite code={group.inviteCode} />
              <form action={regenerateInvite}>
                <input type="hidden" name="groupId" value={group.id} />
                <SubmitButton className="btn btn-sm" pendingLabel="…">
                  New code
                </SubmitButton>
              </form>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Members" value={group.members.length} hint={`${group.members.filter((m) => m.active).length} active`} />
        <StatTile label="Poker nights" value={group._count.games} hint={`${league.closedNights.length} closed`} />
        <StatTile label="Total pot" value={<Money cents={league.summary.totalPot} />} hint="Closed nights" />
        <StatTile
          label="Group leader"
          value={leader?.playerName ?? "—"}
          hint={leader ? <Money cents={leader.profit} signed /> : "No results yet"}
          tone={leader && leader.profit > 0 ? "up" : "neutral"}
        />
      </div>

      <Card className="mb-5 overflow-hidden">
        <CardHeader title="Your poker groups" subtitle="Switching changes every game, player, stat and ledger view." />
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {context.groups.map((item) => {
            const active = item.id === group.id;
            return (
              <form action={switchGroup} key={item.id}>
                <input type="hidden" name="groupId" value={item.id} />
                <input type="hidden" name="returnTo" value="/groups" />
                <button
                  type="submit"
                  className={`group-tile w-full text-left ${active ? "group-tile-active" : ""}`}
                  style={{ "--group-accent": item.accent } as CSSProperties}
                >
                  <span className="block text-base font-extrabold">{item.name}</span>
                  <span className="mt-1 block text-xs text-[var(--text-dim)]">
                    {item._count.members} members · {item._count.games} nights
                  </span>
                  <span className="mt-4 inline-flex text-xs font-bold" style={{ color: item.accent }}>
                    {active ? "Currently active" : "Switch group →"}
                  </span>
                </button>
              </form>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        <Card className="overflow-hidden">
          <CardHeader
            title={`Members (${group.members.length})`}
            subtitle="Roles are group-specific. Removing a member keeps their historical results intact."
          />
          {group.members.length === 0 ? (
            <Empty>No members yet.</Empty>
          ) : (
            <ul>
              {group.members.map((member) => (
                <li key={member.playerId} className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black text-black"
                    style={{ background: group.accent }}
                  >
                    {initials(member.player.name)}
                  </span>
                  <span className="min-w-40 flex-1">
                    <span className="block text-sm font-bold">{member.player.name}</span>
                    <span className="mt-0.5 block text-xs text-[var(--text-faint)]">
                      Joined {fmtDate(member.joinedAt)} · {member.active ? "Active roster" : "Inactive roster"}
                    </span>
                  </span>
                  {member.role === "OWNER" ? (
                    <span className="chip chip-accent">Owner</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <form action={updateMemberRole} className="flex items-center gap-2">
                        <input type="hidden" name="playerId" value={member.playerId} />
                        <select name="role" className="field field-sm w-28" defaultValue={member.role}>
                          <option value="MEMBER">Member</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                        <SubmitButton className="btn btn-sm" pendingLabel="…">
                          Save
                        </SubmitButton>
                      </form>
                      <form action={removeGroupMember}>
                        <input type="hidden" name="playerId" value={member.playerId} />
                        <ConfirmButton message={`Remove ${member.player.name} from ${group.name}?`}>
                          Remove
                        </ConfirmButton>
                      </form>
                    </div>
                  )}
                  <span className="sr-only">{roleLabel(member.role)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="overflow-hidden border-[var(--coral-border)] bg-[var(--coral-soft)]">
            <CardHeader title="Create a group" subtitle="Start with an owner and an empty, private league." />
            <CreateGroupForm action={createGroup} players={allPlayers} />
          </Card>
          <Card className="overflow-hidden border-[var(--violet-border)] bg-[var(--violet-soft)]">
            <CardHeader title="Join from an invite" subtitle="Attach an existing player profile to another group." />
            <JoinGroupForm action={joinGroup} players={allPlayers} />
          </Card>
        </div>
      </div>
    </>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
