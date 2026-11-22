
"use strict";

import {
    demoRange,
    demoDevices,
    getDemoAvailability
} from "./availability-demo.js";

import {
    createAvailabilityRequestManager
} from "./availability-requests.js";

const CONFIG = {
    missingEndpoint: "/SmartDataLyser/smartdatalyser/check/missingperiods",
    recordsEndpoint: "/SmartData/smartdata/records",
    smartdataurl: "/SmartData",
    storage: "smartmonitoring",
    dateattribute: "ts",
    maxRecords: 50000
};

let source = "demo";
let realDevices = [];
let singleSelector;
let multiSelector;
let chart;
let heatmap;
let requestController = null;
let requestVersion = 0;

const $ = id => document.getElementById(id);

function status(message, error = false) {
    $("deviceStatus").textContent = message;
    $("deviceStatus").classList.toggle("is-error", error);
}

function dateInput(ms) {
    const d = new Date(ms);
    const local = new Date(ms - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
}

function initializeDates() {
    $("startDate").value = dateInput(demoRange.start);
    $("endDate").value = dateInput(demoRange.end);
}

function getPeriod() {
    const from = $("startDate").value;
    const to = $("endDate").value;

    if (!from || !to) {
        throw new Error("Bitte Start und Ende auswählen.");
    }

    const start = new Date(from).getTime();
    const end = new Date(to).getTime();

    if (!Number.isFinite(start) ||
        !Number.isFinite(end) || start >= end) {
        throw new Error("Ungültiger Zeitraum.");
    }

    return { start, end, from, to };
}

function toArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (value instanceof Map) return [...value.values()];
    if (typeof value.getSets === "function") {
        return toArray(value.getSets());
    }
    if (typeof value[Symbol.iterator] === "function") {
        return [...value];
    }
    if (typeof value === "object") {
        return Object.values(value);
    }
    return [];
}

function normalizeDevice(item) {
    if (!item || typeof item !== "object") return null;

    const id = item.id ?? item.oo_id ?? item.observedobject_id;
    if (id == null || id === "") return null;

    const name = item.name ?? item.label ?? item.title ?? id;
    if (String(name).trim() === "{name}") return null;

    const parentId =
        item.parentId ??
        item.parent_id ??
        item.parent ??
        item.parentid ??
        null;

    return {
        id: String(id),
        name: String(name),
        parentId: parentId == null || parentId === ""
            ? null : String(parentId),
        collection: item.data_collection ?? item.collection ?? null,
        measurerate: item.measurerate ?? item.measurefreq ?? null
    };
}

async function waitForSwac() {
    if (window.swac?.Model?.load) return;

    for (let i = 0; i < 40; i++) {
        await new Promise(resolve => setTimeout(resolve, 250));
        if (window.swac?.Model?.load) return;
    }

    throw new Error("SWAC ist nicht verfügbar.");
}

async function readSwacDevices() {
    await waitForSwac();

    const response = await window.swac.Model.load({
        fromName: "tbl_observedobject",
        fromWheres: {
            filter: "data_collection,nis",
            includes:
                "name,id,data_collection,measurerate,measuredaylystart,measuredaylyend"
        },
        idAttr: "id"
    });

    const unique = new Map();

    for (const record of toArray(response)) {
        const device = normalizeDevice(record);
        if (device) unique.set(device.id, device);
    }

    return [...unique.values()];
}

function setDevices(devices) {
    singleSelector.setDevices(devices);
    multiSelector.setDevices(devices);
    status(
        source === "demo"
            ? `${devices.length} Testgeräte geladen.`
            : `${devices.length} Geräte aus SWAC geladen.`
    );
    updateSelectedDevices();
}

function selectedDevices() {
    const unique = new Map();

    for (const device of [
        ...singleSelector.getSelected(),
        ...multiSelector.getSelected()
    ]) {
        unique.set(String(device.id), device);
    }

    return [...unique.values()];
}

function updateSelectedDevices() {
    const target = $("selectedDevices");
    const devices = selectedDevices();

    target.replaceChildren();

    if (!devices.length) {
        target.textContent = "Keine Geräte ausgewählt";
        return;
    }

    for (const device of devices) {
        const chip = document.createElement("span");
        chip.className = "device-chip";
        chip.textContent = device.name;
        target.appendChild(chip);
    }
}

function parseTimestamp(value) {
    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new Error("Ungültiger Zeitstempel.");
        }
        return value;
    }

    if (value == null || value === "") {
        throw new Error("Zeitstempel fehlt.");
    }

    const timestamp = new Date(
        String(value).replace(" ", "T")
    ).getTime();

    if (!Number.isFinite(timestamp)) {
        throw new Error("Ungültiger Zeitstempel.");
    }
    return timestamp;
}

