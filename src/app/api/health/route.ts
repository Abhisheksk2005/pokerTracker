import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + database reachability, for uptime checks and container health probes. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", time: new Date().toISOString() });
  } catch {
    return Response.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
