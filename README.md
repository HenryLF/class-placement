# class-placement

A browser app for drawing classroom seating plans. Place tables on a grid,
position the whiteboard, and keep several named classes saved in the browser.

Built with [Bun](https://bun.com), [Preact](https://preactjs.com) and
[Zustand](https://zustand.docs.pmnd.rs). No backend: all data lives in
`localStorage`.

## Getting started

```bash
bun install
bun run dev     # dev server with file watching, http://localhost:3000
bun run build   # production bundle in dist/
bun run test    # unit tests (fast, no browser)
bun run test:e2e  # browser tests (needs Chromium, see Testing)
```

Set `BUN_PORT` to use another port.

**Deploying:** [vercel.json](vercel.json) deploys `dist/` as a static site
on Vercel. Vercel installs and builds with Bun, then serves the files. Hashed
assets are cached for a year, and `index.html` is always revalidated.

> **Hot reload is disabled.** Bun 1.4.0's HMR bundler drops `*.module.css`
> imports (`ReferenceError: import_ClassRoom_module is not defined`), so
> [index.ts](index.ts) serves the app with `hmr: false`. `bun --watch` still
> restarts the server on save; refresh the browser to see changes. Turn HMR
> back on once a Bun release fixes this.

## Features

- **Grid**: a rows × columns room (1–30 each). The grid can't shrink past a
  placed table.
- **Tables**: drag the "new table" tile from the panel onto an empty cell.
  Drag a table to move it; dropping on another table swaps them. Remove a
  table by dropping it on the bin. Clicking a table switches it off for the
  loaded class's placement (greyed out; nobody is seated there).
- **Whiteboard**: sits above or below the grid; drag it to the other side.
- **Room layouts**: create, rename, load and delete named layouts. Every
  change is saved automatically.
- **Students**: classes of students, each listed as a table. Name, gender
  and score (none, or 1–5) are edited directly in the row and saved as you
  type. 🔍 opens the student card, which edits every field (including who
  they are incompatible with) and saves on Save. 🗑 asks whether to remove
  the student from this class only or from all classes; for a student in no
  other class it just offers Delete. **Add multiple** imports a pasted list
  of names, one student per line, into the loaded class. One student can
  belong to several classes. Each student shows a short ID (`#3f9a1c2e`) to tell
  apart students with the same name. **Copy** duplicates a class; the copy
  shares the same students. **Add from another class** lists every other
  student with their ID and current classes, filterable by name or ID.
- **Placement**: seats the loaded class on the loaded room's tables. Each
  constraint can be switched on or off and given a weight: alternate
  genders, separate incompatible students, and balance scores (either
  spread strong and weak students apart, or pair strong with weak; ⓘ
  explains the difference). Diagonal neighbors count with a chosen weight.
  **Fill the front first** favors tables close to the middle of the
  whiteboard, and **front-row students** (a checkbox in the student card,
  shown as ⬆ in the list) are pulled to the front more strongly.
  With no constraint, seats are random. Seated tables show the student's
  name, and colored arrows point at the neighbor of each broken
  constraint (or at the board, for a front-row student who isn't at the
  front); a checkbox hides them. Drag tables to adjust by hand: students move with their
  table. If there are more students than tables, the unplaced ones are
  listed. Each room + class pair keeps its own placement.
- **Drag and drop** works with mouse, touch and pen. Press Escape to cancel
  a drag.
- **Collapsible panel**: hide the side panel to give the grid the full width.
- **Options** (⚙ tab):
  - **Language**: English (default) or French.
  - **Theme**: Indigo (default), Light or Chalkboard, which change the room's and the panel's colors.
  - **Import / export**: export downloads everything in one JSON file (rooms, classes, students, placements, settings). Import replaces all current data with such a file, after a confirmation. Files from older versions are migrated.

## Project structure

```
index.ts                  Dev server (Bun.serve, HMR off)
global.d.ts               Module types for *.module.css and *.png
src/
  index.html              HTML entry
  index.tsx               App root: ClassRoom + Pannel (with the tabs) + DragPreview
  assets/                 Images (imported via the @assets/* alias)
  style/
    global.css            Design tokens (CSS variables) and base elements
    ui.module.css         Shared classes: section, field, row, hint, table…
    furniture.module.css  Look of tables and the whiteboard, drag sources
  components/             Atomic design: atoms < molecules < organisms < pages
    atoms/
      GenderSelect.tsx    Gender picker (full or one-letter labels)
      ScoreSelect.tsx     Score picker: none, 1–5
      LanguageSelect.tsx  UI language picker
      TableShape.tsx      A table's look
      Whiteboard.tsx      The whiteboard's look
    molecules/
      Modal.tsx           Every popup: <Modal> and <ModalClose>
      ChoiceDialog.tsx    Modal question with several answers
      ProfilePicker.tsx   Load / rename / new / copy / delete a named profile
    organisms/
      ClassRoom.tsx       Grid, cells, tables and whiteboard zones
      Pannel.tsx          Collapsible side panel, tab bar, language picker
      DragPreview.tsx     Item that follows the pointer during a drag
      StudentTable.tsx    Students of a class, one editable row each
      StudentCard.tsx     Popup editing every field of a student
      StudentPicker.tsx   Popup adding students from other classes
      ImportStudentsDialog.tsx  Paste names, one student per line
      DeleteStudentDialog.tsx   "This class only" / "All classes" question
    pages/
      ClassRoomTab.tsx    Room layouts, grid size, table tools
      StudentsTab.tsx     Student classes and their students
      PlacementTab.tsx    Placement options, Place / Clear, results
      OptionsTab.tsx      Language, theme, JSON import / export
  store/
    useClassRoom.ts       Room layouts and their actions (persisted)
    useStudents.ts        Students and student classes (persisted)
    profiles.ts           Profile helpers shared by both stores
    usePlacements.ts      Placement options and saved seatings (persisted)
    useUI.ts              UI preferences: panel open, theme (persisted)
    backup.ts             Export / import of all stored data as JSON
  i18n/
    en.ts                 English strings (reference shape)
    fr.ts                 French strings
    index.ts              Language store, useT() and getT()
  utils/
    dnd.ts                Pointer-based drag and drop
    placement.ts          Seating algorithm (pure functions)
    ids.ts                shortId() for displaying ids
tests/
  setup.ts                happy-dom preload for unit tests
  helpers.ts              resetStores()
  unit/                   Store logic, i18n, helpers (bun test)
  e2e/                    Real-browser scenarios (puppeteer-core)
```

### Styles

- [style/global.css](src/style/global.css) defines the color, radius and
  font tokens (`--surface`, `--text-muted`, `--danger`, `--wood`, …) and the
  base look of `button`, `input` and `select`. Use the tokens instead of
  hard-coded colors. The Light and Chalkboard themes redefine the tokens
  under `:root[data-theme="…"]`.
- [style/ui.module.css](src/style/ui.module.css) holds classes shared by
  several components. Import it as `ui`: `className={ui.section}`,
  `ui.field`, `ui.row`, `ui.hint`, `ui.table`, `ui.id`, the
  button variants `ui.primary` and `ui.danger`, and the modal pieces
  `ui.dialog`, `ui.dialogBody`, `ui.dialogTitle`, `ui.actions`, `ui.spacer`
  (the first three are applied by `<Modal>`).
- [style/furniture.module.css](src/style/furniture.module.css) holds the
  look of the room's tables (`f.wood`) and whiteboard (`f.board`), and
  `f.draggable` for drag sources. Import it as `f`.
- Anything specific to one component goes in its sibling `*.module.css`,
  imported as `s`.

## Data model

### Room layouts

Stored by [useClassRoom.ts](src/store/useClassRoom.ts):

```ts
interface ClassProfile {
  id: string;
  name: string;
  rows: number;
  cols: number;
  tables: { id: string; row: number; col: number }[];
  board: "top" | "bottom";
}
```

Components read the loaded class with `useCurrentClass()` and change it
through store actions (`addTable`, `moveTable`, `setSize`, `setBoard`, …),
which always apply to the loaded class. There is always at least one class.

### Students

Stored by [useStudents.ts](src/store/useStudents.ts). A student exists once;
classes reference students by id:

```ts
interface Student {
  id: string;
  name: string;
  gender: "female" | "male" | "other";
  score: 1 | 2 | 3 | 4 | 5 | null;
  incompatible: string[]; // student ids
}

interface StudentClass {
  id: string;
  name: string;
  studentIds: string[];
}
```

#### Why the class → student link is stored only on the class

Student ↔ class is many-to-many. It could be stored on the class
(`studentIds`), on the student (`classIds`), or on both. Only the class
holds it:

- The frequent question is "who is in this class?" (every render of the tab,
  and the input of the seating algorithm). `studentIds` answers it directly
  and keeps the class's order.
- The reverse question, "which classes is this student in?", is only asked
  by the picker. `classesByStudent(classes)` builds it in one pass, and
  `useClassesByStudent()` memoizes it.
- Storing both sides would record the same fact twice. Every add, remove,
  delete and copy would then have to update both in step, and one missed
  update leaves them contradicting each other.
- Copying a class is a single new record with a copied array.

**Exception:** `incompatible` is stored on both students, as specified.
`saveStudent` is the only writer and updates both sides. On load, the
persist `merge` runs `repairIncompatibilities` to make links symmetric and
drop links to deleted students, in case stored data was edited by hand.

#### Rules the store keeps

- **Incompatibility is symmetric** (see above).
- **No orphans.** A student removed from their last class, or whose last
  class is deleted, is deleted and scrubbed from every incompatibility list.
- **Scores are 1–5 or null.** `updateStudent` (inline edits of name,
  gender and score) rejects anything else, and loading v1 data clears
  scores outside that range.
- `removeFromClass` removes a student from the loaded class (and deletes
  them if that was their last class); `deleteStudent` removes them from
  every class and deletes them.
- `saveStudent` on a student not yet in the loaded class adds them to it.
  `StudentCard` edits a draft and only calls `saveStudent` on Save; Cancel,
  Escape or a click on the backdrop discards every change.
- The list shows students in class order, not sorted by name, so a row
  doesn't move while its name is typed.
- `duplicateClass` copies the id list, not the students.
- `importStudents(names)` appends one new student per name to the loaded
  class, in order (use `parseNames(text)` to split pasted text). Duplicate
  names are kept as separate students, since two students can share a name.

### localStorage keys

| Key                        | Contents                                   |
| -------------------------- | ------------------------------------------ |
| `class-placement`          | Room layouts and the loaded layout id      |
| `class-placement-students` | Students, student classes, loaded class id |
| `class-placement-placements` | Placement options, seatings and switched-off tables per room + class (v2) |
| `class-placement-ui`       | UI preferences (panel open/closed, theme)  |
| `class-placement-lang`     | Selected language                          |

`class-placement` is at version 2, `class-placement-students` at version 3 and `class-placement-placements` at version 2. When you change a stored shape, bump `version` and handle
the old shape in `migrate` so existing saved data keeps loading.

### Storage: why localStorage (and when to switch)

Everything is in localStorage through zustand's `persist`.

- **Size:** a student is about 200 bytes, so 1,000 students across 50
  classes is about 250 KB, around 5% of the ~5 MB quota.
- **Cost of rewrites:** `persist` rewrites a store's whole value on each
  change. At this size that takes microseconds.
- **Simplicity:** reads are synchronous, so the app renders with its data
  on the first frame. IndexedDB is asynchronous, so every screen would need
  a loading state.
- **The seating algorithm isn't affected:** it runs on the in-memory state,
  not on storage.

Switch to IndexedDB if we start storing large or numerous things, such as
student photos or a history of seating results. To switch, pass
`storage: createJSONStorage(() => idbStorage)` (e.g. with `idb-keyval`) to
each `persist`, and wait for `persist.hasHydrated()` before rendering in
`index.tsx`. Components don't change.

## Drag and drop

[utils/dnd.ts](src/utils/dnd.ts) uses Pointer Events rather than native HTML5
drag and drop, which doesn't work on most touch screens.

- `useDraggable(payload)` returns an `onPointerDown` handler to spread on a
  drag source. A press becomes a drag after the pointer moves 6px, so taps
  and clicks still work; the click that follows a real drag is swallowed.
- `useDropTarget(id, { accepts, onDrop })` registers a drop target and
  returns `dropProps` (a `data-drop-id` attribute) and `isOver`.
- `useIsDragging(match)` tells a source it's being dragged, so it can dim
  itself.

Payloads are `{ kind: "new-table" }`, `{ kind: "table", id }` and
`{ kind: "board" }`. Drag sources need `touch-action: none` (the `f.draggable` class),
otherwise a touch drag scrolls the page instead.

## Translations

All user-facing text comes from [src/i18n](src/i18n). In a component:

```tsx
const t = useT();
<h2>{t.grid.heading}</h2>
<h2>{t.tables.heading(tables.length)}</h2> // strings with values are functions
```

Outside components (e.g. in a store), use `getT()`.

To add a string, add it to [en.ts](src/i18n/en.ts) and then to
[fr.ts](src/i18n/fr.ts); TypeScript flags any language that is missing it. To
add a language, create a file typed `Translations` and add it to `LANGUAGES`
in [i18n/index.ts](src/i18n/index.ts).

## Testing

Every change comes with tests: unit tests for store logic and pure
functions, and an e2e scenario for UI flows.

```bash
bun run test       # tests/unit — bun test + happy-dom, well under a second
bun run test:e2e   # tests/e2e — starts the dev server, drives Chromium
bun run test:all   # both
```

- **Unit tests** load [tests/setup.ts](tests/setup.ts) through the `test`
  script's `--preload` flag, which gives the stores a `window`, `document`
  and `localStorage`. Run them through the script, not with a bare
  `bun test`. Call `resetStores()` from
  [tests/helpers.ts](tests/helpers.ts) in `beforeEach`.
- **E2E tests** start their own dev server on a free port and use the
  installed Chromium through `puppeteer-core`. Set `CHROME_PATH` if Chromium
  isn't at `/usr/bin/chromium`. Screenshots go to `.e2e-screenshots/`
  (git-ignored).
- Prefer `data-testid` (or the existing `data-drop-id`) to find elements.
  Never use CSS-module class names, which are hashed. Visible English text
  is fine in `clickText`, since `openApp` starts every test in English.

## Type checking

```bash
bunx tsc --noEmit
```
