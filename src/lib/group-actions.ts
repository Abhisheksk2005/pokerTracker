"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ACTIVE_GROUP_COOKIE, getActiveGroupId } from "@/lib/groups";

type FormState = { error?: string; ok?: true; message?: string };

function str(fd: FormData, key: string) {
  const value = fd.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function safeReturnTo(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/groups";
}

async function setActiveGroupCookie(groupId: string) {
  const store = await cookies();
  store.set(ACTIVE_GROUP_COOKIE, groupId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

async function uniqueInviteCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomBytes(4).toString("hex").toUpperCase();
    const exists = await prisma.pokerGroup.findUnique({ where: { inviteCode: code } });
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique invite code.");
}

export async function switchGroup(fd: FormData) {
  const groupId = str(fd, "groupId");
  const group = await prisma.pokerGroup.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) return;

  await setActiveGroupCookie(group.id);
  revalidatePath("/", "layout");
  redirect(safeReturnTo(str(fd, "returnTo")));
}

export async function createGroup(_prev: unknown, fd: FormData): Promise<FormState | void> {
  const name = str(fd, "name");
  const description = str(fd, "description");
  const ownerId = str(fd, "ownerId");
  const ownerName = str(fd, "ownerName");
  const accent = str(fd, "accent") || "#ff6a4d";

  if (!name) return { error: "Give the group a name." };
  if (!ownerId && !ownerName) return { error: "Choose an owner profile or enter a new profile name." };

  const existingOwner = ownerId
    ? await prisma.player.findUnique({ where: { id: ownerId }, select: { id: true } })
    : null;
  if (ownerId && !existingOwner) return { error: "That owner profile no longer exists." };
  const inviteCode = await uniqueInviteCode();

  const group = await prisma.$transaction(async (tx) => {
    const isFirstGroup = (await tx.pokerGroup.count()) === 0;
    const owner =
      existingOwner ??
      (await tx.player.create({
        data: { name: ownerName, active: true, notes: "Group owner" },
        select: { id: true },
      }));
    const profiles = isFirstGroup
      ? await tx.player.findMany({ select: { id: true, active: true } })
      : [{ id: owner.id, active: true }];

    const created = await tx.pokerGroup.create({
      data: {
        name,
        description: description || null,
        accent,
        inviteCode,
        members: {
          create: profiles.map((profile) => ({
            playerId: profile.id,
            role: profile.id === owner.id ? "OWNER" : "MEMBER",
            active: profile.active,
          })),
        },
      },
    });

    // A newly named first group adopts preserved pre-group poker history.
    if (isFirstGroup) {
      await tx.game.updateMany({ where: { groupId: null }, data: { groupId: created.id } });
      await tx.transaction.updateMany({ where: { groupId: null }, data: { groupId: created.id } });
    }

    return created;
  });

  await setActiveGroupCookie(group.id);
  revalidatePath("/", "layout");
  redirect("/groups");
}

export async function joinGroup(_prev: unknown, fd: FormData): Promise<FormState | void> {
  const inviteCode = str(fd, "inviteCode").toUpperCase().replace(/\s+/g, "");
  const playerId = str(fd, "playerId");
  if (!inviteCode) return { error: "Enter an invite code." };
  if (!playerId) return { error: "Choose who is joining." };

  const [group, player] = await Promise.all([
    prisma.pokerGroup.findUnique({ where: { inviteCode }, select: { id: true, name: true } }),
    prisma.player.findUnique({ where: { id: playerId }, select: { id: true, name: true } }),
  ]);
  if (!group) return { error: "That invite code is not valid." };
  if (!player) return { error: "That player no longer exists." };

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_playerId: { groupId: group.id, playerId: player.id } },
  });
  if (existing) {
    await setActiveGroupCookie(group.id);
    revalidatePath("/", "layout");
    redirect("/groups");
  }

  await prisma.groupMember.create({
    data: { groupId: group.id, playerId: player.id, role: "MEMBER", active: true },
  });
  await setActiveGroupCookie(group.id);
  revalidatePath("/", "layout");
  redirect("/groups");
}

export async function updateMemberRole(fd: FormData) {
  const groupId = await getActiveGroupId();
  const playerId = str(fd, "playerId");
  const role = str(fd, "role");
  if (!playerId || (role !== "ADMIN" && role !== "MEMBER")) return;

  const member = await prisma.groupMember.findUnique({
    where: { groupId_playerId: { groupId, playerId } },
  });
  if (!member || member.role === "OWNER") return;

  await prisma.groupMember.update({
    where: { groupId_playerId: { groupId, playerId } },
    data: { role },
  });
  revalidatePath("/groups");
}

export async function removeGroupMember(fd: FormData) {
  const groupId = await getActiveGroupId();
  const playerId = str(fd, "playerId");
  if (!playerId) return;

  const member = await prisma.groupMember.findUnique({
    where: { groupId_playerId: { groupId, playerId } },
  });
  if (!member || member.role === "OWNER") return;

  await prisma.groupMember.delete({
    where: { groupId_playerId: { groupId, playerId } },
  });
  revalidatePath("/", "layout");
}

export async function regenerateInvite(fd: FormData) {
  const groupId = await getActiveGroupId();
  if (str(fd, "groupId") !== groupId) return;

  await prisma.pokerGroup.update({
    where: { id: groupId },
    data: { inviteCode: await uniqueInviteCode() },
  });
  revalidatePath("/groups");
}
