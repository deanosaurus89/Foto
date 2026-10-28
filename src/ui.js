import { PRESETS } from "./lib/layout.js";
import { formatDisplayDate, formatGps } from "./lib/metadata.js";

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

export function installHint() {
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  const standalone =
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  if (!ios || standalone) return "";
  return `<p class="hint install-hint">Auf dem iPhone: in Safari auf Teilen tippen (Quadrat mit Pfeil nach oben), dann „Zum Home-Bildschirm“.</p>`;
}

function header(title, { back = false } = {}) {
  return `<header class="top">
    ${back ? `<button type="button" class="text-btn" data-action="home">Zurück</button>` : `<span class="mark" aria-hidden="true"></span>`}
    <h1>${esc(title)}</h1>
    <span></span>
  </header>`;
}

export function homeHTML() {
  return `${header("Foto")}
    <main class="content">
      <p class="lede">Streifen und Collagen aus der Mediathek. Die Fotos bleiben auf diesem Gerät.</p>
      <button type="button" class="choice" data-action="mode-combine">
        <span class="choice-kicker">Kombinieren</span>
        <span class="choice-title">Streifen</span>
        <span class="choice-text">2–10 Fotos in einer Reihe oder Spalte. Alle Kacheln gleich groß, mit Rahmen und Zuschnitt.</span>
      </button>
      <button type="button" class="choice" data-action="mode-collage">
        <span class="choice-kicker">Anordnen</span>
        <span class="choice-title">Collage</span>
        <span class="choice-text">Vorlagen oder eigenes Raster, Rahmenbreite und Zuschnitt pro Foto — ohne Umweg über die Fotos-App.</span>
      </button>
      ${installHint()}
    </main>`;
}

export function pickHTML(state) {
  const count = state.photos.length;
  const need = state.mode === "combine" ? "Streifen braucht 2–10 Fotos." : "Collage braucht mindestens 2 Fotos.";
  const items = state.photos
    .map(
      (photo, index) => `<li>
        <span>${esc(photo.name)}</span>
        <button type="button" data-action="remove" data-index="${index}" aria-label="Entfernen">Entfernen</button>
      </li>`,
    )
    .join("");
  return `${header(state.mode === "collage" ? "Collage" : "Streifen", { back: true })}
    <main class="content">
      <h2 class="screen-title">Fotos wählen</h2>
      <p class="lede">HEIC und JPEG aus der Mediathek. Verarbeitung nur auf diesem Gerät.</p>
      <label class="btn primary">
        Fotos auswählen
        <input id="file" class="file-input" type="file" accept="image/*,.heic,.heif" multiple>
      </label>
      <p id="status" class="status" ${state.status ? "" : "hidden"}>${esc(state.status)}</p>
      <div id="messages" class="messages" aria-live="polite"></div>
      <ul class="file-list">${items}</ul>
      <p class="hint">${count} ${count === 1 ? "Foto" : "Fotos"} ausgewählt. ${need}</p>
      <button type="button" class="btn primary" data-action="continue" ${count >= 2 ? "" : "disabled"}>Weiter</button>
      ${count ? `<button type="button" class="btn ghost" data-action="clear-photos">Alle entfernen</button>` : ""}
    </main>`;
}

const ASPECTS = [
  { value: 1, label: "1:1" },
  { value: 4 / 5, label: "4:5" },
  { value: 3 / 2, label: "3:2" },
  { value: 16 / 9, label: "16:9" },
];

function segmented(action, options, current, { compare = (a, b) => a === b } = {}) {
  return `<div class="segmented" role="group">${options
    .map((option) => {
      const pressed = compare(option.value, current) ? "true" : "false";
      return `<button type="button" data-action="${action}" data-value="${esc(option.value)}" aria-pressed="${pressed}">${esc(option.label)}</button>`;
    })
    .join("")}</div>`;
}

function aspectPressed(value, current) {
  return Math.abs(value - current) < 0.02;
}