function extractArray(payload) {
    if (Array.isArray(payload)) return payload;

    if (!payload || typeof payload !== "object") {
        throw new Error("Ungültige API-Antwort.");
    }

    if (Array.isArray(payload.errors) && payload.errors.length) {
        throw new Error(JSON.stringify(payload.errors));
    }

    const keys = [
        "data", "results", "result",
        "items", "records", "missingperiods"
    ];

    for (const key of keys) {
        const value = payload[key];
        if (Array.isArray(value)) return value;

        if (value && typeof value === "object") {
            for (const nestedKey of keys) {
                if (Array.isArray(value[nestedKey])) {
                    return value[nestedKey];
                }
            }
        }
    }

    throw new Error("Unbekanntes API-Antwortformat.");
}

function parseGap(item) {
    if (Array.isArray(item) && item.length >= 2) {
        return [
            parseTimestamp(item[0]),
            parseTimestamp(item[1])
        ];
    }

    if (item && typeof item === "object") {
        const from = item.start ?? item.from;
        const to = item.end ?? item.until ?? item.to;

        if (from != null && to != null) {
            return [parseTimestamp(from), parseTimestamp(to)];
        }

        if (typeof item.timespan === "string") {
            const matches = item.timespan.match(
                /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?/g
            );
            if (matches?.length === 2) {
                return matches.map(parseTimestamp);
            }
        }
    }

    throw new Error("Datenlücke konnte nicht gelesen werden.");
}

function availableFromGaps(gaps, start, end) {
    const missing = gaps
        .map(parseGap)
        .map(([a, b]) => [
            Math.max(start, a),
            Math.min(end, b)
        ])
        .filter(([a, b]) => a < b)
        .sort((a, b) => a[0] - b[0]);

    const available = [];
    let cursor = start;

    for (const [from, to] of missing) {
        if (from > cursor) {
            available.push([cursor, from]);
        }
        cursor = Math.max(cursor, to);
    }

    if (cursor < end) available.push([cursor, end]);
    return available;
}

function isValidRate(rate) {
    return rate != null &&
        rate !== "" &&
        Number.isFinite(Number(rate)) &&
        Number(rate) > 0;
}

function missingUrl(device, period) {
    const params = new URLSearchParams({
        smartdataurl: CONFIG.smartdataurl,
        collection: String(device.collection),
        storage: CONFIG.storage,
        dateattribute: CONFIG.dateattribute,
        measurefreq: String(device.measurerate),
        start: new Date(period.start).toISOString(),
        end: new Date(period.end).toISOString()
    });

    return `${CONFIG.missingEndpoint}?${params}`;
}

function recordsUrl(device, period) {
    const start = new Date(period.start).toISOString();
    const end = new Date(period.end).toISOString();

    const params = new URLSearchParams({
        storage: CONFIG.storage,
        filter: `ts,gte,${start} AND ts,lte,${end}`,
        order: "ts,ASC",
        limit: String(CONFIG.maxRecords)
    });

    return `${CONFIG.recordsEndpoint}/` +
        `${encodeURIComponent(device.collection)}?${params}`;
}

async function fetchJson(url, { signal } = {}) {
    const response = await fetch(url, {
        signal,
        credentials: "same-origin",
        headers: { Accept: "application/json" }
    });

    if (!response.ok) {
        throw new Error(`API HTTP ${response.status}`);
    }

    return response.json();
}

function intervalsFromRecords(records, period) {
    const timestamps = [];

    for (const record of records) {
        if (!record || typeof record !== "object") continue;
        const raw = record.ts ?? record.timestamp;
        if (raw == null) continue;

        try {
            const value = parseTimestamp(raw);
            if (value >= period.start && value <= period.end) {
                timestamps.push(value);
            }
        } catch (error) {
            console.warn(error);
        }
    }

    const unique = [...new Set(timestamps)].sort((a, b) => a - b);
    if (!unique.length) return [];

    const duration = period.end - period.start;
    const width = Math.max(
        1000,
        Math.min(60000, duration / 1000)
    );

    const intervals = [];

    for (const time of unique) {
        const from = Math.max(period.start, time - width / 2);
        const to = Math.min(period.end, time + width / 2);
        const last = intervals[intervals.length - 1];

        if (last && from <= last[1]) {
            last[1] = Math.max(last[1], to);
        } else {
            intervals.push([from, to]);
        }
    }

    return intervals;
}

async function loadLiveAvailability(device, period, { signal } = {}) {
    if (!device.collection) {
        throw new Error(
            `Für "${device.name}" fehlt data_collection. ` +
            "Bitte ein Messgerät auswählen."
        );
    }

    if (isValidRate(device.measurerate)) {
        const payload = await fetchJson(
            missingUrl(device, period), { signal }
        );

        return availableFromGaps(
            extractArray(payload),
            period.start,
            period.end
        );
    }

    const payload = await fetchJson(
        recordsUrl(device, period), { signal }
    );
    const records = extractArray(payload);

    if (records.length >= CONFIG.maxRecords) {
        throw new Error(
            `Zu viele Datensätze für "${device.name}". ` +
            "Bitte einen kürzeren Zeitraum wählen."
        );
    }

    return intervalsFromRecords(records, period);
}

