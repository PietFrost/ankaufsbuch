/* Fährt pdfsNachruesten und die Druckfilter außerhalb des Browsers nach.
   pdf.js wird durch eine Attrappe ersetzt, die zwei Seiten liefert. */
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const js = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join("\n");

const hol = (name) => {
  let start = js.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(name + " nicht gefunden");
  if (js.slice(start - 6, start) === "async ") start -= 6;
  let i = js.indexOf("{", start), tiefe = 0;
  for (let n = i; n < js.length; n++) {
    if (js[n] === "{") tiefe++;
    else if (js[n] === "}") { tiefe--; if (!tiefe) return js.slice(start, n + 1); }
  }
  throw new Error(name + " nicht abgegrenzt");
};

/* --- nachgebaute Umgebung --- */
const DB = { expenses: [], purchases: [], items: [], events: [], images: {} };
let zaehler = 0;
const uid = () => "id" + (++zaehler);
const all = async (s) => DB[s].map(x => JSON.parse(JSON.stringify(x)));
const getOne = async (s, id) => (s === "images" ? DB.images[id] || null : DB[s].find(x => x.id === id) || null);
const put = async (s, o) => { if (s === "images") DB.images[o.id] = o; else { const i = DB[s].findIndex(x => x.id === o.id); i >= 0 ? DB[s][i] = o : DB[s].push(o); } return o; };
const meldungen = [];
const toast = m => meldungen.push(m);
const confirm = () => true;
const reload = async () => {};
const pdfZuBildern = async () => [{ blob: "SEITE1", seite: 1, von: 2 }, { blob: "SEITE2", seite: 2, von: 2 }];

const BILDART = eval("(" + (js.match(/const\s+BILDART\s*=\s*(\{[^}]*\})/) || [, "{}"])[1] + ")");
const ctx = { uid, all, getOne, put, toast, confirm, reload, pdfZuBildern, BILDART };
const bau = new Function(...Object.keys(ctx), hol("offenePdfs") + "\n" + hol("pdfsNachruesten") + "\nreturn {offenePdfs, pdfsNachruesten};");
const { offenePdfs, pdfsNachruesten } = bau(...Object.values(ctx));

/* --- Ausgangslage: ein Kostenposten mit PDF, einer mit Foto --- */
DB.expenses.push({
  id: "k1", year: 2026, beleg: 1, kat: "material", betrag: 42, datum: "2026-03-04",
  shots: [{ id: "pdf1", kind: "rechnung", dateiname: "Baumarkt.pdf", typ: "application/pdf" }]
});
DB.expenses.push({
  id: "k2", year: 2026, beleg: 2, kat: "porto", betrag: 8, datum: "2026-03-09",
  shots: [{ id: "img1", kind: "rechnung", dateiname: "beleg.jpg", typ: "image/jpeg" }]
});
DB.images["pdf1"] = { id: "pdf1", blob: "PDFDATEN", art: "kostenbeleg" };
DB.images["img1"] = { id: "img1", blob: "FOTO", art: "kostenbeleg" };

/* Verkaufte Position mit PDF-Abrechnung, dazu eine Verkaufsrunde */
DB.items.push({
  id: "i1", year: 2026, purchaseId: "p1", bez: "PlayStation 2", ek: 20,
  sale: { datum: "2026-04-01", plattform: "Whatnot", vk: 55, eventId: "e1" },
  shots: [{ id: "pdf2", kind: "abrechnung", dateiname: "Whatnot.pdf", typ: "application/pdf" }]
});
DB.events.push({
  id: "e1", year: 2026, datum: "2026-04-01", plattform: "Whatnot", titel: "Stream Retro",
  shots: [{ id: "pdf3", kind: "auszahlung", dateiname: "Auszahlung.pdf", typ: "application/pdf" }]
});
DB.images["pdf2"] = { id: "pdf2", blob: "PDFDATEN2", art: "verkaufsbeleg" };
DB.images["pdf3"] = { id: "pdf3", blob: "PDFDATEN3", art: "rundenbeleg" };

let fehler = 0;
const pruefe = (bed, text) => { console.log((bed ? "  ok    " : "  FEHLER ") + text); if (!bed) fehler++; };

