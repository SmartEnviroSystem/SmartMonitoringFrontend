
"use strict";

export const demoRange = {
    start: Date.UTC(2026, 10, 19, 0),
    end: Date.UTC(2026, 10, 20, 0)
};

export const demoDevices = [
    { id: "north", name: "Campus Nord", parentId: null },
    { id: "weather", parentId: "north", name: "Wetterstation" },
    {
        id: "temperature",
        parentId: "weather",
        name: "Temperatur Nord",
        collection: "demo_temperature"
    },
    {
        id: "humidity",
        parentId: "weather",
        name: "Luftfeuchte Nord",
        collection: "demo_humidity"
    },
    { id: "south", name: "Campus Süd", parentId: null },
    {
        id: "particles",
        parentId: "south",
        name: "Feinstaub Süd",
        collection: "demo_particles"
    }
];

const gapsByDevice = {
    temperature: [[4, 5.5], [12, 15]],
    humidity: [[1, 3], [16, 17]],
    particles: [[7, 8], [20, 22]]
};

export function getDemoAvailability(device, range) {
    const hour = 3_600_000;

    if (
        !Number.isFinite(range.start) ||
        !Number.isFinite(range.end) ||
        range.end <= range.start
    ) {
        return {
            status: "error",
            message: "Ungültiger Zeitraum."
        };
    }

    if (
        range.start < demoRange.start ||
        range.end > demoRange.end
    ) {
        return {
            status: "error",
            message: "Beispieldaten sind nur für den voreingestellten Zeitraum vorhanden."
        };
    }

    const gaps = (gapsByDevice[String(device.id)] ?? [])
        .map(([start, end]) => ({
            start: demoRange.start + start * hour,
            end: demoRange.start + end * hour
        }));

    return {
        status: "success",
        gaps,
        coverage: "complete"
    };
}
