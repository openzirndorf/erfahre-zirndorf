export interface FaqEntry {
  question: string;
  answer: string;
  steps?: string[];
  link?: {
    label: string;
    to: string;
  };
}

const faq: FaqEntry[] = [
  {
    question: "Was ist Erfahre Zirndorf?",
    answer:
      "Erfahre Zirndorf ist eine App von OpenZirndorf. Täglich werden neue Orte in Zirndorf freigeschaltet – du fährst mit dem Rad hin, checkst per GPS ein und sammelst Punkte. Verpasste Orte kannst du bis zum Aktionsende nachholen.",
  },
  {
    question: "Wann findet die Aktion statt?",
    answer:
      "Die Aktion läuft vom 6. Juni bis 12. Juli 2026. Täglich kommen neue Orte dazu – manchmal einer, manchmal mehrere. Ihr habt bis zum 12. Juli Zeit, alle Orte nachzuholen.",
  },
  {
    question: "Kann ich Preise gewinnen?",
    answer:
      "Ja! Ab 100 gesammelten Punkten nimmst du automatisch an der Verlosung teil. Je mehr Orte du schaffst, desto mehr Punkte hast du – und desto höher stehen deine Gewinnchancen bei der Verlosung. Details zu den Preisen findest du auf der Sponsoren-Seite.",
    link: { label: "Sponsoren und Preise ansehen", to: "/sponsoren" },
  },
  {
    question: "Wie melde ich mich an?",
    answer:
      'Tippe unten auf "Profil" oder öffne die Profilseite. Gib deine E-Mail-Adresse und einen Anzeigenamen ein. Die App arbeitet ohne Passwort – du bekommst einen einmaligen Login-Code per E-Mail.',
  },
  {
    question: "Wie funktioniert der Check-in?",
    answer:
      'Öffne einen Ort oder tippe einen Punkt auf der Karte an, fahr hin und tippe auf "Jetzt einchecken". Die App ruft einmalig deinen GPS-Standort ab und prüft die Entfernung zum Ziel. Bei manchen Orten gibt es zusätzlich eine Quizfrage, die du vor Ort beantworten musst. Bei Erfolg bekommst du Punkte. Jeden Ort kannst du einmal einchecken.',
  },
  {
    question: "Mein GPS ist zu ungenau – was kann ich tun?",
    answer:
      "Schlechtes GPS-Signal ist der häufigste Grund für einen fehlgeschlagenen Check-in. Diese Schritte helfen meistens:",
    steps: [
      'Einstellungen → Standort → „Google-Standortgenauigkeit“ aktivieren (falls nicht schon an)',
      "Cache leeren: Einstellungen → Apps → Chrome (oder dein Browser) → Speicher → Cache leeren, dann App neu starten",
      'GPS testen: „GPS Status & Toolbox“ aus dem Play Store installieren und prüfen, ob mindestens 4–6 Satelliten empfangen werden',
      "Pixel-Tipp: Flugmodus kurz ein- und wieder ausschalten – das kalibriert das GPS neu",
    ],
  },
  {
    question: "Was passiert mit meinem Standort?",
    answer:
      "Dein Standort wird nur beim aktiven Check-in abgefragt – nie im Hintergrund, nie automatisch. Gespeichert wird nur die Distanz zum Ziel und die GPS-Genauigkeit, keine exakten Koordinaten. Es werden keine Routen aufgezeichnet.",
  },
  {
    question: "Ist GPS-Spoofing erlaubt?",
    answer:
      "Nein. Fake-Standorte, GPS-Spoofing oder andere technische Manipulationen sind nicht erlaubt. Verdächtige Check-ins können geprüft und zurückgesetzt werden; bei klaren Verstößen kann der Account gesperrt werden.",
    link: { label: "Fair-Play-Regeln ansehen", to: "/fairplay" },
  },
  {
    question: "Wann werden neue Orte freigeschaltet?",
    answer:
      "Jeder Ort wird an einem bestimmten Tag zu einer bestimmten Uhrzeit freigeschaltet – du siehst ihn dann automatisch auf der Startseite und der Karte. Drei Orte sind vom ersten Tag an zugänglich.",
  },
  {
    question: "Kann ich Orte nachholen?",
    answer:
      "Ja. Bereits freigeschaltete Orte bleiben sichtbar und können bis zum 12. Juli nachgeholt werden. Besuchen kannst du einen Ort aber erst ab seinem Freischaltzeitpunkt.",
  },
  {
    question: "Warum sehe ich nicht alle Orte auf einmal?",
    answer:
      "Jeder Ort wird erst zum festgelegten Zeitpunkt sichtbar – so bleibt die Überraschung erhalten. Zukünftige Orte sind auch über die API nicht abrufbar.",
  },
  {
    question: "Was sind Extrapunkte?",
    answer:
      "Als erste Person weltweit bei einem Ort einzuchecken bringt +5 Bonuspunkte. Wer innerhalb der ersten zwei Tage nach Freischaltung eincheckt, bekommt zusätzlich +5 Punkte. Beide Boni werden im Erfolgsscreen angezeigt.",
  },
  {
    question: "Was sind Badges?",
    answer:
      "Badges sind Auszeichnungen für besondere Leistungen: erster erfolgreicher Check-in, 5, 10 oder 15 abgeschlossene Orte, alle 25 Orte oder mehrere Tage hintereinander aktiv. Sie erscheinen in deinem Profil.",
  },
  {
    question: "Wie funktioniert die Rangliste?",
    answer:
      "Die Rangliste zeigt alle Teilnehmer sortiert nach gesammelten Punkten. Bei gleicher Punktzahl erhalten mehrere Personen denselben Rang. Du siehst deinen eigenen Eintrag farblich hervorgehoben.",
  },
  {
    question: "Wer steckt dahinter?",
    answer:
      "Erfahre Zirndorf ist ein Projekt von OpenZirndorf – einer offenen, ehrenamtlichen Initiative für digitale Beteiligung und smarte Stadtentwicklung in Zirndorf.",
  },
  {
    question: "Wo kann ich Feedback geben?",
    answer:
      "Als angemeldeter User kannst du über den Menüpunkt \"Kontakt\" direkt in der App Ideen, Stop-Vorschläge, Support-Anfragen oder Sponsoren melden. Alternativ erreichst du uns über das Impressum auf openzirndorf.de.",
    link: { label: "Impressum", to: "/impressum" },
  },
];

export default faq;
