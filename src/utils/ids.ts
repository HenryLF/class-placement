// Short, display-only form of a UUID (e.g. "3f9a1c2e"). Not unique enough to
// look records up by; always store and compare full ids.
export const shortId = (id: string) => id.slice(0, 8);
