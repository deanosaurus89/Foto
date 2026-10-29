# Foto

Kleine Web-App fürs iPhone: Fotos aus der Mediathek zu einem **Streifen** oder einer **Collage** zusammensetzen und als JPEG sichern. Datum und Ort bleiben dabei erhalten, soweit die Ausgangsbilder sie enthalten.

Alles läuft im Browser. Es gibt keinen Server, und die Bilder werden nicht hochgeladen.

## Funktionen

- **Streifen:** 2–10 Fotos nebeneinander oder untereinander, alle auf dieselbe Kachelgröße. Du stellst die lange Seite des fertigen Bildes ein, dazu ein Kachelformat wie 1:1 oder 4:5. Optionaler Rahmen, symmetrisch als Vorgabe.
- **Collage:** Zuerst Zeilen und Spalten (bis 10×10, jederzeit erweiterbar). Die Fotos liegen danach zufällig. Kacheln zieht man auf leere Felder oder tauscht sie; aus dem schmalen Filmstreifen zieht man ein Foto auf ein Feld. Mehrere Felder antippen und zusammenführen ergibt eine große Kachel, die sich als Ganzes verschieben lässt. Ein Regler rundet die Ecken. Rahmen und Abstände bleiben gleichmäßig.
- **Zuschnitt in der Kachel:** Ziehen, Zwei-Finger-Zoom oder Regler. Vorher in der Fotos-App beschneiden ist nicht nötig.
- **Export:** JPEG mit EXIF. Aufnahmedatum als Mittelwert, von einem gewählten Foto oder als eigene Zeit. Ort standardmäßig vom ersten Foto mit GPS; alternativ der häufigste Ort (auf etwa 10 m gerundet), ein bestimmtes Foto oder kein Ort.

HEIC/HEIF wird gelesen, wenn der Browser es kann (Safari auf dem iPhone). Gelingt das nicht, erscheint ein Hinweis, das Foto in der Fotos-App als JPEG zu sichern. Schreiben von HEIC im Browser ist unzuverlässig, deshalb ist JPEG das Exportformat.

Große Vorlagen werden vor dem Zusammensetzen auf höchstens 3072 Pixel an der langen Seite verkleinert, damit Safari nicht wegen des Speicherbedarfs abbricht. Die Ausgabe selbst ist auf 8192 Pixel Kantenlänge und etwa 24 Megapixel begrenzt.

## Lokal öffnen

Die Seite lässt sich nicht per Doppelklick auf `index.html` öffnen (ES-Module und der Datei-Picker brauchen einen lokalen Server).

```bash
npm install
npm run dev
```

Vite zeigt die Adresse, in der Regel [http://localhost:5173](http://localhost:5173).

Produktion lokal prüfen:

```bash
npm test
npm run build
npm run preview
```

Die Vorschau liegt auf [http://127.0.0.1:4173](http://127.0.0.1:4173).

## GitHub Pages

Die App ist statisch und für Projekt-Seiten gedacht (`https://<benutzer>.github.io/Foto/`). Pfade sind relativ, ein extra `base` in Vite ist nicht nötig.

1. Im Repository **Settings → Pages** öffnen.
2. Unter **Build and deployment** als **Source** **GitHub Actions** wählen (nicht „Deploy from a branch“).
3. Der Workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) läuft bei jedem Push auf `main`: Tests, `npm run build`, Upload von `dist`, Deploy.
4. Die Adresse steht danach unter Settings → Pages, für dieses Repo typischerweise `https://deanosaurus89.github.io/Foto/`.

Wenn der erste Lauf mit einer Meldung wie „Get Pages site failed“ abbricht, ist die Source noch nicht auf GitHub Actions gestellt. Einmal umstellen und den Workflow unter **Actions → Deploy GitHub Pages** erneut starten.

Der Workflow braucht die Umgebung `github-pages`. GitHub legt sie beim ersten Pages-Deploy mit Actions an. Das Repository muss für kostenlose Pages öffentlich sein, sofern kein kostenpflichtiger Plan etwas anderes erlaubt.

## Zum Home-Bildschirm (iPhone)

Zielgerät ist das iPhone 15 Pro Max in Safari, Hochformat.

1. Die Pages-Adresse (oder die lokale Adresse im selben Netz) in **Safari** öffnen. Andere Browser auf dem iPhone können die Seite zeigen, „Zum Home-Bildschirm“ legt die App aber aus Safari heraus an.
2. Auf **Teilen** tippen (Quadrat mit Pfeil nach oben).
3. **Zum Home-Bildschirm** wählen und **Hinzufügen** bestätigen.

Danach startet Foto ohne Browser-Leiste. Ein Hinweis auf der Startseite erscheint auf dem iPhone, solange die Seite noch in Safari läuft. Manifest, Service Worker (Offline-Hülle nach dem ersten Laden), Apple-Touch-Icon und ein Startbild für 430×932 pt sind enthalten.

Safari kann die Fotos-App nicht lautlos beschreiben. **In Fotos sichern** öffnet das Teilen-Menü; dort **Bild sichern** tippen. Ein reiner Download öffnet auf dem iPhone oft nur eine Vorschau. Die JPEG-Datei enthält Datum und Ort wie oben gewählt.

## Hinweise

- Standort und Datum kommen aus den EXIF-Daten der gewählten Dateien. Fehlt beides, lässt sich die Zeit von Hand setzen; ohne GPS bleibt der Ort leer, bis eine andere Strategie greift.
- „Häufigster Ort“ rundet auf vier Nachkommastellen (etwa 11 m) und nimmt bei Gleichstand das frühere Häufungsgebiet.
- Die geschriebene Uhrzeit ist die Ortszeit des Geräts, ohne Zeitzonenfeld. So legen es die meisten Kameras ab.
- Nach dem ersten Besuch speichert der Service Worker die App-Hülle. Die Fotos selbst werden nicht gecacht und nicht übertragen.
