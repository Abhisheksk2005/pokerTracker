import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Nav } from "@/components/nav";
import { authMode } from "@/lib/auth";
import { getGroupContext } from "@/lib/groups";
import "./fonts.css";
import "./globals.css";
import "./ios-theme.css";

export const metadata: Metadata = {
  title: { default: "PKRTrackr", template: "%s · PKRTrackr" },
  description: "Group poker nights, live game bank, player stats and a date-by-date money ledger.",
  applicationName: "PKRTrackr",
  appleWebApp: { capable: true, title: "PKRTrackr", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The unlock screen renders before sign-in: no navigation, no group data.
  const locked = (await headers()).get("x-pkr-pathname") === "/unlock";
  const active = locked ? null : (await getGroupContext()).active;
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          {locked ? null : (
            <Nav
              canLock={authMode() === "passcode"}
              activeGroup={active ? { id: active.id, name: active.name, accent: active.accent, games: active._count.games, members: active._count.members } : null}
            />
          )}
          <main className="app-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
