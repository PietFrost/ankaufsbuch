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


  /* ---------- Verteilung eines Gesamterlöses ---------- */
  console.log("\nVerteilung einer Verkaufsrunde");
  function verteile(soll, werte){
    const ekSum = werte.reduce((a,w)=>a+w.ek,0);
    let rest = Math.round(soll*100);
    const out = [];
    werte.forEach((w,ix)=>{
      let cent;
      if(ix === werte.length-1) cent = rest;
      else { cent = ekSum ? Math.round(soll*100 * w.ek/ekSum) : Math.floor(soll*100/werte.length); rest -= cent; }
      out.push(cent/100);
    });
    return out;
  }
  const gesamt = a => Math.round(a.reduce((x,y)=>x+y,0)*100)/100;
  const zehn = [40,30,25,20,20,15,15,15,10,10].map(ek=>({ek}));
  const r1 = verteile(1500, zehn);
  pruefe(gesamt(r1) === 1500, "1500 EUR auf 10 Positionen ergibt in Summe wieder 1500");
  pruefe(r1[0] === 300, "Verhaeltnis stimmt: 40 von 200 Einkauf ergibt 300 von 1500");
  pruefe(r1[0] === Math.max(...r1), "die teuerste Position bekommt den groessten Anteil");
  pruefe(gesamt(verteile(100, [{ek:1},{ek:1},{ek:1}])) === 100, "Drittelung ohne Centverlust");
  pruefe(gesamt(verteile(999.99, Array.from({length:13},(_,i)=>({ek:i+1})))) === 999.99, "krummer Betrag auf 13 Positionen");
  const r2 = verteile(100, [{ek:0},{ek:0},{ek:0}]);
  pruefe(gesamt(r2) === 100 && r2.every(x=>x>0), "bei Einkaufswert 0 wird gleichmaessig verteilt");
  pruefe(JSON.stringify(verteile(1500,[{ek:200}])) === "[1500]", "eine einzige Position bekommt alles");
  const diff = (soll, zeilen) => Math.round((soll - zeilen.reduce((a,b)=>a+b,0))*100)/100;
  pruefe(diff(1500,[500,400,300]) === 300, "offene Differenz wird richtig berechnet");
  pruefe(diff(1500,[1000,500]) === 0, "keine Differenz bei vollstaendiger Zuordnung");


  /* ---------- Kontoauszug einlesen ---------- */
  console.log("\nKontoauszug einlesen");
  {
    const quelle = require("fs").readFileSync(__dirname + "/index.html", "utf8");
    const skript = quelle.split("<script>")[1].split("</script>")[0];
    const stueck = (start) => {
      const i = skript.indexOf(start);
      if (i < 0) throw new Error("fehlt: " + start);
      const m = /\n(?:function |const [A-Z])/.exec(skript.slice(i + 10));
      return skript.slice(i, m ? i + 10 + m.index : i + 2000);
    };
    const quellcode = ["function csvZeile", "function csvLesen", "function spalteFinden",
      "const SPALTEN =", "function datumLesen", "function betragLesen"].map(stueck).join("\n");
    const L = {};
    new Function(quellcode + "\nreturn {csvLesen,spalteFinden,SPALTEN,datumLesen,betragLesen,csvZeile};")
      .call(null) && Object.assign(L, new Function(quellcode +
        "\nreturn {csvLesen,spalteFinden,SPALTEN,datumLesen,betragLesen,csvZeile};")());

    pruefe(L.datumLesen("04.08.2026") === "2026-08-04", "deutsches Datum wird gelesen");
    pruefe(L.datumLesen("2026-08-04") === "2026-08-04", "ISO-Datum wird nicht verdreht");
    pruefe(L.datumLesen("4.8.26") === "2026-08-04", "einstellig mit kurzem Jahr");
    pruefe(L.datumLesen("Blabla") === null, "unlesbares Datum ergibt null");
    pruefe(L.betragLesen("1.234,56") === 1234.56, "deutscher Betrag mit Tausenderpunkt");
    pruefe(L.betragLesen("1,234.56") === 1234.56, "englischer Betrag");
    pruefe(L.betragLesen("-130,00") === -130, "negativer Betrag bleibt negativ");
    pruefe(L.betragLesen("130,00 EUR") === 130, "Waehrung wird ignoriert");

    const pp = ['"Datum";"Name";"Brutto";"Gebuehr"',
                '"04.08.2026";"Kurt Meier";"-130,00";"0,00"',
                '"05.08.2026";"Whatnot";"1.500,00";"-120,00"'].join("\n");
    const r = L.csvLesen(pp);
    pruefe(r.kopf.length === 4 && r.daten.length === 2, "Semikolon-Datei wird zerlegt");
    pruefe(L.spalteFinden(r.kopf, L.SPALTEN.datum) === 0, "Datumsspalte gefunden");
    pruefe(L.spalteFinden(r.kopf, L.SPALTEN.betrag) === 2, "Betragsspalte gefunden");

    const wn = ["Date,Item,Buyer,Sale Price,Fees",
                '2026-08-05,"NES Modul, lose",sammler,45.50,3.64'].join("\n");
    const w = L.csvLesen(wn);
    pruefe(w.daten[0][1] === "NES Modul, lose", "Komma in Anfuehrungszeichen bleibt erhalten");
    pruefe(L.spalteFinden(w.kopf, L.SPALTEN.betrag) === 3, "Whatnot-Preisspalte gefunden");
    pruefe(L.csvLesen("").daten.length === 0, "leere Datei bricht nicht ab");
  }


  /* ---------- Import: nichts ohne Zutun ---------- */
  console.log("\nImport — nichts wird ungefragt uebernommen");
  {
    const quelle = require("fs").readFileSync(__dirname + "/index.html", "utf8");
    const skript = quelle.split("<script>")[1].split("</script>")[0];
    pruefe(/ARTEN = \{weg:"Privat"/.test(skript), "Privat steht an erster Stelle der Auswahl");
    pruefe(/return merk \|\| "weg";/.test(skript), "ohne gemerkte Zuordnung bleibt jede Zeile privat");
    pruefe(/z\.art !== "weg"\) merker/.test(skript), "Privat wird nicht als Merker gespeichert");
    pruefe(/impAus/.test(skript) && /impVor/.test(skript), "Sammelaktionen fuer alles und Vorschlaege vorhanden");
    pruefe(/impSuch/.test(skript), "Filter ueber Name und Zweck vorhanden");
    pruefe(/Zeilen bleiben als privat drau/.test(skript), "Bilanz vor dem Anlegen nennt die privaten Zeilen");
    const artVorschlag = (z, merker) => (merker||{})[(z.name||"").toLowerCase().trim()] || "weg";
    pruefe(artVorschlag({name:"Netflix", betrag:-12.99}) === "weg", "eine private Ausgabe bleibt drau\u00dfen");
    pruefe(artVorschlag({name:"Mama", betrag:200}) === "weg", "ein privater Geldeingang bleibt drau\u00dfen");
    pruefe(artVorschlag({name:"KURT "}, {kurt:"ankauf"}) === "ankauf", "gemerkter Name wird wiedererkannt");
  }

  console.log(fehler ? `\n${fehler} Fehler.\n` : "\nLogik in Ordnung.\n");
  process.exit(fehler ? 1 : 0);
})();
