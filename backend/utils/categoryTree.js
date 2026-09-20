import Category from "../models/Category.js";

/*
 * The category tree has up to three levels (Category → Subcategory → Sub-subcategory).
 * This small in-memory index answers "which categories are under X" and "what is above X"
 * without walking the database each time. It refreshes every 30 s or when categories change.
 */
export const MAX_CATEGORY_DEPTH = 3;
const TTL_MS = 30 * 1000;
let cached = null;

export function clearCategoryIndex() {
  cached = null;
}

export async function loadCategoryIndex() {
  if (cached && Date.now() - cached.at < TTL_MS) return cached;
  const rows = await Category.find().select("parentCategory commissionRate").lean();
  const byId = new Map(
    rows.map((row) => [
      String(row._id),
      { parent: row.parentCategory ? String(row.parentCategory) : null, rate: row.commissionRate },
    ]),
  );
  const children = new Map();
  for (const [id, node] of byId) {
    if (!node.parent) continue;
    if (!children.has(node.parent)) children.set(node.parent, []);
    children.get(node.parent).push(id);
  }

  /** The category and everything above it, root first. */
  const ancestors = (id) => {
    const path = [];
    const seen = new Set();
    for (let current = id ? String(id) : null; current && byId.has(current);) {
      if (seen.has(current)) break; // Defensive: never loop on bad data
      seen.add(current);
      path.unshift(current);
      current = byId.get(current).parent;
    }
    return path;
  };

  /** The category and everything below it. */
  const descendants = (id) => {
    const result = [];
    const queue = [String(id)];
    while (queue.length) {
      const current = queue.shift();
      if (result.includes(current)) continue;
      result.push(current);
      queue.push(...(children.get(current) ?? []));
    }
    return result;
  };

  /** Levels below the category (0 for a leaf). */
  const height = (id) => {
    const kids = children.get(String(id)) ?? [];
    return kids.length ? 1 + Math.max(...kids.map(height)) : 0;
  };

  cached = { at: Date.now(), byId, ancestors, descendants, height };
  return cached;
}

/**
 * Turns per-category counts (grouped by a product's deepest category) into totals that also
 * include everything underneath, so "Skincare" counts the products in "Skincare → Serums".
 */
export function rollUpCounts(index, rows, keys) {
  const totals = new Map();
  for (const row of rows) {
    for (const id of index.ancestors(row._id)) {
      const entry = totals.get(id) ?? Object.fromEntries(keys.map((key) => [key, 0]));
      for (const key of keys) entry[key] += row[key] ?? 0;
      totals.set(id, entry);
    }
  }
  return totals;
}

/** Group key for a product's most specific category. */
export const DEEPEST_CATEGORY = { $ifNull: ["$subcategory", "$category"] };
