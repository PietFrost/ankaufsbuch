# Ankaufsbuch installieren

Die App braucht eine echte Web-Adresse. Aus der Dateien-App heraus geöffnet
verweigert iOS den dauerhaften Speicher und die Installation auf dem
Home-Bildschirm. Zwei Wege, beide dauern ein paar Minuten.

Alle Dateien müssen im selben Ordner liegen:

    index.html
    sw.js
    manifest.webmanifest
    icon-180.png
    icon-512.png

---

## Weg 1 — Raspberry Pi

Auf dem Pi:

    sudo apt install -y nginx
    sudo mkdir -p /var/www/ankaufsbuch

Dateien vom Rechner auf den Pi kopieren:

    scp index.html sw.js manifest.webmanifest icon-*.png pi@<PI-IP>:/tmp/
    sudo mv /tmp/index.html /tmp/sw.js /tmp/manifest.webmanifest /tmp/icon-*.png /var/www/ankaufsbuch/

Site anlegen — `/etc/nginx/sites-available/ankaufsbuch`:

    server {
        listen 8088;
        root /var/www/ankaufsbuch;
        index index.html;
        add_header Service-Worker-Allowed "/";
    }

Aktivieren:

    sudo ln -s /etc/nginx/sites-available/ankaufsbuch /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx

Aufrufen: `http://<PI-IP>:8088`

**Wichtig:** Auf `http://` im lokalen Netz laufen Service Worker unter iOS
nicht. Zwei Möglichkeiten:

- **Tailscale** auf Pi und iPhone installieren. Tailscale liefert einen
  HTTPS-Namen (`tailscale cert` bzw. Tailscale Serve), damit läuft alles
  und die App ist auch unterwegs erreichbar.
- Oder Weg 2 nehmen und den Pi später als Backend nachrüsten.

---

## Weg 2 — GitHub Pages (geht komplett vom iPhone aus)

1. github.com in Safari öffnen, anmelden.
2. Neues Repository anlegen, Name z. B. `ankaufsbuch`, **Public**.
3. "uploading an existing file" antippen, alle fünf Dateien hochladen,
   "Commit changes".
4. Settings → Pages → Source: "Deploy from a branch", Branch `main`,
   Ordner `/ (root)`, Save.
5. Nach ein bis zwei Minuten läuft
   `https://<dein-name>.github.io/ankaufsbuch/`

Public heißt: der **Programmcode** ist öffentlich. Deine Ankäufe, Bilder und
Beträge nicht — die liegen ausschließlich im Speicher deines iPhones und
werden nie hochgeladen.

---

## Auf dem iPhone einrichten

1. Adresse in **Safari** öffnen (nicht Chrome, nicht der In-App-Browser).
2. Teilen-Symbol → **Zum Home-Bildschirm** → Hinzufügen.
3. App über das neue Symbol starten, nicht über Safari.
4. In der App: Abschluss → Stammdaten ausfüllen.
5. Flugmodus anschalten und die App einmal starten. Läuft sie, sitzt der
   Offline-Cache.

---

## Damit nichts verloren geht

Die Daten liegen im Speicher der installierten Web-App. Sie überleben
Neustarts und Wochen ohne Nutzung — aber **nicht** das Löschen des
Home-Bildschirm-Symbols und nicht "Website-Daten entfernen".

Deshalb: **Abschluss → Sicherung erstellen**, Datei in iCloud Drive ablegen.
Die App erinnert dich, wenn die letzte Sicherung älter als sieben Tage ist.
Vor jedem iOS-Update und vor jedem Gerätewechsel: sichern.

Beim neuen Gerät: App installieren, dann Abschluss → Sicherung einlesen.
Das Einlesen ergänzt nur fehlende Datensätze und überschreibt nichts.