export function editorHTML(state) {
  const collage = state.mode === "collage";
  const settings = collage ? state.collage : state.combine;
  const title = collage ? "Collage" : "Streifen";
  const resMode = settings.resolutionMode;
  const resValue = collage
    ? resMode === "long"
      ? settings.longSide
      : settings.cell
    : settings.resolution;
  const resLabel = collage
    ? resMode === "long"
      ? "Lange Seite"
      : "Kachelkante"
    : resMode === "width"
      ? "Breite des Ergebnisses"
      : resMode === "height"
        ? "Höhe des Ergebnisses"
        : "Kantenlänge der Kachel";

  const layoutBlock = collage
    ? `<section class="panel">
        <h2>Layout</h2>
        <div class="chips">${PRESETS.map((preset) => {
          const pressed = preset.id === settings.preset ? "true" : "false";
          return `<button type="button" class="chip" data-action="preset" data-value="${preset.id}" aria-pressed="${pressed}">${esc(preset.name)}</button>`;
        }).join("")}</div>
        <div id="custom-grid" class="grid-steppers" ${settings.preset === "custom" ? "" : "hidden"}>
          <div class="stepper-field">
            <span>Zeilen</span>
            <div class="stepper">
              <button type="button" data-action="rows-dec" aria-label="Weniger Zeilen">−</button>
              <strong id="rows-value">${settings.rows}</strong>
              <button type="button" data-action="rows-inc" aria-label="Mehr Zeilen">+</button>
            </div>
          </div>
          <div class="stepper-field">
            <span>Spalten</span>
            <div class="stepper">
              <button type="button" data-action="cols-dec" aria-label="Weniger Spalten">−</button>
              <strong id="cols-value">${settings.cols}</strong>
              <button type="button" data-action="cols-inc" aria-label="Mehr Spalten">+</button>
            </div>
          </div>
        </div>
      </section>
      <section class="panel">
        <h2>Auflösung</h2>
        ${segmented(
          "resmode",
          [
            { value: "cell", label: "Kachelkante" },
            { value: "long", label: "Lange Seite" },
          ],
          resMode,
        )}
        <label class="field" for="resolution"><span id="res-label">${resLabel}</span>
          <input id="resolution" inputmode="numeric" type="number" min="256" max="8192" value="${resValue}">
        </label>
        <div class="chips">
          ${[800, 1200, 1600, 2048].map((n) => `<button type="button" class="chip" data-action="res-chip" data-value="${n}">${n}</button>`).join("")}
        </div>
      </section>`
    : `<section class="panel">
        <h2>Anordnung</h2>
        <p class="hint">Alle Kacheln werden auf dieselbe Größe skaliert. Was nicht ins Format passt, wird beschnitten — den Ausschnitt stellst du unten ein.</p>
        ${segmented(
          "direction",
          [
            { value: "horizontal", label: "Nebeneinander" },
            { value: "vertical", label: "Untereinander" },
          ],
          settings.direction,
        )}
        <h3>Kachelformat</h3>
        ${segmented(
          "aspect",
          ASPECTS.map((item) => ({ value: String(item.value), label: item.label })),
          String(settings.aspect),
          { compare: (value, current) => aspectPressed(Number(value), Number(current)) },
        )}
      </section>
      <section class="panel">
        <h2>Auflösung</h2>
        ${segmented(
          "resmode",
          [
            { value: "edge", label: "Kantenlänge" },
            { value: "width", label: "Breite" },
            { value: "height", label: "Höhe" },
          ],
          resMode,
        )}
        <label class="field" for="resolution"><span id="res-label">${resLabel}</span>
          <input id="resolution" inputmode="numeric" type="number" min="256" max="8192" value="${resValue}">
        </label>
        <div class="chips">
          ${[1080, 1600, 2048, 3024].map((n) => `<button type="button" class="chip" data-action="res-chip" data-value="${n}">${n}</button>`).join("")}
        </div>
      </section>`;

  return `${header(title, { back: true })}
    <main class="content editor">
      <div id="messages" class="messages" aria-live="polite"></div>
      <p id="status" class="status" hidden></p>
      <section class="preview-card">
        <div class="preview-scroll"><canvas id="preview"></canvas></div>
        <p id="size-label" class="meta-line"></p>
        <p id="layout-warning" class="warning" hidden></p>
      </section>
      <section class="panel">
        <h2>Reihenfolge</h2>
        <div id="thumbs" class="thumbs"></div>
        <div class="row-actions">
          <label class="btn secondary">
            Weitere Fotos
            <input id="file" class="file-input" type="file" accept="image/*,.heic,.heif" multiple>
          </label>
          <button type="button" class="btn ghost" data-action="clear-photos">Alle entfernen</button>
        </div>
      </section>
      <section class="panel">
        <h2>Ausschnitt</h2>
        <p id="crop-label" class="meta-line">Foto</p>
        <p class="hint">Ziehen verschiebt das Foto in der Kachel, zwei Finger oder der Regler zoomen. Feld in der Vorschau antippen, um es zu wählen.</p>
        <div class="cropper-wrap"><canvas id="cropper"></canvas></div>
        <label class="field" for="zoom">Zoom <span id="zoom-value">1.00×</span>
          <input id="zoom" type="range" min="1" max="3" step="0.01" value="1">
        </label>
        <button type="button" class="btn ghost" data-action="reset-crop">Ausschnitt zurücksetzen</button>
      </section>
      ${layoutBlock}
      <section class="panel">
        <h2>Rahmen</h2>
        <label class="check"><input id="symmetric" type="checkbox" ${settings.symmetric ? "checked" : ""}> Symmetrisch — Außenrahmen und Abstand gleich</label>
        <label class="field" for="gap"><span id="gap-name">${settings.symmetric ? "Rahmenbreite" : "Abstand"}</span> <span id="gap-value">${settings.gap} px</span>
          <input id="gap" type="range" min="0" max="120" step="1" value="${settings.gap}">
        </label>
        <div id="margin-wrap" ${settings.symmetric ? "hidden" : ""}>
          <label class="field" for="margin">Außenrahmen <span id="margin-value">${settings.margin} px</span>
            <input id="margin" type="range" min="0" max="120" step="1" value="${settings.margin}">
          </label>
        </div>
        <div class="color-row">
          <span>Hintergrund</span>
          <button type="button" class="swatch" data-action="bg" data-value="#ffffff" aria-label="Weiß" style="background:#ffffff"></button>
          <button type="button" class="swatch" data-action="bg" data-value="#f4f0e6" aria-label="Creme" style="background:#f4f0e6"></button>
          <button type="button" class="swatch" data-action="bg" data-value="#1f1a17" aria-label="Schwarz" style="background:#1f1a17"></button>
          <input id="bg" type="color" value="${esc(settings.bg)}" aria-label="Hintergrundfarbe">
        </div>
      </section>
      <section class="panel">
        <h2>Metadaten</h2>
        <p class="hint">Werden in die JPEG-Datei geschrieben. Die Uhrzeit ist die Ortszeit dieses Geräts.</p>
        <fieldset>
          <legend>Aufnahmedatum</legend>
          <label class="radio"><input type="radio" name="dateMode" value="mid" ${state.meta.dateMode === "mid" ? "checked" : ""}> Mittelwert der Aufnahmezeiten</label>
          <label class="radio"><input type="radio" name="dateMode" value="pick" ${state.meta.dateMode === "pick" ? "checked" : ""}> Datum eines Fotos</label>
          <div id="date-pick-wrap" ${state.meta.dateMode === "pick" ? "" : "hidden"}>
            <select id="date-index" aria-label="Foto für das Datum"></select>
          </div>
          <label class="radio"><input type="radio" name="dateMode" value="custom" ${state.meta.dateMode === "custom" ? "checked" : ""}> Eigene Zeit</label>
          <div id="custom-date-wrap" ${state.meta.dateMode === "custom" ? "" : "hidden"}>
            <input id="custom-date" type="datetime-local" value="${esc(state.meta.customDate)}">
          </div>
        </fieldset>
        <fieldset>
          <legend>Ort</legend>
          <p class="hint">Standard ist das erste Foto mit GPS. Weichen die Orte ab, nimm den häufigsten Ort (auf etwa 10 m gerundet) oder ein bestimmtes Foto. „Ohne Ort“ lässt die GPS-Daten weg.</p>
          <label class="radio"><input type="radio" name="gpsMode" value="first" ${state.meta.gpsMode === "first" ? "checked" : ""}> Erstes Foto mit GPS</label>
          <label class="radio"><input type="radio" name="gpsMode" value="common" ${state.meta.gpsMode === "common" ? "checked" : ""}> Häufigster Ort</label>
          <label class="radio"><input type="radio" name="gpsMode" value="pick" ${state.meta.gpsMode === "pick" ? "checked" : ""}> Bestimmtes Foto</label>
          <div id="gps-pick-wrap" ${state.meta.gpsMode === "pick" ? "" : "hidden"}>
            <select id="gps-index" aria-label="Foto für den Ort"></select>
          </div>
          <label class="radio"><input type="radio" name="gpsMode" value="none" ${state.meta.gpsMode === "none" ? "checked" : ""}> Ohne Ort</label>
        </fieldset>
        <p id="meta-summary" class="summary" aria-live="polite"></p>
        <label class="field" for="quality">Qualität
          <select id="quality">
            <option value="0.92" ${state.meta.quality === "0.92" ? "selected" : ""}>Hoch</option>
            <option value="0.82" ${state.meta.quality === "0.82" ? "selected" : ""}>Mittel</option>
          </select>
        </label>
      </section>
      <section id="result" class="result" hidden></section>
    </main>
    <div class="action-bar">
      <button type="button" class="btn primary" id="export" data-action="export">JPEG sichern</button>
      <button type="button" class="btn secondary" id="share" data-action="share">Teilen</button>
    </div>`;
}

