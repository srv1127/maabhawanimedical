// Lightweight duplicate detection for medicines.
// Matches on normalized name + barcode + (name+batch). Returns scored matches.

export type DupeCandidate = {
  name?: string | null;
  generic_name?: string | null;
  brand?: string | null;
  batch_no?: string | null;
  barcode?: string | null;
};

export type DupeMatch<T extends DupeCandidate & { id: string }> = {
  item: T;
  score: number; // 0..1
  reasons: string[];
};

export function normalizeName(s?: string | null): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(tab|tablet|tablets|cap|capsule|capsules|syrup|inj|injection|mg|ml|g|mcg)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = new Set(a.split(" ").filter(Boolean));
  const B = new Set(b.split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.max(A.size, B.size);
}

export function findDuplicates<T extends DupeCandidate & { id: string }>(
  candidate: DupeCandidate,
  existing: T[],
  opts: { threshold?: number; limit?: number } = {},
): DupeMatch<T>[] {
  const threshold = opts.threshold ?? 0.7;
  const limit = opts.limit ?? 5;
  const candName = normalizeName(candidate.name);
  const candGen = normalizeName(candidate.generic_name);
  const candBatch = (candidate.batch_no ?? "").trim().toLowerCase();
  const candBar = (candidate.barcode ?? "").trim().toLowerCase();

  const out: DupeMatch<T>[] = [];
  for (const item of existing) {
    const reasons: string[] = [];
    let score = 0;

    const bar = (item.barcode ?? "").trim().toLowerCase();
    if (candBar && bar && candBar === bar) { score = 1; reasons.push("Barcode match"); }

    const nameSim = tokenSimilarity(candName, normalizeName(item.name));
    const genSim = tokenSimilarity(candGen || candName, normalizeName(item.generic_name));
    const nameScore = Math.max(nameSim, genSim * 0.9);
    if (nameScore >= 0.6) {
      reasons.push(nameScore >= 0.95 ? "Same name" : `Similar name (${Math.round(nameScore * 100)}%)`);
      score = Math.max(score, nameScore);
    }

    const batch = (item.batch_no ?? "").trim().toLowerCase();
    if (candBatch && batch && candBatch === batch && nameScore >= 0.5) {
      reasons.push("Same batch");
      score = Math.min(1, score + 0.15);
    }

    if (score >= threshold) out.push({ item, score, reasons });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
