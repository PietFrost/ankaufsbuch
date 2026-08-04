# Ankaufsbuch

Privatankäufe belegen, Bestand führen, Geschäftsjahr abschließen.

Für Wiederverkäufer, die gebraucht von Privat kaufen — dort, wo es keine
Rechnung und keine Quittung gibt und deshalb ein Eigenbeleg her muss.

Eine Web-App ohne Server, ohne Konto, ohne Abo. Alle Daten bleiben im
Speicher des Geräts und verlassen es nur, wenn du eine Sicherungsdatei
erzeugst.

## Was sie macht

- **Ankauf in unter einer Minute** — Datum, Betrag, Zahlart, Verkäufer,
  dazu Foto der Ware und Bildschirmfotos von Anzeige, Chat und Zahlung.
- **Belegnummern** `EB-JJJJ-NNNN`, fortlaufend und lückenlos, je Jahr neu.
  Belege werden nie gelöscht, nur storniert.
- **Belegqualität** als Ampel: reicht das für das Finanzamt oder fehlt
  Name und Anschrift des Empfängers?
- **Konvolute** in Einzelpositionen zerlegen, Kaufpreis verteilen.
- **Verkäufe** je Position mit Gebühren, Porto und Verpackung.
  Differenz nach § 25a und Deckungsbeitrag getrennt.
- **Kosten** inklusive Fahrtkosten-Rechner.
- **Meldegrenzen** der Plattformen im Blick (30 Verkäufe / 2.000 €).
- **Ausdrucke**: Ankaufsjournal, Eigenbelege einzeln, § 25a-Aufstellung,
  Lagerliste zum 31.12., Kostenaufstellung, Verfahrensdokumentation.
- **Sicherung** als eine Datei mit allen Bildern. Einlesen ergänzt nur.

## Einrichten

Siehe [INSTALL.md](INSTALL.md). Kurz: die fünf Dateien auf einen
Webserver oder GitHub Pages, in Safari öffnen, zum Home-Bildschirm
hinzufügen.

## Dateien

    index.html            gesamte App
    sw.js                 Offline-Cache
    manifest.webmanifest  Installation
    icon-180.png          Symbol iPhone
    icon-512.png          Symbol groß

## Datenschutz

Kein Netzwerkverkehr nach dem Laden. Keine Analyse, keine Fremdskripte.
Die Bilder werden vor dem Speichern lokal verkleinert.

## Kein Steuerrat

Das Programm bildet ab, wie Ankäufe von Privat belegt werden können.
Ob deine Belege im Einzelfall ausreichen, sagt dir dein Steuerberater.
Lass die Eigenbeleg-Vorlage und die Verfahrensdokumentation einmal
gegenlesen, bevor du dich darauf verlässt.
