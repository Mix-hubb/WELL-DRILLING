export function fmtDate(
  d?: string | null,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }
): string {
  if (!d) return "-";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("th-TH", options);
  } catch {
    return "-";
  }
}

export function fmtShortDate(d?: string | null): string {
  if (!d) return "";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("th-TH", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