const requests = createAvailabilityRequestManager({
    load: ({ device, period }, options) =>
        loadLiveAvailability(device, period, options),
    concurrency: 3,
    ttlMs: 30_000,
    onTiming: result => console.debug("Availability request:", result)
});

function clearVisuals(message) {
    chart.renderMessage(message);
    heatmap.renderMessage(message);
}

async function updateChart() {
    if (!singleSelector || !multiSelector || !chart || !heatmap) {
        return;
    }

    requestController?.abort();
    requestController = new AbortController();

    const version = ++requestVersion;
    const signal = requestController.signal;

    updateSelectedDevices();

    let period;
    try {
        period = getPeriod();
    } catch (error) {
        clearVisuals(error.message);
        return;
    }

    $("periodInfo").textContent =
        `Zeitraum: ${period.from.replace("T", " ")} bis ` +
        period.to.replace("T", " ");

    const devices = selectedDevices();

    if (!devices.length) {
        clearVisuals("Bitte mindestens ein Gerät auswählen.");
        return;
    }

    clearVisuals("Daten werden geladen …");

    try {
        const results = await Promise.all(
            devices.map(async device => {
                let intervals;

                if (source === "demo") {
                    const result = getDemoAvailability(device, period);

                    if (result.status === "error") {
                        throw new Error(result.message);
                    }

                    intervals = availableFromGaps(
                        result.gaps,
                        period.start,
                        period.end
                    );
                } else {
                    const key = JSON.stringify({
                        id: device.id,
                        collection: device.collection,
                        measurerate: device.measurerate,
                        start: period.start,
                        end: period.end
                    });

                    intervals = await requests.get(
                        key,
                        { device, period },
                        { signal }
                    );
                }

                return {
                    id: device.id,
                    name: device.name,
                    intervals
                };
            })
        );

        if (version !== requestVersion || signal.aborted) return;

        const data = {
            devices: results,
            start: period.start,
            end: period.end
        };

        chart.setData(data);
        heatmap.setData(data);
    } catch (error) {
        if (version !== requestVersion || signal.aborted) return;
        console.error(error);
        clearVisuals(error.message);
        status(error.message, true);
    }
}

async function reloadRealDevices() {
    status("Echte Geräte werden aus SWAC geladen …");

    try {
        const devices = await readSwacDevices();
        realDevices = devices;

        if (source === "live") {
            setDevices(devices);
            updateChart();
        }
    } catch (error) {
        console.error(error);
        if (source === "live") status(error.message, true);
    }
}

async function changeSource(nextSource) {
    source = nextSource;
    requestController?.abort();
    requests.clear();
    ++requestVersion;

    singleSelector.setSelected([]);
    multiSelector.setSelected([]);

    if (source === "demo") {
        initializeDates();
        setDevices(demoDevices);
        clearVisuals("Bitte mindestens ein Gerät auswählen.");
    } else {
        const now = Date.now();
        $("startDate").value = dateInput(now - 24 * 3600000);
        $("endDate").value = dateInput(now);
        setDevices(realDevices);
        clearVisuals("Bitte mindestens ein Gerät auswählen.");
        await reloadRealDevices();
    }
}

function initApp() {
    chart = new AvailabilityChart("availabilityChart");
    heatmap = new AvailabilityHeatmap("availabilityHeatmap");

    singleSelector = new DeviceSelection("singleDeviceSelector", {
        multiple: false,
        onChange: updateChart
    });

    multiSelector = new DeviceSelection("multiDeviceSelector", {
        multiple: true,
        onChange: updateChart
    });

    initializeDates();
    setDevices(demoDevices);

    document.querySelectorAll('input[name="source"]')
        .forEach(input => {
            input.addEventListener("change", event => {
                if (event.target.checked) {
                    changeSource(event.target.value);
                }
            });
        });

    $("refreshButton").addEventListener("click", updateChart);

    $("reloadDevicesButton").addEventListener("click", async () => {
        if (source === "live") {
            requests.clear();
            await reloadRealDevices();
        } else {
            setDevices(demoDevices);
        }
    });

    $("startDate").addEventListener("change", updateChart);
    $("endDate").addEventListener("change", updateChart);

    document.addEventListener(
        "swac_components_complete",
        () => {
            if (source === "live") reloadRealDevices();
        }
    );

    document.addEventListener(
        "swac_oo_change_complete",
        () => {
            if (source === "live") reloadRealDevices();
        }
    );

    clearVisuals("Bitte mindestens ein Gerät auswählen.");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
