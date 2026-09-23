// Helpers shared by stores that hold named profiles (room layouts, student
// classes) and keep one of them loaded.

interface Profile {
  id: string;
}

/**
 * `profiles` without `id`. There is always at least one profile loaded: if
 * the loaded one goes, the first remaining one is loaded, and if none
 * remain, `create()` makes a fresh one.
 */
export function removeProfile<P extends Profile>(
  profiles: Record<string, P>,
  id: string,
  currentId: string,
  create: () => P,
): { profiles: Record<string, P>; currentId: string } {
  const rest = { ...profiles };
  delete rest[id];
  const remaining = Object.keys(rest);
  if (remaining.length === 0) {
    const fresh = create();
    return { profiles: { [fresh.id]: fresh }, currentId: fresh.id };
  }
  return { profiles: rest, currentId: currentId === id ? remaining[0]! : currentId };
}