export function messagesHTML(messages) {
  if (!messages.length) return "";
  return `${messages.map((msg) => `<p>${esc(msg)}</p>`).join("")}
    <button type="button" class="text-btn" data-action="clear-messages">Hinweise schließen</button>`;
}

export function thumbHTML(photo, index, { selected, unused }) {
  return `<div class="thumb${selected ? " selected" : ""}">
    <button type="button" class="thumb-pick" data-action="select" data-index="${index}" aria-pressed="${selected ? "true" : "false"}">
      <canvas class="thumb-canvas" data-index="${index}" width="148" height="148"></canvas>
      ${unused ? `<span class="badge">nicht im Layout</span>` : ""}
      <span class="thumb-name">${index + 1}. ${esc(photo.name)}</span>
    </button>
    <div class="thumb-actions">
      <button type="button" data-action="move" data-dir="-1" data-index="${index}" aria-label="Nach vorn">←</button>
      <button type="button" data-action="remove" data-index="${index}" aria-label="Entfernen">×</button>
      <button type="button" data-action="move" data-dir="1" data-index="${index}" aria-label="Nach hinten">→</button>
    </div>
  </div>`;
}

export function metaOptionsHTML(photos) {
  const date = photos
    .map((photo, index) => {
      const label = `${index + 1}. ${photo.name} · ${photo.date ? formatDisplayDate(photo.date) : "kein Datum"}`;
      return `<option value="${index}" ${photo.date ? "" : "disabled"}>${esc(label)}</option>`;
    })
    .join("");
  const gps = photos
    .map((photo, index) => ({ photo, index }))
    .filter(({ photo }) => photo.gps)
    .map(({ photo, index }) => {
      const label = `${index + 1}. ${photo.name} · ${formatGps(photo.gps)}`;
      return `<option value="${index}">${esc(label)}</option>`;
    })
    .join("");
  return { date, gps };
}

