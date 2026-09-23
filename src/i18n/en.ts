// Reference dictionary: every other language must match this shape.
const en = {
  app: {
    title: "Class Placement",
    language: "Language",
    showPannel: "Show panel",
    hidePannel: "Hide panel",
  },
  common: {
    cancel: "Cancel",
    close: "Close",
    save: "Save",
    delete: "Delete",
    unnamed: "(unnamed)",
    about: (name: string) => `About "${name}"`,
  },
  tabs: {
    classroom: "Classroom",
    students: "Students",
    placement: "Placement",
    options: "Options",
  },
  profile: {
    load: "Load",
    name: "Name",
    duplicate: "Copy",
    deleteConfirm: (name: string) => `Delete "${name}"?`,
    // A room layout (Classroom tab); `new` is both the button and the default name.
    room: { heading: "Classroom", new: "New classroom", first: "My classroom" },
    // A class of students (Students tab).
    class: { heading: "Class", new: "New class", first: "My class" },
  },
  grid: {
    heading: "Grid",
    rows: "Rows",
    columns: "Columns",
    shrinkHint: "The grid can't shrink past a placed table.",
  },
  tables: {
    heading: (count: number) => `Tables (${count})`,
    trash: "Drop a table here to remove it",
    hint: "Click an empty cell to add a table. Drag tables to move them: dropping on another table swaps them, and dropping on the 🗑 bin that appears in the corner removes them. Click a table to switch it off for the loaded class's placement.",
    clearAll: "Clear all tables",
    clearConfirm: "Remove every table from this class?",
    alt: "Table",
    off: "Table switched off",
  },
  classroom: {
    whiteboard: "Whiteboard",
    resizeBoard: "Drag to resize the whiteboard",
  },
  students: {
    copyName: (name: string) => `${name} - Copy`,
    deleteClassConfirm: (name: string) =>
      `Delete "${name}"? Students who aren't in another class will be deleted too.`,
    heading: (count: number) => `Students (${count})`,
    newStudent: "New student",
    addFromOther: "Add from another class",
    addMultiple: "Add multiple",
    empty: "No students in this class yet.",
    columns: {
      name: "Name",
      id: "ID",
      gender: "Gender",
      score: "Score",
      actions: "Actions",
    },
    genders: {
      female: "Female",
      male: "Male",
      other: "Other",
    },
    // Shown in the list's gender select, where space is tight.
    gendersShort: {
      female: "F",
      male: "M",
      other: "X",
    },
    noScore: "—",
    incompatibleCount: (count: number) => `⚠ ${count}`,
    frontRowBadge: "⬆ Front",
    details: (name: string) => `Details: ${name}`,
    remove: (name: string) => `Delete ${name}`,
  },
  importStudents: {
    title: "Add multiple students",
    label: "Names, one per line",
    placeholder: "Alice Martin\nBob Dupont\n…",
    summary: (count: number, className: string) =>
      `Creating ${count} new ${count === 1 ? "student" : "students"} in "${className}".`,
    import: "Import",
  },
  deleteStudent: {
    title: (name: string, className: string) =>
      `Delete ${name} from "${className}"?`,
    alsoIn: (classes: string) => `Also in: ${classes}.`,
    onlyHere:
      "They aren't in any other class, so they'll be deleted completely.",
    fromClass: "This class only",
    fromAll: "All classes",
  },
  card: {
    incompatible: "Incompatible with",
    none: "No one.",
    addIncompatible: "Add a student…",
    frontRow: "Front row (sit close to the whiteboard)",
    removeIncompatible: (name: string) => `Remove ${name}`,
  },
  picker: {
    filter: "Filter by name or ID",
    classes: "Classes",
    add: "Add",
    empty: "No other students.",
    noMatch: "No student matches.",
  },
  options: {
    languageHeading: "Language",
    themeHeading: "Theme",
    theme: "Color theme",
    themes: { indigo: "Indigo (default)", light: "Light", chalk: "Chalkboard" },
    backupHeading: "Import / export",
    exportRooms: "Export classrooms",
    exportClasses: "Export classes",
    exportHint:
      "Downloads every classroom, or every class with its students, as a JSON file. Placements aren't exported: each depends on both a classroom and a class.",
    import: "Import from JSON…",
    importHint: "Adds the file's classrooms or classes next to yours. Nothing is replaced.",
    importedRooms: (n: number) => `${n} ${n === 1 ? "classroom" : "classrooms"} added.`,
    importedClasses: (n: number) => `${n} ${n === 1 ? "class" : "classes"} added.`,
    aboutHeading: "About",
    about: [
      "Class Placement runs entirely in your browser. No data is collected or sent anywhere: there is no server, no account and no tracking.",
      "Your rooms, classes and students are saved in this browser, on this device only. Clearing the browser's data for this site deletes them.",
      "To keep a backup, or to move your data to another device or browser, use the exports above, then \"Import from JSON\" on the other side.",
    ],
    errors: {
      invalid: "This file isn't valid JSON.",
      notBackup: "This file isn't a Class Placement export.",
      empty: "This file has no classrooms or classes to import.",
      broken: "This file's data is damaged. Nothing was imported.",
    },
  },
  placement: {
    constraintsHeading: "Constraints",
    gender: "Alternate genders",
    incompatible: "Separate incompatible students",
    score: "Balance scores",
    weight: (constraint: string) => `Weight of "${constraint}"`,
    weights: { low: "Low", medium: "Medium", high: "High" },
    rule: "Score rule",
    rules: {
      spread: "Spread strong and weak",
      pairMean: "Pair strong with weak",
    },
    diagonal: "Diagonal neighbors",
    diagonals: {
      off: "Ignored",
      quarter: "¼ weight",
      half: "½ weight",
      full: "Full weight",
    },
    front: "Fill the front first",
    frontRow: "Front-row students near the board",
    // Shown by each constraint's ⓘ button, one string per paragraph.
    help: {
      gender: [
        "Avoids seating two girls, or two boys, next to each other, so genders alternate across the room.",
        'Students whose gender is "Other" can sit next to anyone. Arrows mark same-gender neighbors.',
      ],
      incompatible: [
        "Keeps apart the students marked as incompatible in a student's card, so they never sit next to each other.",
        "It works both ways: marking Alice as incompatible with Bob also marks Bob as incompatible with Alice. Arrows mark incompatible neighbors.",
      ],
      score: [
        "Uses the students' scores (1 to 5, set in the list or in their card) to mix levels. The rule chooses how:",
        "Spread strong and weak: avoids two strong, or two weak, students side by side. Anyone else can sit anywhere. With a mean of 3, 5 next to 5 is avoided, while 5 next to 1 or 5 next to 3 is fine.",
        "Pair strong with weak: each pair of neighbors should average to the class mean, so strong students end up next to weak ones. With a mean of 3, 5 next to 1 is preferred and 5 next to 3 is slightly avoided.",
        "Students without a score are ignored, and don't count in the mean. Arrows mark two neighbors on the same side of the mean, each at least 1 point from it.",
      ],
      front: [
        "Seats students as close to the whiteboard as possible, so the empty tables end up at the back.",
        "Distance is measured to the nearest point of the whiteboard, so the front tables facing it fill first. Only useful when there are more tables than students.",
      ],
      frontRow: [
        'Brings the students who need to sit at the front closer to the whiteboard. Tick "Front row" in a student\'s card to mark them.',
        "Arrows mark a front-row student when a table closer to the board is empty, or taken by a student who doesn't need the front.",
      ],
      diagonal: [
        "Sets whether students who only touch by a corner count as neighbors for the constraints above.",
        "Side neighbors (left, right, in front and behind) always count fully. With ½ weight, a diagonal neighbor counts half as much.",
      ],
      weights:
        "Low, Medium and High weigh ×1, ×4 and ×16: they decide which constraint wins when not all of them can be met.",
    },
    showMarks: "Show broken constraints on the tables",
    disabledHint: (count: number) =>
      `${count} ${count === 1 ? "table is" : "tables are"} switched off. Click a table in the room to switch it on or off.`,
    placeHeading: "Placement",
    summary: (cls: string, room: string, students: number, tables: number) =>
      `"${cls}" in "${room}": ${students} ${students === 1 ? "student" : "students"}, ${tables} ${tables === 1 ? "table" : "tables"}.`,
    place: "Place students",
    clear: "Clear placement",
    needStudents: "Add students to this class first.",
    needTables: "Add tables to this room first.",
    notPlaced: "Not placed yet.",
    unplaced: (names: string) => `Not enough tables. Not seated: ${names}.`,
    violationsNone: "No constraint broken.",
    violations: {
      incompatible: (n: number) =>
        `${n} incompatible ${n === 1 ? "pair" : "pairs"}`,
      gender: (n: number) => `${n} same-gender ${n === 1 ? "pair" : "pairs"}`,
      score: (n: number) => `${n} same-level ${n === 1 ? "pair" : "pairs"}`,
      frontRow: (n: number) =>
        `${n} front-row ${n === 1 ? "student" : "students"} not at the front`,
    },
    arrowsHint:
      "Arrows on a table point to the neighbor it breaks a constraint with.",
  },
};

export type Translations = typeof en;
export default en;
