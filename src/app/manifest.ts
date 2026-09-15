import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PKRTrackr — Poker nights together",
    short_name: "PKRTrackr",
    description: "Group poker nights, live game bank, player stats and a date-by-date money ledger.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0d",
    theme_color: "#0b0b0d",
    categories: ["games", "finance", "lifestyle"],
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon/512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
