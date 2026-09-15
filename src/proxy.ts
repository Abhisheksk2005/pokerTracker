import { NextResponse, type NextRequest } from "next/server";
import { authMode, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Gate every page and Server Action behind the group passcode. Server Actions
 * POST to page URLs, so matching pages protects writes too.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.set("x-pkr-pathname", pathname);
  const pass = () => NextResponse.next({ request: { headers } });

  if (pathname === "/unlock") return pass();

  const mode = authMode();
  if (mode === "open") return pass();
  if (mode === "passcode" && (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value))) {
    return pass();
  }

  // Server Actions and other writes get a hard 401 rather than an HTML redirect.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new NextResponse("Locked", { status: 401 });
  }
  const unlock = new URL("/unlock", request.url);
  if (pathname !== "/") unlock.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(unlock);
}

export const config = {
  matcher: [
    // Everything except framework assets, public files, icons, manifest and the health probe.
    "/((?!_next/static|_next/image|api/health|app-icon|icon|apple-icon|manifest.webmanifest|fonts/|robots.txt).*)",
  ],
};
