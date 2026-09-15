import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const ACTIVE_GROUP_COOKIE = "pkrtrackr-active-group";

export type GroupRole = "OWNER" | "ADMIN" | "MEMBER";

/**
 * The app is intentionally account-free, so the selected group is a workspace
 * preference rather than an authenticated identity. A cookie keeps every page,
 * query and Server Action on the same group without polluting links with query
 * parameters.
 */
export const getGroupContext = cache(async () => {
  const groups = await prisma.pokerGroup.findMany({
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { members: true, games: true } },
    },
  });

  const requested = (await cookies()).get(ACTIVE_GROUP_COOKIE)?.value;
  const active = groups.find((group) => group.id === requested) ?? groups[0] ?? null;

  return {
    active,
    groups,
  };
});

export async function getActiveGroupId() {
  const active = (await getGroupContext()).active;
  if (!active) redirect("/groups");
  return active.id;
}

export async function getActiveGroup() {
  const active = (await getGroupContext()).active;
  if (!active) redirect("/groups");
  return active;
}

export const getActiveGroupOverview = cache(async () => {
  const groupId = await getActiveGroupId();
  const group = await prisma.pokerGroup.findUnique({
    where: { id: groupId },
    include: {
      members: {
        include: { player: true },
        orderBy: { joinedAt: "asc" },
      },
      _count: { select: { games: true, transactions: true } },
    },
  });
  if (!group) throw new Error("The selected poker group no longer exists.");

  const roleRank: Record<string, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };
  group.members.sort(
    (a, b) =>
      (roleRank[a.role] ?? 9) - (roleRank[b.role] ?? 9) ||
      a.player.name.localeCompare(b.player.name),
  );
  return group;
});

export const getAllPlayerOptions = cache(async () => {
  return prisma.player.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
});

export async function playerBelongsToGroup(playerId: string, groupId: string) {
  return Boolean(
    await prisma.groupMember.findUnique({
      where: { groupId_playerId: { groupId, playerId } },
      select: { playerId: true },
    }),
  );
}

export function roleLabel(role: string) {
  return role === "OWNER" ? "Owner" : role === "ADMIN" ? "Admin" : "Member";
}
