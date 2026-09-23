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
    about: (name) => `À propos de « ${name} »`,
  },
  tabs: {
    classroom: "Salle de Cours",
    students: "Élèves",
    placement: "Placement",
    options: "Options",
  },
  profile: {
    load: "Charger",
    name: "Nom",
    duplicate: "Copier",
    deleteConfirm: (name) => `Supprimer « ${name} » ?`,
    room: {
      heading: "Salle de cours",
      new: "Nouvelle salle de cours",
      first: "Ma salle de cours",
    },
    class: { heading: "Classe", new: "Nouvelle classe", first: "Ma classe" },
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
    exportRooms: "Exporter les salles de cours",
    exportClasses: "Exporter les classes",
    exportHint:
      "Télécharge toutes les salles de cours, ou toutes les classes avec leurs élèves, dans un fichier JSON. Les placements ne sont pas exportés : chacun dépend à la fois d'une salle et d'une classe.",
    import: "Importer depuis un JSON…",
    importHint: "Ajoute les salles de cours ou les classes du fichier à côté des vôtres. Rien n'est remplacé.",
    importedRooms: (n) =>
      n === 1 ? "1 salle de cours ajoutée." : `${n} salles de cours ajoutées.`,
    importedClasses: (n) => (n === 1 ? "1 classe ajoutée." : `${n} classes ajoutées.`),
    aboutHeading: "À propos",
    about: [
      "Plan de classe fonctionne entièrement dans votre navigateur. Aucune donnée n'est collectée ni envoyée où que ce soit : pas de serveur, pas de compte, pas de pistage.",
      "Vos salles, classes et élèves sont enregistrés dans ce navigateur, sur cet appareil uniquement. Effacer les données de navigation de ce site les supprime.",
      "Pour garder une sauvegarde, ou passer vos données sur un autre appareil ou navigateur, utilisez les exports ci-dessus, puis « Importer depuis un JSON » de l'autre côté.",
    ],
    errors: {
      invalid: "Ce fichier n'est pas un JSON valide.",
      notBackup: "Ce fichier n'est pas un export de Plan de classe.",
      empty: "Ce fichier ne contient aucune salle de cours ni classe à importer.",
      broken: "Les données de ce fichier sont abîmées. Rien n'a été importé.",
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
    help: {
      gender: [
        "Évite d'asseoir deux filles, ou deux garçons, côte à côte, pour que les genres alternent dans la salle.",
        "Les élèves dont le genre est « Autre » peuvent s'asseoir à côté de n'importe qui. Les flèches signalent les voisins de même genre.",
      ],
      incompatible: [
        "Éloigne les élèves marqués comme incompatibles dans la fiche d'un élève, pour qu'ils ne soient jamais voisins.",
        "Cela vaut dans les deux sens : marquer Alice incompatible avec Bob marque aussi Bob incompatible avec Alice. Les flèches signalent les voisins incompatibles.",
      ],
      score: [
        "Utilise les notes des élèves (de 1 à 5, dans la liste ou dans leur fiche) pour mélanger les niveaux. La règle choisit comment :",
        "Disperser forts et faibles : évite deux élèves de bon niveau, ou deux élèves en difficulté, côte à côte. Les autres peuvent s'asseoir n'importe où. Avec une moyenne de 3, un 5 à côté d'un 5 est évité, alors qu'un 5 à côté d'un 1 ou d'un 3 convient.",
        "Associer forts et faibles : chaque paire de voisins doit avoir en moyenne la moyenne de la classe, ce qui place les élèves de bon niveau à côté des élèves en difficulté. Avec une moyenne de 3, un 5 à côté d'un 1 est préféré, et un 5 à côté d'un 3 est un peu évité.",
        "Les élèves sans note sont ignorés et ne comptent pas dans la moyenne. Les flèches signalent deux voisins du même côté de la moyenne, chacun à au moins 1 point d'elle.",
      ],
      front: [
        "Assoit les élèves le plus près possible du tableau, pour que les tables vides restent au fond.",
        "La distance est mesurée jusqu'au milieu du tableau, donc le centre de l'avant se remplit en premier. Utile seulement s'il y a plus de tables que d'élèves.",
      ],
      frontRow: [
        "Rapproche du tableau les élèves qui doivent être devant. Cochez « Premier rang » dans la fiche d'un élève pour l'indiquer.",
        "Les flèches signalent un élève du premier rang quand une table plus proche du tableau est vide, ou occupée par un élève qui n'a pas besoin d'être devant.",
      ],
      diagonal: [
        "Indique si les élèves qui ne se touchent que par un coin comptent comme voisins pour les contraintes ci-dessus.",
        "Les voisins de côté (à gauche, à droite, devant et derrière) comptent toujours pleinement. Avec un poids ½, un voisin en diagonale compte moitié moins.",
      ],
      weights:
        "Faible, Moyen et Fort pèsent ×1, ×4 et ×16 : ils décident quelle contrainte l'emporte quand elles ne peuvent pas toutes être respectées.",
    },
    diagonal: "Voisins en diagonale",
    diagonals: { off: "Ignorés", quarter: "Poids ¼", half: "Poids ½", full: "Poids plein" },
    front: "Remplir l'avant d'abord",
    frontRow: "Élèves du premier rang près du tableau",
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
