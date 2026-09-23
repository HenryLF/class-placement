import type { Translations } from "./en";

// French punctuation uses non-breaking spaces (U+00A0) before ? : » and
// after «, so it never wraps onto a line of its own.
const fr: Translations = {
  app: {
    title: "Plan de classe",
    language: "Langue",
    showPannel: "Afficher le panneau",
    hidePannel: "Masquer le panneau",
  },
  common: {
    cancel: "Annuler",
    close: "Fermer",
    save: "Enregistrer",
    delete: "Supprimer",
    unnamed: "(sans nom)",
  },
  tabs: {
    classroom: "Salle",
    students: "Élèves",
    placement: "Placement",
    options: "Options",
  },
  profile: {
    heading: "Classe",
    load: "Charger",
    name: "Nom",
    newClass: "Nouvelle classe",
    duplicate: "Copier",
    deleteConfirm: (name) => `Supprimer « ${name} » ?`,
    defaultName: "Nouvelle classe",
    firstName: "Ma classe",
  },
  grid: {
    heading: "Grille",
    rows: "Rangées",
    columns: "Colonnes",
    shrinkHint: "La grille ne peut pas être réduite au-delà d'une table placée.",
  },
  tables: {
    heading: (count) => `Tables (${count})`,
    trash: "Déposez une table ici pour la supprimer",
    hint: "Cliquez sur une case vide pour ajouter une table. Glissez les tables pour les déplacer : les déposer sur une autre table les échange, et sur la corbeille 🗑 qui apparaît dans le coin les supprime. Cliquez sur une table pour la désactiver dans le placement de la classe chargée.",
    clearAll: "Retirer toutes les tables",
    clearConfirm: "Retirer toutes les tables de cette classe ?",
    alt: "Table",
    off: "Table désactivée",
  },
  classroom: {
    whiteboard: "Tableau",
  },
  students: {
    classHeading: "Classe",
    copyName: (name) => `${name} - Copie`,
    deleteClassConfirm: (name) =>
      `Supprimer « ${name} » ? Les élèves qui ne sont dans aucune autre classe seront aussi supprimés.`,
    heading: (count) => `Élèves (${count})`,
    newStudent: "Nouvel élève",
    addFromOther: "Ajouter depuis une autre classe",
    addMultiple: "Ajouter plusieurs",
    empty: "Aucun élève dans cette classe pour l'instant.",
    columns: {
      name: "Nom",
      id: "ID",
      gender: "Genre",
      score: "Note",
      actions: "Actions",
    },
    genders: {
      female: "Féminin",
      male: "Masculin",
      other: "Autre",
    },
    gendersShort: {
      female: "F",
      male: "M",
      other: "X",
    },
    noScore: "—",
    incompatibleCount: (count) => `⚠ ${count}`,
    frontRowBadge: "⬆ Devant",
    details: (name) => `Détails : ${name}`,
    remove: (name) => `Supprimer ${name}`,
  },
  importStudents: {
    title: "Ajouter plusieurs élèves",
    label: "Noms, un par ligne",
    placeholder: "Alice Martin\nBob Dupont\n…",
    summary: (count, className) =>
      `Création de ${count} ${count <= 1 ? "nouvel élève" : "nouveaux élèves"} dans « ${className} ».`,
    import: "Importer",
  },
  deleteStudent: {
    title: (name, className) => `Supprimer ${name} de « ${className} » ?`,
    alsoIn: (classes) => `Aussi dans : ${classes}.`,
    onlyHere: "Aucune autre classe ne contient cet élève : la suppression est définitive.",
    fromClass: "Cette classe seulement",
    fromAll: "Toutes les classes",
  },
  card: {
    incompatible: "Incompatible avec",
    none: "Personne.",
    addIncompatible: "Ajouter un élève…",
    frontRow: "Premier rang (près du tableau)",
    removeIncompatible: (name) => `Retirer ${name}`,
  },
  picker: {
    filter: "Filtrer par nom ou ID",
    classes: "Classes",
    add: "Ajouter",
    empty: "Aucun autre élève.",
    noMatch: "Aucun élève ne correspond.",
  },
  options: {
    languageHeading: "Langue",
    themeHeading: "Thème",
    theme: "Thème de couleurs",
    themes: { indigo: "Indigo (par défaut)", light: "Clair", chalk: "Tableau noir" },
    backupHeading: "Import / export",
    export: "Exporter en JSON",
    exportHint: "Télécharge toutes les salles, classes, élèves, placements et réglages dans un seul fichier.",
    import: "Importer depuis un JSON…",
    importHint: "Remplace toutes les données actuelles par celles du fichier.",
    importConfirm: (date) =>
      `Remplacer toutes les données actuelles par l'export du ${date} ? Cette action est irréversible.`,
    imported: "Données importées.",
    errors: {
      invalid: "Ce fichier n'est pas un JSON valide.",
      notBackup: "Ce fichier n'est pas un export de Plan de classe.",
      empty: "Ce fichier ne contient aucune donnée à importer.",
      broken: (key) => `Les données « ${key} » du fichier sont abîmées. Rien n'a été importé.`,
    },
  },
  placement: {
    constraintsHeading: "Contraintes",
    gender: "Alterner les genres",
    incompatible: "Séparer les élèves incompatibles",
    score: "Équilibrer les notes",
    weight: (constraint) => `Poids de « ${constraint} »`,
    weights: { low: "Faible", medium: "Moyen", high: "Fort" },
    rule: "Règle des notes",
    rules: {
      spread: "Disperser forts et faibles",
      pairMean: "Associer forts et faibles",
    },
    ruleInfo: "À propos des règles de notes",
    ruleHelp: {
      spread:
        "Disperser forts et faibles : évite deux élèves de bon niveau, ou deux élèves en difficulté, côte à côte. Les autres peuvent s'asseoir n'importe où. Avec une moyenne de 3, un 5 à côté d'un 5 est évité, alors qu'un 5 à côté d'un 1 ou d'un 3 convient.",
      pairMean:
        "Associer forts et faibles : chaque paire de voisins doit avoir en moyenne la moyenne de la classe, ce qui place les élèves de bon niveau à côté des élèves en difficulté. Avec une moyenne de 3, un 5 à côté d'un 1 est préféré, et un 5 à côté d'un 3 est un peu évité.",
      noScore: "Les élèves sans note sont ignorés et ne comptent pas dans la moyenne.",
    },
    diagonal: "Voisins en diagonale",
    diagonals: { off: "Ignorés", quarter: "Poids ¼", half: "Poids ½", full: "Poids plein" },
    diagonalHint: "Les voisins de côté comptent toujours pleinement.",
    front: "Remplir l'avant d'abord",
    frontRow: "Élèves du premier rang près du tableau",
    frontHint: "La distance est mesurée jusqu'au milieu du tableau, donc le centre de l'avant se remplit en premier. Le premier rang se règle dans la fiche de l'élève.",
    showMarks: "Afficher les contraintes enfreintes sur les tables",
    disabledHint: (count) =>
      `${count} table${count > 1 ? "s" : ""} désactivée${count > 1 ? "s" : ""}. Cliquez sur une table de la salle pour l'activer ou la désactiver.`,
    placeHeading: "Placement",
    summary: (cls, room, students, tables) =>
      `« ${cls} » dans « ${room} » : ${students} élève${students > 1 ? "s" : ""}, ${tables} table${tables > 1 ? "s" : ""}.`,
    place: "Placer les élèves",
    clear: "Effacer le placement",
    needStudents: "Ajoutez d'abord des élèves à cette classe.",
    needTables: "Ajoutez d'abord des tables à cette salle.",
    notPlaced: "Aucun placement pour l'instant.",
    unplaced: (names) => `Pas assez de tables. Sans place : ${names}.`,
    violationsNone: "Aucune contrainte enfreinte.",
    violations: {
      incompatible: (n) => `${n} paire${n > 1 ? "s" : ""} incompatible${n > 1 ? "s" : ""}`,
      gender: (n) => `${n} paire${n > 1 ? "s" : ""} de même genre`,
      score: (n) => `${n} paire${n > 1 ? "s" : ""} de même niveau`,
      frontRow: (n) => `${n} élève${n > 1 ? "s" : ""} du premier rang pas devant`,
    },
    arrowsHint: "Les flèches sur une table pointent vers le voisin avec qui une contrainte est enfreinte.",
  },
};

export default fr;