export function resultHTML({ name, exifError, ios }) {
  const note = exifError
    ? "Die Metadaten konnten nicht eingebettet werden. Die JPEG-Datei ist ohne EXIF."
    : "Datum und, falls gewählt, der Ort stehen in der JPEG-Datei.";
  const hint = ios
    ? "Auf dem iPhone: Teilen antippen und „Bild sichern“ wählen. Ein normaler Download öffnet manchmal nur die Vorschau."
    : "Die Datei liegt im Download-Ordner.";
  return `<img id="result-img" alt="Exportierte Vorschau">
    <p><strong>${esc(name)}</strong></p>
    <p>${esc(note)}</p>
    <p class="hint">${esc(hint)}</p>`;
}

export function layoutWarning(layout, count, mode) {
  if (mode === "combine") {
    if (count < 2) return "Mindestens 2 Fotos für einen Streifen.";
    if (count > 10) return "Höchstens 10 Fotos. Entferne bitte die überzähligen.";
    return "";
  }
  const cells = layout.tiles.length;
  if (count < 2) return "Mindestens 2 Fotos für eine Collage.";
  if (count < cells) {
    return `Layout mit ${cells} Feldern, aber nur ${count} Fotos. Leere Felder bleiben in der Hintergrundfarbe.`;
  }
  if (count > cells) {
    return `Dieses Layout nutzt die ersten ${cells} von ${count} Fotos. Die Reihenfolge bestimmt, welche das sind.`;
  }
  return "";
}

export function metadataSummary(resolved) {
  let dateNote = `Datum: ${formatDisplayDate(resolved.date)}`;
  if (resolved.source === "now") dateNote += " (keine Aufnahmezeit gefunden, es gilt die aktuelle Uhrzeit)";
  else if (resolved.source === "mid") dateNote += " (Mittelwert)";
  else if (resolved.source === "pick") dateNote += " (gewähltes Foto)";
  else if (resolved.source === "custom") dateNote += " (eigene Zeit)";
  else if (resolved.source === "mid-fallback") dateNote += " (Mittelwert, das gewählte Foto hat kein Datum)";
  const gpsText = formatGps(resolved.gps.gps);
  let gpsNote = "Ort: wird nicht geschrieben";
  if (resolved.gps.reason === "missing") gpsNote = "Ort: keine GPS-Daten in den Fotos";
  else if (resolved.gps.reason === "first" && gpsText) gpsNote = `Ort: ${gpsText} (erstes Foto mit GPS)`;
  else if (resolved.gps.reason === "common" && gpsText) {
    gpsNote = `Ort: ${gpsText} (häufigster Ort, ${resolved.gps.count} von ${resolved.gps.total})`;
  } else if (resolved.gps.reason === "pick" && gpsText) gpsNote = `Ort: ${gpsText} (gewähltes Foto)`;
  else if (resolved.gps.reason === "pick-fallback" && gpsText) {
    gpsNote = `Ort: ${gpsText} (gewähltes Foto ohne GPS, daher das erste mit GPS)`;
  }
  return `${dateNote}\n${gpsNote}`;
}
