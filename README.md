# SmartMonitoringFrontend

Die Installationsanleitung und weitere Informationen befinden sich im Wiki.

## Diagrammkalender

Monats- und Wochenkalender mit einem kleinen Diagramm je Tag. Ein Klick auf einen Tag öffnet das
Tagesdiagramm (Originaldaten oder Mittelwerte, Linie oder Treppe, Min/Max/Ø). Funktioniert mit jeder
SmartData-Tabelle mit Zeitspalte und mit jedem numerischen Attribut; Zeitspalte und Attribute erkennt
die Komponente selbst.

### Einbindung

| Teil | Datei |
|---|---|
| Seite (Muster `charts.html`) | `sites/datavisus/calendar.html` |
| Optionen (Muster `charts.js`) | `js/datavisus/calendar.js` (`calendar_options`, `oo_change_options`) |
| Komponente | SWAC `components/Diagramcalendar/` (Abhängigkeit, liegt im SWAC-Repo) |
| Menü „Diagrammkalender“ | `data/admin/presets/base.json`: `tbl_navigationroute` id 503 (unter 500 „Datenvisualisierung“, neben Charts 501), `tbl_systemconfiguration` id 503 `func_datavisus_calendar` |
| Funktion ein/aus | `data/admin/functions/functions.json`: id 503 `func_datavisus_calendar` (wie Charts 501) |
| Texte | `data/languages/app_de.js`, `app_en.js`: `menu_datavisus_calendar`, `data_calendar_*`, `func_datavisus_calendar*` |

`configuration.js` muss nicht geändert werden; die Komponente nimmt die SmartData-Adresse aus
`SWAC_config.datasources`.

**Neue Installation:** Beim Installieren der Presets in **Admin → Setup** werden Menüroute 503 und
Systemkonfiguration 503 mit angelegt.

**Bestehende Installation:**

- **„Aktualisieren“** in Admin → Setup ergänzt nur den Eintrag `func_datavisus_calendar` (id 503) in
  `tbl_systemconfiguration`. Nur dieser Datenblock hat in `base.json` ein `checkfor` (`ckey`); dafür
  legt das Setup fehlende Einträge per POST an. Bestehende Einträge werden dabei weder geändert
  noch gelöscht.
- Die **Menüroute 503** in `tbl_navigationroute` ergänzt „Aktualisieren“ **nicht**, weil dieser
  Datenblock kein `checkfor` hat. Sie muss einmal per POST an SmartData angelegt werden:
  `POST /SmartData/smartdata/records/tbl_navigationroute?storage=smartmonitoring` mit
  `[{"id": 503, "name": "menu_datavisus_calendar", "rfrom": "*", "rto": "datavisus/calendar.html", "parent": 500, "active": true}]`.
  Danach lässt sich der Eintrag unter **Admin → Funktionen** ein- und ausschalten.
- ⚠️ **„Deinstallieren“** in Admin → Setup löscht die **ganze Tabelle** (`DELETE` der Collection mit
  `cascade=true`), also alle Menüeinträge bzw. die ganze Systemkonfiguration, nicht nur den Kalender.
- ⚠️ Ein Eintrag wird nur mit id gelöscht: `DELETE …/records/tbl_navigationroute/503?storage=smartmonitoring`.
  Ohne `/503` löscht SmartData **alle** Einträge der Tabelle.

In einer anderen Seite:

```html
<div id="calendar" swa="Diagramcalendar FROM {{data_collection}} OPTIONS calendar_options"></div>
```

### URL-Parameter

| Parameter | Beispiel | Bedeutung |
|---|---|---|
| `data_collection` | `exampledata_timeseries` | Tabelle des Geräts (setzt die Geräteauswahl `oo_change`). Ohne Angabe: erstes Gerät aus `tbl_observedobject`. |
| `month` | `2026-03` | angezeigter Monat. Ohne Angabe: Monat der neuesten Daten. |
| `view`, `week` | `view=week&week=2026-03-23` | Wochenansicht ab Montag |
| `attrs` | `double_1,double_2` | ausgewählte Attribute (fehlende werden ignoriert) |
| `interval` | `15` | Mittelwert-Intervall in Minuten |
| `style` | `step` | Treppe statt Linie |

Beim Gerätewechsel bleiben `month`, `week`, `view`, `attrs`, `interval` und `style` erhalten.

### Optionen (`calendar_options`)

Alle Optionen sind optional. Die Seite setzt nur `showWhenNoData: true` und `startMonth: 'latest'`.

| Option | Standard | Bedeutung |
|---|---|---|
| `attributes` | `[]` | vorausgewählte Attribute, leer = erstes verfügbares |
| `view` | `'month'` | Startansicht `'month'` oder `'week'` |
| `interval` / `weekInterval` | `15` / `5` | Mittelwert-Intervall in Monat / Woche (Minuten, 0 = Rohdaten) |
| `intervalChoices` | `[1, 5, 10, 15, 30, 60]` | auswählbare Intervalle |
| `lineStyle` | `'line'` | `'line'` oder `'step'` (Treppe); ein Intervall ohne Daten bleibt leer |
| `startMonth` | `'latest'` | `'latest'`, `'today'` oder `'JJJJ-MM'` |
| `detailIntervalMinutes` / `detailIntervalChoices` | `0` / `[0, 15, 30, 60]` | Auflösung des Tagesdiagramms (0 = Originaldaten) |
| `attributeMeta` | `{}` | Anzeigename, Einheit, Farbe je Attribut, auch `'<tabelle>.<attribut>'` |
| `excludeAttrs`, `excludePrefixes`, `excludeSuffixes` | `null` | Spalten, die keine Messwerte sind (ersetzt die Standardliste) |
| `timeZone` / `dataTimeZone` | `'Europe/Berlin'` / `null` | Anzeige in MEZ/MESZ; Zone für Zeitstempel ohne Zone |
| `timeAttr` | `null` | Zeitspalte erzwingen (sonst `ts` bzw. erste timestamp-Spalte) |
| `gapFactor` | `2.5` | nur Originaldaten: Lücke ab üblichem Messabstand × Faktor |
| `maxRecords` | `200000` | Warnung ab dieser Anzahl Datensätze je Abruf |
| `autoSelectFirstDevice` | `true` | ohne Tabelle das erste Gerät nehmen |
| `syncUrl` | `true` | Zeitraum und Auswahl in die URL schreiben |

Vollständige Liste: `desc.opts` in `components/Diagramcalendar/Diagramcalendar.js` (SWAC).

### Test-URLs (lokal, SmartDeveloper)

- Monat: <http://localhost:8080/SmartMonitoringFrontend/sites/datavisus/calendar.html?data_collection=exampledata_timeseries&month=2026-03>
- Woche mit Zeitumstellung: <http://localhost:8080/SmartMonitoringFrontend/sites/datavisus/calendar.html?data_collection=exampledata_timeseries&view=week&week=2026-03-23&attrs=double_1,double_2>
- Treppe: <http://localhost:8080/SmartMonitoringFrontend/sites/datavisus/calendar.html?data_collection=exampledata_timeseries&month=2026-03&style=step>
- ohne Parameter (erstes Gerät, neueste Daten): <http://localhost:8080/SmartMonitoringFrontend/sites/datavisus/calendar.html>
