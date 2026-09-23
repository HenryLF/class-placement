// Alphabetical order for everything listed by name. Ignores case and
// accents, and reads numbers as numbers: "Room 2" comes before "Room 10".
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export const byName = (a: { name: string }, b: { name: string }) =>
  collator.compare(a.name, b.name);

/** Same name for `byName`: "chloé" matches "Chloe". */
export const sameName = (a: string, b: string) => collator.compare(a.trim(), b.trim()) === 0;
