# AGENTS.md

Guide for AI coding agents working on this repository. Read it before
changing code. [README.md](README.md) has more detail for people; this file
covers what you need to make correct changes.

## Goal

**class-placement** is a browser app that helps a teacher plan where students
sit in a classroom. It runs entirely in the browser, with no backend.

- **Room layouts** (Classroom tab and the white area): a grid of cells.
  A click on an empty cell adds a single-seat table; tables are dragged to
  move or swap them, and onto the bin (shown at the left end of the
  whiteboard row only during a table drag) to delete them. The whiteboard
  has its own row above the grid (a third of a cell's height); it is dragged
  sideways and resized by its edges.
- **Students** (Students tab): classes of students. Each student has a
  name, a gender, an optional score (1–5) and a list of students they must
  not sit with (incompatibilities).
- **Placement** (Placement tab): seats the loaded class on the loaded
  room's tables, keeping incompatible students apart and balancing gender
  and score. Seated tables show the student's name; broken constraints show
  as colored arrows.

The UI is in English and French.

## Stack

- **Bun 1.4**: runtime, dev server, bundler and test runner. Don't add
  Node, Vite, Webpack, Jest or Vitest.
- **Preact 10** (`jsxImportSource: preact`), not React. Hooks come from
  `preact/hooks`.
- **Zustand 5** stores with the `persist` middleware (localStorage).
- **TypeScript 7** in strict mode, with `noUncheckedIndexedAccess`. Map and
  array lookups return `T | undefined`.
- **CSS Modules** (`*.module.css`) plus global design tokens.
- No UI library and no router.

## Commands

```bash
bun install
bun run dev          # http://localhost:3000 (BUN_PORT to change); refresh manually
bun run build        # dist/
bunx tsc --noEmit    # type-check (includes tests/)
bun run test         # unit tests, <1s
bun run test:e2e     # real Chromium via puppeteer-core (CHROME_PATH, default /usr/bin/chromium)
bun run test:all
```

**Definition of done:** `tsc` is clean, `bun run test` and
`bun run test:e2e` pass, and the change comes with new tests (see
[Testing](#testing)).

## Layout

```
index.ts                      Dev server: Bun.serve + HTML import, hmr: false (see Gotchas)
global.d.ts                   Types for *.module.css imports
src/
  index.html / index.tsx      Entry; <App> = ClassRoom + Pannel (given the pages as tabs) + DragPreview
  style/global.css            Design tokens (CSS vars), theme overrides, base button/input/select/textarea
  style/ui.module.css         Shared panel classes, imported as `ui`
  style/furniture.module.css  Table/whiteboard look + drag-source rules, imported as `f`
  i18n/en.ts, fr.ts, index.ts Translations; useT() / getT(); language store
  store/useClassRoom.ts       Room layouts (persisted, v2)
  store/useStudents.ts        Students + student classes (persisted, v3) + pure helpers
  store/profiles.ts           removeProfile(), shared by both stores' deleteClass
  store/usePlacements.ts      Placement options, seatings, switched-off tables (persisted, v2); useSeating()
  store/useUI.ts              Panel open/closed, color theme (persisted); sets <html data-theme>
  store/backup.ts             Export / import of rooms, and of classes + students, as separate JSON files
  utils/dnd.ts                Pointer-events drag and drop
  utils/placement.ts          Seating algorithm (pure): place(), findViolations(), cost model
  utils/ids.ts                shortId() for display
  utils/names.ts              byName: the alphabetical order of every list; sameName
  utils/pronote.ts            Pronote CSV export parser (pure): decodeText(), parsePronote()
  components/                 Atomic design, see Conventions > Components
    atoms/
      GenderSelect.tsx        Gender <select> (`short` = one-letter labels)
      ScoreSelect.tsx         Score <select>: none, 1–5
      LanguageSelect.tsx      UI language <select>
      TableShape.tsx          A table's look (theme colors, plus the seated student's name); width via className
      Whiteboard.tsx          The whiteboard's look; size via className
    molecules/
      Modal.tsx               <Modal> + <ModalClose>: every <dialog> in the app
      ChoiceDialog.tsx        Multi-answer question, built on Modal
      ProfilePicker.tsx       Load / rename / new / copy / delete section
      InfoButton.tsx          ⓘ button opening an explanation in a Modal (`icon`, `label` to override)
    organisms/
      ClassRoom.tsx           The room: whiteboard row, grid cells, tables, violation arrows
      Pannel.tsx              Collapsible side panel; renders the `tabs` it is given
      HelpButton.tsx          "?" in the panel header: the app tutorial (`help.steps` in i18n). Workflow only; don't repeat hints
      DragPreview.tsx         Item following the pointer during a drag
      StudentTable.tsx        Inline-editable student rows (🔍 details, 🗑 delete)
      StudentCard.tsx         Modal: edit every field of one student
      StudentPicker.tsx       Modal: add students from other classes
      ImportStudentsDialog.tsx Modal: paste names, one student per line
      PronoteImportDialog.tsx Modal: pick a Pronote CSV, preview, import (skips names already in the class)
      DeleteStudentDialog.tsx "This class only / All classes" question
    pages/
      ClassRoomTab.tsx        Layout picker, grid size, table tools
      StudentsTab.tsx         Student-class picker, student list, dialogs
      PlacementTab.tsx        Constraint options (each with an ⓘ help modal), Place / Clear, unplaced + violation summary
      OptionsTab.tsx          ⚙ tab: language, theme, JSON import / export, About
tests/
  setup.ts                    happy-dom preload (unit tests only)
  helpers.ts                  resetStores()
  fixtures/                   Sample files; the Pronote CSV has made-up students (never commit real ones)
  unit/*.test.ts              Store logic, i18n, helpers
  e2e/server.ts, browser.ts   Start the dev server on a free port; puppeteer helpers
  e2e/*.e2e.test.ts           Browser scenarios
```

"Pannel" is the established spelling in file names, CSS classes and i18n
keys. Keep it.

## Data model and rules

### Room layouts ([useClassRoom.ts](src/store/useClassRoom.ts))

```ts
ClassProfile { id, name, rows, cols, tables: { id, row, col }[], board: { col, span } }
```

- A table fills exactly one cell. At most one table per cell.
- Moving a table onto another swaps them.
- `setSize` never shrinks the grid past a placed table and clamps to 1–30.
- The whiteboard is always above the grid. `board` is its left edge and
  width in columns, in half-column steps (`fitBoard` snaps and keeps it
  inside the grid; `dragBoard` computes a move or edge resize). Its drag is
  plain pointer handling in `ClassRoom.tsx`, not `dnd.ts`: nothing is
  dropped, and it's saved on release. v2 rooms with the board at the
  bottom are flipped on migration, so tables keep facing it.
- There is always at least one layout. Actions apply to the loaded one
  (`currentId`).

### Students ([useStudents.ts](src/store/useStudents.ts))

```ts
Student      { id, name, gender: "female" | "male" | "other", score: 1..5 | null, frontRow: boolean, incompatible: string[] }
StudentClass { id, name, studentIds: string[] }
```

These are deliberate design decisions. Don't reverse them without asking:

- **Students are stored once; classes reference them by id.** One student
  can be in several classes. The membership link is stored **only** on
  `StudentClass.studentIds`. "Which classes is X in?" is computed with
  `classesByStudent()` / `useClassesByStudent()`. Don't add `classIds` to
  `Student`: storing both sides means every write has to keep them in sync.
- **Incompatibility is symmetric** and stored on both students.
  `saveStudent` is the only writer of `incompatible` and mirrors every
  change. On load, persist `merge` runs `repairIncompatibilities`.
- **No orphans.** A student in no class is deleted and scrubbed from every
  `incompatible` list. Use the helpers `purge()` and `orphans()`.
- **Score** is `1..5 | null`. Always pass values through `toScore()`.
  `updateStudent` rejects invalid scores and genders.
- **Copying a class** (`duplicateClass`) shares students, never clones them.
- **Everything listed by name is sorted with `byName`**
  ([names.ts](src/utils/names.ts)): case- and accent-insensitive, numbers
  as numbers. The student list (`StudentTable`) holds its order while the
  pointer is over it or focus is in it, so a row never moves while its name
  is typed or under a click; it re-sorts when the user moves away.
- **Store helpers:** `updateCurrentClass()` applies a change to the loaded
  class; `removeProfile()` ([profiles.ts](src/store/profiles.ts)) is the
  "delete, but always keep one loaded" rule for both stores.
- **Actions:** `saveStudent` (full record, adds the student to the loaded
  class if new), `updateStudent` (name, gender, score and frontRow only),
  `removeFromClass`, `deleteStudent` (all classes), `importStudents({ name, gender? }[])`,
  `addToClass`, plus class actions (`newClass`, `loadClass`, `renameClass`,
  `deleteClass`, `duplicateClass`).

### Placements ([usePlacements.ts](src/store/usePlacements.ts), [placement.ts](src/utils/placement.ts))

```ts
PlacementOptions { gender, incompatible, front, frontRow: { enabled, weight: 1 | 4 | 16 },
                   score: { enabled, weight, rule: "spread" | "pairMean" }, diagonal: 0 | 0.25 | 0.5 | 1 }
Placement        { roomId, classId, seats: Record<tableId, studentId> }
store            { options, placements, disabledTables: Record<key, tableId[]>, showMarks }
```

- **Separate from rooms and classes.** One placement per room + class,
  keyed `placementKey(roomId, classId)`. Options are global.
- **A student belongs to a table id**, not to a cell. Dragging tables
  (move, swap) therefore moves students too; that's the manual adjustment.
- **Stale seats are filtered on read** (`resolveSeating`), never rewritten:
  removed tables and students who left the class are dropped, and new
  members are listed as unplaced. Placements of deleted rooms or classes
  stay in storage, unused.
- **Switched-off tables** (a click on a table; `toggleTable`) are per room +
  class, kept apart from `placements` so Clear keeps them. `useSeating()`
  returns `room` without them; pass that to `place()`. A student saved on a
  table that is now off shows as unplaced, and comes back if it's switched
  on again.
- **`dnd.ts` swallows the click** that follows a drag, so dragging a table
  never toggles it, and dropping one on an empty cell doesn't also add a
  table there. Double-click no longer deletes a table (it would toggle
  twice); the bin does.
- **Cost model** (`pairCost`): summed over neighbor pairs. Side neighbors
  weigh 1 and diagonals weigh `diagonal`.
  - Incompatible pair: `weight`.
  - Two female or two male students: `weight`. `other` is neutral.
  - Score: `weight × raw / D²`, where `raw` is `max(0, (a−m)(b−m))`
    ("spread") or `((a+b)/2 − m)²` ("pairMean"), and `D` is the largest
    distance to the mean `m`. Students with no score are ignored and left
    out of `m`.
  - Plus, per student: `seatWeight × far(seat)`, where `seatWeight` is
    front's weight (every student) + frontRow's weight (front-row students
    only). `far` is `boardDistances` (Euclidean, from the nearest point
    of the whiteboard: 0 for first-row tables under it) divided by `max + 1`, so it stays below 1, the cost of
    being unplaced.
- **Search**: simulated annealing over swaps, with extra "unplaced" slots
  when there are more students than tables. With no constraint enabled, it
  is a plain shuffle. Pass `seededRandom(seed)` in tests.
- **Violations** (`findViolations`) are for display and don't follow the
  cost exactly: a score violation is two neighbors on the same side of the
  mean, each at least 1 point from it, whichever rule is chosen. A
  frontRow violation has no `b`: a front-row student with a table closer to
  the board that is empty or holds a non-front-row student. `showMarks`
  hides the arrows only, not the summary.

### Persistence

| Key | Store | Version |
|---|---|---|
| `class-placement` | useClassRoom | 3 |
| `class-placement-students` | useStudents | 3 |
| `class-placement-placements` | usePlacements | 2 |
| `class-placement-ui` | useUI | – |
| `class-placement-lang` | useI18n | – |

When you change a persisted shape, bump `version`, handle the old shape in
`migrate`, and add a unit test that loads old data. Imported files go
through the same `migrate`, but a new field also needs handling in
`toRoom` / `toClasses` in [backup.ts](src/store/backup.ts), which rebuild
every record field by field.

**Export / import** ([backup.ts](src/store/backup.ts)) works on rooms and
on classes separately: `createExport("rooms" | "classes")` writes that
store's slice with its persist `version`. Placements, settings and the
loaded ids aren't exported: a placement ties one room to one class, so it
means nothing once either travels alone. **Import adds, never replaces**:
`parseImport` migrates, validates and repairs the file (no orphans,
symmetric incompatibilities), giving every room, table, class and student a
fresh id, and `applyImport` adds them through `addRooms` / `addClasses`,
which load the first one. It also reads the all-in-one exports of older
versions (format 1), keeping only their rooms and classes.

localStorage was chosen over IndexedDB on purpose: the data is small, and synchronous hydration
means no loading states. Switching later is a `storage:` option change,
explained in the README.

## Conventions

- **Components (atomic design).** Put each component, with its sibling `*.module.css`, in the lowest level that fits:
  - `atoms/`: one visual element. Data comes in through props: don't read or write store state. Types, constants and pure helpers from `store/` are fine, and so are `useT` and the language store.
  - `molecules/`: generic combinations of elements, reusable anywhere, with the same no-store-state rule.
  - `organisms/`: feature blocks wired to stores or drag and drop.
  - `pages/`: the panel tabs, composing organisms.
  - Import only from your own level or lower. That's why `index.tsx` passes the pages to `<Pannel tabs>`. Before writing markup, check whether an atom or molecule already covers it.
- **i18n: no hard-coded user-facing text.**
  - Add every key to `en.ts` first, then `fr.ts`; `fr` is typed as `Translations`.
  - Reuse before adding: `common.*` holds shared words (Cancel, Close, Save, Delete, "(unnamed)") and `students.columns.*` the student field names.
  - Strings that contain a value are functions, e.g. `(count: number) => …`.
  - Use `useT()` in components and `getT()` elsewhere.
  - French punctuation uses a non-breaking space (U+00A0) before `? : ! ; »` and after `«`. A unit test enforces it.
  - Don't infer gender in French wording (the app already avoids "il/elle").
- **Styles:**
  - Colors and radii come from the CSS variables in `global.css`; don't hard-code hex values in modules.
  - Themes (`indigo` = `:root`, `light`, `chalk`) override those variables under `:root[data-theme=…]`. A new color token needs a value in every theme where the default doesn't read well. Room (`--paper`, `--grid-line`, `--highlight`) and table (`--table`, `--table-border`, `--table-text`) colors are set per theme.
  - Reusable classes go in `ui.module.css`, imported as `ui`; the table/whiteboard look in `furniture.module.css`, imported as `f`; component-specific CSS goes in a sibling module, imported as `s`.
  - The panel can be as narrow as 320px. Check layouts there (there is an e2e test for it). Below 768px it overlays the room (fixed, full width up to 420px) instead of shrinking it.
- **Dialogs:** always use `<Modal>` ([molecules/Modal.tsx](src/components/molecules/Modal.tsx)), never a raw `<dialog>`. It opens with `showModal()`, labels the dialog with its `title` (`data-testid="dialog-title"`), and closes on Escape and on a backdrop click. Close buttons are `<ModalClose>` (optional `onClick` runs first). With `onSubmit`, the body is a `<form>`: forms keep a draft and commit in `onSubmit`, and every other way of closing discards it. For a question with several answers, use `ChoiceDialog`; for an explanation behind an ⓘ button, `InfoButton`.
- **Drag and drop:** use `useDraggable(payload)` and `useDropTarget(id, { accepts, onDrop })` from `utils/dnd.ts`, never HTML5 `draggable`, which doesn't work on touch screens. Give drag sources the `f.draggable` class (grab cursor, `touch-action: none`).
- **Zustand selectors:** select one value at a time (`useStore((s) => s.x)`). A selector must not return a new object, array or Map on every call, or the component re-renders forever in v5. Derive values with `useMemo` over a selected value instead (see `useClassesByStudent`).
- **Test hooks:** interactive elements used by tests carry `data-testid`. Add one when you add UI.
- **Code style:** match the surrounding code. Keep comments short and explain *why*, not *what*.
- **No dead code:** `tsc` runs with `noUnusedLocals` and `noUnusedParameters`. Delete unused files, assets, CSS classes and i18n keys too; `tsc` doesn't catch those.

## Testing

Every change adds or updates tests. Don't leave throwaway scripts outside
`tests/`.

- **Unit tests** (`tests/unit`): store actions and pure functions.
  - Call `resetStores()` in `beforeEach`.
  - Run them through `bun run test`. The script preloads happy-dom; a bare `bun test` does not.
  - For migrations, write old JSON to localStorage, then `await store.persist.rehydrate()`.
- **E2E tests** (`tests/e2e`): user flows in real Chromium.
  - `openApp()` gives a page with empty storage and the UI in English, and accepts `confirm()` automatically.
  - Select elements by `data-testid` or `data-drop-id`. CSS-module class names are hashed, so never use them.
  - Assert on persisted state with `stored(page, key)`.
  - `screenshot(page, name)` saves to `.e2e-screenshots/` (git-ignored). Look at the screenshots after UI changes.
- **Check that a new test can fail:** break the code on purpose once and confirm the test catches it.

## Gotchas

- **HMR is off** in [index.ts](index.ts). Bun 1.4.0's HMR bundler drops
  `*.module.css` imports ("import_X_module is not defined"). `bun --watch`
  restarts the server, but the browser needs a manual refresh.
- **Hydration is synchronous**, inside `create()`. A persist callback can't
  refer to the store variable yet, so use `merge` or `migrate`, not
  `onRehydrateStorage` + `setState`.
- **The `react` path alias in tsconfig is needed:** zustand's hooks import `react`, and Bun resolves it to `preact/compat` through that alias, both at runtime and in `bun build`.
- **TypeScript 7 + Preact types** reject `title` on a `<div>`. Use
  `aria-label`, or visible text.
- **A `<dialog>` rendered inside a `.section`** inherits styles from
  descendant selectors. Section rules use `> h2` for this reason.
- **Controlled `<input type="number">`** loses a typed decimal point. That's
  why scores use a `<select>`.
- **`onChange` on a text input fires on every keystroke**, like `onInput`:
  zustand loads `preact/compat`, which rewrites it. To act when editing ends
  (e.g. trimming), use `onBlur`.

## Roadmap

1. **Seating algorithm**: done (see [Placements](#placements)). Possible
   follow-ups: pruning placements of deleted rooms/classes, locking a student
   to a table before placing.
2. **Move to IndexedDB** only if large data arrives (student photos, a
   placement history).
