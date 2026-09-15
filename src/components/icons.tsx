import type { SVGProps } from "react";

export type IconName = "sparkles" | "back" | "plus" | "close" | "home" | "cards" | "players" | "stats" | "ledger" | "spade" | "play" | "arrow" | "chevron" | "check" | "clock" | "calendar" | "chips" | "trophy" | "in" | "out" | "trend" | "filter" | "flame" | "list" | "up" | "down" | "right" | "adjust";
const paths: Record<IconName, React.ReactNode> = {
  sparkles: <><path d="M12 2.6c.9 4.7 2.7 6.5 7.4 7.4-4.7.9-6.5 2.7-7.4 7.4-.9-4.7-2.7-6.5-7.4-7.4 4.7-.9 6.5-2.7 7.4-7.4Z" fill="currentColor" stroke="none"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8Z" fill="currentColor" stroke="none"/></>,
  back: <path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>, plus: <path d="M12 5v14M5 12h14"/>, close: <path d="m6 6 12 12M18 6 6 18"/>,
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/></>,
  cards: <><rect x="3.2" y="5" width="12" height="15.5" rx="3"/><path d="M8 3h7.2a3 3 0 0 1 3 3v11M9.2 10l2.3 3-2.3 3-2.3-3Z"/></>,
  players: <><circle cx="9" cy="8" r="3.4"/><path d="M2.8 19.4c.6-3.2 3.1-5 6.2-5s5.6 1.8 6.2 5M16.5 5.2a3 3 0 0 1 0 5.6M18 14.9c2 .7 3.2 2.3 3.6 4.5"/></>,
  stats: <><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="3" width="4" height="18" rx="1"/><rect x="17" y="8" width="4" height="13" rx="1"/></>,
  ledger: <><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h4"/></>,
  spade: <path d="M12 3.2c2.6 4 6.4 6 6.4 9.6a4.1 4.1 0 0 1-5.5 3.9c.2 1.6.7 2.7 1.7 3.6h-5.2c1-.9 1.5-2 1.7-3.6a4.1 4.1 0 0 1-5.5-3.9C5.6 9.2 9.4 7.2 12 3.2Z" fill="currentColor" stroke="none"/>,
  play: <path d="M8 5.6l9.5 5.5a1 1 0 0 1 0 1.8L8 18.4a1 1 0 0 1-1.5-.9V6.5A1 1 0 0 1 8 5.6Z" fill="currentColor" stroke="none"/>,
  list:<path d="M4 6.5h16M4 12h16M4 17.5h16"/>, up:<path d="M12 19V5M6 11l6-6 6 6"/>, down:<path d="M12 5v14M6 13l6 6 6-6"/>, right:<path d="M5 12h14M13 6l6 6-6 6"/>, adjust:<path d="M4 8h13.5M14 4.5 17.5 8 14 11.5M20 16H6.5M10 12.5 6.5 16 10 19.5"/>,
  arrow: <path d="m7.5 16.5 9-9M9.2 7.5h7.3v7.3"/>, chevron:<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>, check:<path d="m5 12.8 4.3 4.2L19 7"/>,
  clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, calendar:<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3"/></>,
  chips:<><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v5c0 4 16 4 16 0V6M4 11v5c0 4 16 4 16 0v-5M8 10v3M16 10v3M8 16v3M16 16v3"/></>,
  trophy:<><path d="M7 3h10v7a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4M17 5h4v3a4 4 0 0 1-4 4M12 15v6M8 21h8"/></>,
  in:<><path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/></>,out:<><path d="M12 15V3m-5 5 5-5 5 5M4 15v5h16v-5"/></>,
  trend:<path d="m3 16 6-6 4 4 8-9M15 5h6v6"/>,filter:<><path d="M3 6h18M6 12h12M9 18h6"/><circle cx="8" cy="6" r="2" fill="var(--bg)"/><circle cx="15" cy="12" r="2" fill="var(--bg)"/></>,
  flame:<path d="M13 2c1 6-5 7-3 11 2 1 4-2 4-4 4 3 6 6 4 10-3 5-12 3-13-2-1-4 2-7 4-9-1 4 1 4 1 4s-1-6 3-10Z"/>,
};
export function Icon({ name, size = 20, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{paths[name]}</svg>;
}
