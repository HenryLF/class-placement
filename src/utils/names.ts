// Alphabetical order for everything listed by name. Ignores case and
// accents, and reads numbers as numbers: "Room 2" comes before "Room 10".
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export const byName = (a: { name: string }, b: { name: string }) =>
  collator.compare(a.name, b.name);
