/* Ankaufsbuch — Prüflauf.  Aufruf:  node test.js
   Prüft ohne Browser, was sich ohne Browser prüfen lässt:
   Versionsgleichstand, Syntax, verwaiste Element-Namen, Manifest, Cache-Liste.
   Bricht mit Code 1 ab, wenn etwas nicht stimmt. */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const WURZEL = __dirname;
let fehler = 0, warnung = 0, ok = 0;

const gut = m => { ok++; console.log("  ok    " + m); };
const schlecht = m => { fehler++; console.log("  FEHLER " + m); };
const hinweis = m => { warnung++; console.log("  hinweis " + m); };
const block = t => console.log("\n" + t);

const lies = n => fs.readFileSync(path.join(WURZEL, n), "utf8");
const gibtEs = n => fs.existsSync(path.join(WURZEL, n));

/* ---------- 1. Dateien ---------- */
block("Dateien");
const PFLICHT = ["index.html", "sw.js", "manifest.webmanifest", "icon-180.png", "icon-512.png"];
for (const f of PFLICHT) {
  if (gibtEs(f)) gut(f);
  else schlecht(f + " fehlt");
}
if (fehler) { console.log("\nOhne die Pflichtdateien geht es nicht weiter.\n"); process.exit(1); }

const html = lies("index.html");
const sw = lies("sw.js");

/* ---------- 2. Versionsgleichstand ---------- */
block("Version");
const vApp = (html.match(/const\s+APP_VERSION\s*=\s*["']([^"']+)["']/) || [])[1];
const vCache = (sw.match(/const\s+CACHE\s*=\s*["']ankaufsbuch-([^"']+)["']/) || [])[1];

if (!vApp) schlecht("APP_VERSION nicht gefunden in index.html");
if (!vCache) schlecht("CACHE-Version nicht gefunden in sw.js");
if (vApp && vCache) {
  if (vApp === vCache) gut(`index.html und sw.js stehen beide auf ${vApp}`);
  else schlecht(`index.html sagt ${vApp}, sw.js sagt ${vCache} — das Update kommt so nicht an`);
  if (!/^v\d+$/.test(vApp)) schlecht(`Versionsformat "${vApp}" — erwartet wird vNN`);
  else gut("Versionsformat");
}

/* ---------- 3. Syntax des eingebetteten Skripts ---------- */
block("Syntax");
const skripte = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
if (!skripte.length) schlecht("kein eingebettetes Skript gefunden");
skripte.forEach((code, i) => {
  try {
    new vm.Script(code, { filename: `index.html:script[${i}]` });
    gut(`Skriptblock ${i + 1} lässt sich fehlerfrei lesen (${Math.round(code.length / 1024)} KB)`);
  } catch (e) {
    schlecht(`Skriptblock ${i + 1}: ${e.message}`);
  }
});
try {
  new vm.Script(sw, { filename: "sw.js" });
  gut("sw.js lässt sich fehlerfrei lesen");
} catch (e) {
  schlecht("sw.js: " + e.message);
}

const js = skripte.join("\n");

