import { useI18n } from "../src/i18n";
import { useClassRoom } from "../src/store/useClassRoom";
import { usePlacements } from "../src/store/usePlacements";
import { useStudents } from "../src/store/useStudents";
import { useUI } from "../src/store/useUI";

/** Empties localStorage and puts every store back in its initial state. */
export function resetStores() {
  localStorage.clear();
  for (const store of [useI18n, useClassRoom, useStudents, usePlacements, useUI] as const) {
    // Each store's own type; the union can't be called directly.
    (store as typeof useUI).setState(
      (store as typeof useUI).getInitialState(),
      true,
    );
  }
}
