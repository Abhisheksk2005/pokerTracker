import { brandIcon } from "@/lib/brand-icon";

const SIZES = new Set(["192", "512", "512-maskable"]);

/** Home-screen icons referenced by the web manifest. */
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const maskable = size.endsWith("-maskable");
  const response = brandIcon(Number.parseInt(size, 10), { rounded: !maskable, maskable });
  response.headers.set("Cache-Control", "public, max-age=604800, immutable");
  return response;
}