console.log("\nVor dem Nachrüsten");
pruefe(offenePdfs(DB.expenses).length === 1, "genau eine offene PDF beim Kostenposten, das Foto nicht");
pruefe(offenePdfs(DB.items).length === 1, "die Abrechnung am verkauften Stück wird erkannt");
pruefe(offenePdfs(DB.events).length === 1, "der Auszahlungsbeleg der Runde wird erkannt");
pruefe(Object.keys(BILDART).length === 4, "BILDART deckt alle vier Datenarten ab");

(async () => {
  await pdfsNachruesten();

  console.log("\nNach dem Nachrüsten");
  const k1 = DB.expenses.find(x => x.id === "k1");
  pruefe(k1.shots.length === 3, `aus 1 Nachweis wurden 3 (2 Seiten + Original), tatsächlich ${k1.shots.length}`);

  const seiten = k1.shots.filter(s => s.ausPdf);
  pruefe(seiten.length === 2, "zwei Seitenbilder angelegt");
  pruefe(seiten.every(s => s.typ === "image/jpeg"), "Seiten sind als Bild gekennzeichnet");
  pruefe(seiten.every(s => /Seite \d von 2\.jpg$/.test(s.dateiname)), "Seiten sind benannt: " + seiten.map(s => s.dateiname).join(" · "));

  const orig = k1.shots.filter(s => s.nurArchiv);
  pruefe(orig.length === 1 && orig[0].id === "pdf1", "Originaldatei bleibt erhalten und ist als Archivstück markiert");
  pruefe(DB.images["pdf1"] && DB.images["pdf1"].blob === "PDFDATEN", "die Originaldaten sind unangetastet");
  pruefe(seiten.every(s => DB.images[s.id] && DB.images[s.id].art === "kostenbeleg"), "Seitenbilder liegen im Bildspeicher");

  console.log("\nDruckfilter");
  const gedruckt = k1.shots.filter(x => !x.nurArchiv);
  pruefe(gedruckt.length === 2, "der Ausdruck zeigt 2 Seiten, nicht 3 — keine Dopplung");
  pruefe(!gedruckt.some(x => x.id === "pdf1"), "die Originaldatei taucht im Ausdruck nicht auf");

  console.log("\nZweiter Durchlauf");
  const vorher = JSON.stringify(DB.expenses);
  await pdfsNachruesten();
  pruefe(JSON.stringify(DB.expenses) === vorher, "nochmal Nachrüsten ändert nichts — keine doppelten Seiten");
  pruefe(/keine PDF/.test(meldungen[meldungen.length - 1]), "meldet: " + meldungen[meldungen.length - 1]);

  console.log("\nVerkauf und Runde");
  const i1 = DB.items.find(x => x.id === "i1");
  pruefe(i1.shots.length === 3, `Verkaufsnachweis wurde umgewandelt (${i1.shots.length} statt 1)`);
  pruefe(i1.shots.filter(x => !x.nurArchiv).length === 2, "im Ausdruck stehen 2 Seiten, nicht die Originaldatei");
  pruefe(i1.shots.every(x => x.kind === "abrechnung"), "die Art bleibt Abrechnung");
  pruefe(i1.sale && i1.sale.vk === 55, "der Verkauf selbst ist unangetastet");
  pruefe(Object.values(DB.images).some(im => im.art === "verkaufsbeleg" && im.blob === "SEITE1"), "Seitenbild liegt als Verkaufsbeleg im Speicher");

  const e1 = DB.events.find(x => x.id === "e1");
  pruefe(e1.shots.length === 3, `Rundennachweis wurde umgewandelt (${e1.shots.length} statt 1)`);
  pruefe(Object.values(DB.images).some(im => im.art === "rundenbeleg" && im.blob === "SEITE2"), "Seitenbild liegt als Rundenbeleg im Speicher");

  console.log("\nUnversehrter Nachbar");
  const k2 = DB.expenses.find(x => x.id === "k2");
  pruefe(k2.shots.length === 1 && k2.shots[0].id === "img1", "der Kostenposten mit Foto ist unverändert");

  console.log(fehler ? `\n${fehler} Fehler.\n` : "\nLogik in Ordnung.\n");
  process.exit(fehler ? 1 : 0);
})();
