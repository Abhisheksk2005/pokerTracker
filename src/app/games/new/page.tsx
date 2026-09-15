import { randomUUID } from "node:crypto";
import Link from "next/link";
import { GameSetupWizard } from "@/components/game-setup-wizard";
import { getActiveGroup, getAllPlayerOptions } from "@/lib/groups";
import { getPlayers } from "@/lib/queries";
export const dynamic = "force-dynamic";
export default async function NewGamePage() {
  const [group, all, roster] = await Promise.all([getActiveGroup(), getAllPlayerOptions(), getPlayers()]);
  const members = new Map(roster.map((player) => [player.id, player]));
  const players = all.map((player) => ({ ...player, inGroup: members.has(player.id), active: members.get(player.id)?.active ?? false })).sort((a, b) => Number(b.inGroup) - Number(a.inGroup) || a.name.localeCompare(b.name));
  return <><div className="page-toolbar"><Link className="link text-sm" href="/">← Choose group</Link><span className="eyebrow">Start a game</span></div><h1 className="sr-only">Start a game in {group.name}</h1><GameSetupWizard groupId={group.id} groupName={group.name} players={players} requestId={randomUUID()} /></>;
}
