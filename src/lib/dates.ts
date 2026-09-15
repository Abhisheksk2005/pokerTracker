/** Date helpers. Dates are stored at local noon so a timezone shift never moves the calendar day. */

export function parseDateInput(value: string | null | undefined): Date {
  if (!value) return atNoon(new Date());
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? atNoon(new Date()) : atNoon(d);
}

export function atNoon(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

export function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateLong(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function fmtDayHeading(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "Saturday 8th August" style default name for a new night. */
export function suggestGameName(d: Date): string {
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const day = d.getDate();
  return `${weekday} ${day}${ordinal(day)} ${month}`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