/* ---------- 4. Element-Namen ---------- */
block("Element-Namen");
/* Alle id="…" im gesamten Text — auch die in Vorlagen-Zeichenketten. */
const vorhanden = new Set([...html.matchAll(/\bid=\\?["']([A-Za-z0-9_\-]+)\\?["']/g)].map(m => m[1]));
/* Namen, die erst zur Laufzeit zusammengesetzt werden, prüfen wir nicht. */
const gesucht = [...js.matchAll(/getElementById\(\s*["']([A-Za-z0-9_\-]+)["']\s*\)/g)].map(m => m[1]);
/* Manche Elemente entstehen erst zur Laufzeit — etwa sigBox("sigV", …), wo der
   Name als Wert übergeben und in die Vorlage eingesetzt wird. Solche Namen
   stehen im Code noch ein zweites Mal als Zeichenkette. Steht ein Name dagegen
   nur im getElementById und sonst nirgends, greift er ins Leere. */
const alsWert = new Set();
[...js.matchAll(/["']([A-Za-z0-9_\-]+)["']/g)].forEach(m => {
  const treffer = [...js.matchAll(new RegExp(`["']${m[1]}["']`, "g"))].length;
  const inGetter = [...js.matchAll(new RegExp(`getElementById\\(\\s*["']${m[1]}["']`, "g"))].length;
  if (treffer > inGetter) alsWert.add(m[1]);
});
const fehlend = [...new Set(gesucht)].filter(n => !vorhanden.has(n) && !alsWert.has(n));
const dynamisch = [...new Set(gesucht)].filter(n => !vorhanden.has(n) && alsWert.has(n));
if (fehlend.length) fehlend.forEach(n => schlecht(`getElementById("${n}") — dieses Element gibt es nirgends`));
else gut(`${new Set(gesucht).size} angesprochene Elemente, alle auffindbar`);
if (dynamisch.length) hinweis(`erst zur Laufzeit gebaut, nicht prüfbar: ${dynamisch.join(", ")}`);

/* ---------- 5. Aufgerufene Funktionen ---------- */
block("Funktionen");
const definiert = new Set([
  ...[...js.matchAll(/function\s+([A-Za-z0-9_$]+)\s*\(/g)].map(m => m[1]),
  ...[...js.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:function|\()/g)].map(m => m[1]),
  ...[...js.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?[A-Za-z0-9_$]+\s*=>/g)].map(m => m[1])
]);
/* Nur die Funktionen prüfen, die wir selbst benannt haben — nichts aus dem Browser. */
const EIGEN = /^(p[A-Z]|(render|open|save|lade|bau|mach|pdf|nummern|papierkorb|monats)[A-Za-z])/;
const BROWSEREIGEN = new Set(["open", "openDatabase", "loadShots", "pdfjsLib"]);
const aufgerufen = [...new Set([...js.matchAll(/\b([A-Za-z0-9_$]+)\s*\(/g)].map(m => m[1]))]
  .filter(n => EIGEN.test(n) && !BROWSEREIGEN.has(n));
const unbekannt = aufgerufen.filter(n => !definiert.has(n));
if (unbekannt.length) unbekannt.forEach(n => schlecht(`${n}() wird aufgerufen, ist aber nirgends definiert`));
else gut(`${aufgerufen.length} eigene Funktionen, alle definiert`);

/* ---------- 6. Manifest ---------- */
block("Manifest");
try {
  const m = JSON.parse(lies("manifest.webmanifest"));
  gut("gültiges JSON");
  if (m.icons && m.icons.length) {
    let alleDa = true;
    m.icons.forEach(i => {
      const datei = String(i.src).replace(/^\.\//, "");
      if (!gibtEs(datei)) { schlecht(`Manifest nennt ${datei}, die Datei fehlt`); alleDa = false; }
    });
    if (alleDa) gut(`${m.icons.length} Symbole, alle vorhanden`);
  } else schlecht("keine Symbole im Manifest");
  if (!m.start_url) hinweis("kein start_url gesetzt");
} catch (e) {
  schlecht("Manifest ist kein gültiges JSON: " + e.message);
}

/* ---------- 7. Cache-Liste in sw.js ---------- */
block("Offline-Cache");
const listeRoh = (sw.match(/const\s+FILES\s*=\s*\[([^\]]+)\]/) || [])[1];
if (!listeRoh) schlecht("FILES-Liste in sw.js nicht gefunden");
else {
  const dateien = [...listeRoh.matchAll(/["']([^"']+)["']/g)].map(m => m[1]);
  let alleDa = true;
  dateien.forEach(d => {
    const n = d.replace(/^\.\//, "");
    if (n === "" || n === "/") return;
    if (!gibtEs(n)) { schlecht(`sw.js will ${d} vorhalten, die Datei fehlt`); alleDa = false; }
  });
  if (alleDa) gut(`${dateien.length} Einträge, alle vorhanden`);
  PFLICHT.filter(f => f !== "sw.js").forEach(f => {
    if (!dateien.some(d => d.replace(/^\.\//, "") === f)) hinweis(`${f} steht nicht in der Cache-Liste`);
  });
}

/* ---------- 8. PDF-Umwandlung ---------- */
block("PDF-Umwandlung");
if (/pdfjs/i.test(js)) {
  const url = (js.match(/const\s+PDFJS_BASIS\s*=\s*["']([^"']+)["']/) || [])[1];
  if (!url) schlecht("PDFJS_BASIS nicht gefunden");
  else if (!/^https:\/\//.test(url)) schlecht("PDFJS_BASIS ist keine https-Adresse");
  else if (!/\/$/.test(url)) schlecht("PDFJS_BASIS muss auf / enden, sonst klebt der Dateiname dran");
  else gut("Bezugsadresse " + url);

  ["ladePdfJs", "pdfZuBildern", "pdfAlsShots", "pdfsNachruesten"].forEach(f => {
    if (definiert.has(f)) gut(f + "() ist da");
    else schlecht(f + "() fehlt");
  });
  if (/nurArchiv/.test(js)) gut("Originaldateien werden als Archivstück markiert");
  else schlecht("Kennzeichen nurArchiv fehlt — Originale würden doppelt gedruckt");
  const filter = [...js.matchAll(/filter\(\s*x\s*=>\s*!x\.nurArchiv\s*\)/g)].length;
  if (filter >= 3) gut(`Druck überspringt die Originaldateien (${filter} Stellen: Eigenbeleg, Kosten, Verkauf)`);
  else schlecht(`Filter auf nurArchiv nur an ${filter} Stelle(n) — erwartet werden mindestens 3`);
} else {
  hinweis("keine PDF-Umwandlung im Code — falls gewollt, fehlt sie");
}

/* ---------- 9. Reste ---------- */
block("Reste");
const reste = ["TODO", "FIXME", "XXXX", "Lorem ipsum", "console.log("];
let sauber = true;
reste.forEach(r => {
  if (js.includes(r)) { hinweis(`"${r}" steht noch im Code`); sauber = false; }
});
if (sauber) gut("keine Platzhalter oder Testausgaben");

/* ---------- 9b. Nachweise überall ---------- */
block("Nachweise");
[["Verkauf", "vShotGrid", "VSHOT"], ["Verkaufsrunde", "rShotGrid", "RSHOT"]].forEach(([wo, grid, satz]) => {
  const hatFeld = js.includes(`"${grid}"`);
  const hatSatz = new RegExp(`const\\s+${satz}\\s*=`).test(js);
  if (hatFeld && hatSatz) gut(`${wo}: Anhänge-Feld und Beschriftungen vorhanden`);
  else schlecht(`${wo}: ${!hatFeld ? grid + " fehlt" : satz + " fehlt"}`);
});
["renderNachweise", "ladeNachweise", "sichereNachweise", "nachweisFeld", "vkBelegseiten"].forEach(f => {
  if (definiert.has(f)) gut(f + "() ist da");
  else schlecht(f + "() fehlt");
});
if (/S\.events\s*=\s*await all\("events"\)/.test(js)) gut("Verkaufsrunden werden in den Zustand geladen");
else schlecht("S.events wird nirgends befüllt — die Rundennachweise fehlen im Ausdruck");
if (/kind===\"verkaeufe\"/.test(js)) gut("der Verkaufsbericht lädt die Bilder mit");
else schlecht("buildReport lädt für den Verkaufsbericht keine Bilder");

/* ---------- 10. Logiktest ---------- */
block("Logik");
if (gibtEs("logiktest.js")) {
  const { spawnSync } = require("child_process");
  const r = spawnSync(process.execPath, [path.join(WURZEL, "logiktest.js")], { encoding: "utf8" });
  const zeilen = (r.stdout || "").split("\n").filter(z => z.trim());
  if (r.status === 0) gut(`logiktest.js durchgelaufen (${zeilen.filter(z => z.includes("ok ")).length} Prüfungen)`);
  else {
    schlecht("logiktest.js meldet Fehler:");
    zeilen.filter(z => z.includes("FEHLER")).forEach(z => console.log("        " + z.trim()));
    if (r.stderr) console.log("        " + r.stderr.split("\n")[0]);
  }
} else {
  hinweis("logiktest.js fehlt — die Nachrüstlogik wird nicht geprüft");
}

/* ---------- Ergebnis ---------- */
const kb = n => Math.round(fs.statSync(path.join(WURZEL, n)).size / 1024);
console.log(`\nGröße: index.html ${kb("index.html")} KB · sw.js ${kb("sw.js")} KB`);
console.log(`\n${ok} in Ordnung · ${warnung} Hinweise · ${fehler} Fehler`);
if (fehler) {
  console.log("\nNICHT ausliefern.\n");
  process.exit(1);
}
console.log(`\nStand ${vApp} ist auslieferbar.\n`);
