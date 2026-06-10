export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const inr = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(v);
};

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtDateTime = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

export const daysUntil = (d: string | null | undefined): number | null => {
  if (!d) return null;
  const diff = (new Date(d).getTime() - Date.now()) / 86400000;
  return Math.floor(diff);
};
