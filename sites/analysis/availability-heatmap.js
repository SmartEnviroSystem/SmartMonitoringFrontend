
"use strict";

class AvailabilityHeatmap {
    constructor(containerId) {
        this.container = document.getElementById(containerId);

        if (!this.container) {
            throw new Error("Heatmap nicht gefunden.");
        }

        this.devices = [];
        this.start = null;
        this.end = null;
    }

    setData({ devices = [], start, end }) {
        this.devices = devices.map(device => ({
            id: String(device.id),
            name: String(device.name ?? device.id),
            intervals: device.intervals || []
        }));

        this.start = new Date(start);
        this.end = new Date(end);

        this.render();
    }

    renderMessage(message) {
        const element = document.createElement("p");
        element.className = "heatmap-message";
        element.textContent = message;

        this.container.replaceChildren(element);
    }

    static toMillis(value) {
        if (value instanceof Date) {
            return value.getTime();
        }

        if (typeof value === "number") {
            return value;
        }

        return new Date(value).getTime();
    }

    static normalizeIntervals(intervals, from, to) {
        return (intervals || [])
            .map(item => {
                const start = AvailabilityHeatmap.toMillis(
                    Array.isArray(item)
                        ? item[0]
                        : item.start ?? item.from
                );

                const end = AvailabilityHeatmap.toMillis(
                    Array.isArray(item)
                        ? item[1]
                        : item.end ?? item.to
                );

                return [
                    Math.max(from, start),
                    Math.min(to, end)
                ];
            })
            .filter(([a, b]) =>
                Number.isFinite(a) &&
                Number.isFinite(b) &&
                b > a
            )
            .sort((a, b) => a[0] - b[0]);
    }

    static coverage(intervals, from, to) {
        if (to <= from) {
            return 0;
        }

        const ranges = AvailabilityHeatmap.normalizeIntervals(
            intervals,
            from,
            to
        );

        let covered = 0;
        let cursor = from;

        for (const [start, end] of ranges) {
            covered += Math.max(
                0,
                end - Math.max(start, cursor)
            );

            cursor = Math.max(cursor, end);
        }

        return Math.max(
            0,
            Math.min(1, covered / (to - from))
        );
    }

    static intersect(a, b) {
        const result = [];
        let i = 0;
        let j = 0;

        while (i < a.length && j < b.length) {
            const start = Math.max(a[i][0], b[j][0]);
            const end = Math.min(a[i][1], b[j][1]);

            if (end > start) {
                result.push([start, end]);
            }

            if (a[i][1] < b[j][1]) {
                i++;
            } else {
                j++;
            }
        }

        return result;
    }

    static commonIntervals(devices, from, to) {
        if (!devices.length) {
            return [];
        }

        return devices.reduce((common, device, index) => {
            const current =
                AvailabilityHeatmap.normalizeIntervals(
                    device.intervals,
                    from,
                    to
                );

            return index === 0
                ? current
                : AvailabilityHeatmap.intersect(
                    common,
                    current
                );
        }, []);
    }

    static getColor(percent) {
        const colors = [
            "#DCE1E8",
            "#E8C4D5",
            "#D79AB5",
            "#B69ACD",
            "#8064A2"
        ];

        const index = Math.min(
            colors.length - 1,
            Math.floor(percent / 20)
        );

        return colors[index];
    }

    render() {
        const start = this.start?.getTime();
        const end = this.end?.getTime();

        if (
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            end <= start
        ) {
            this.renderMessage("Ungültiger Zeitraum.");
            return;
        }

        if (!this.devices.length) {
            this.renderMessage(
                "Bitte mindestens ein Gerät auswählen."
            );
            return;
        }

        const duration = end - start;
        const hours = duration / 3_600_000;

        const columns = hours <= 48
            ? Math.max(1, Math.ceil(hours))
            : 24;

        const formatter = new Intl.DateTimeFormat(
            "de-DE",
            {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

        const common =
            AvailabilityHeatmap.commonIntervals(
                this.devices,
                start,
                end
            );

        const layout = document.createElement("div");
        layout.className = "heatmap-layout";

        const scroller = document.createElement("div");
        scroller.className = "heatmap-scroll";

        const matrix = document.createElement("div");
        matrix.className = "heatmap-matrix";

        matrix.style.setProperty(
            "--heatmap-columns",
            columns
        );

        const axis = document.createElement("div");
        axis.className = "heatmap-axis";

        const corner = document.createElement("div");
        corner.className = "heatmap-corner";
        corner.textContent = "Geräte / Zeit";

        axis.appendChild(corner);

        const bins = [];

        for (let i = 0; i < columns; i++) {
            const from =
                start + duration * i / columns;

            const to =
                start + duration * (i + 1) / columns;

            bins.push([from, to]);

            const label = document.createElement("div");
            label.className = "heatmap-column-label";

            label.textContent =
                formatter.format(new Date(from));

            label.title =
                `${formatter.format(new Date(from))} – ` +
                formatter.format(new Date(to));

            axis.appendChild(label);
        }

        matrix.appendChild(axis);

        const addRow = (
            name,
            intervals,
            isCommon = false
        ) => {
            const row = document.createElement("div");

            row.className = isCommon
                ? "heatmap-row heatmap-common-row"
                : "heatmap-row";

            const label = document.createElement("div");
            label.className = "heatmap-device-label";

            label.textContent = name;
            label.title = name;

            row.appendChild(label);

            for (const [from, to] of bins) {
                const percent = Math.round(
                    AvailabilityHeatmap.coverage(
                        intervals,
                        from,
                        to
                    ) * 100
                );

                const cell = document.createElement("div");
                cell.className = "heatmap-cell";

                cell.style.backgroundColor =
                    AvailabilityHeatmap.getColor(percent);

                cell.style.color =
                    percent >= 80
                        ? "#FFFFFF"
                        : "#293241";

                cell.textContent = `${percent}%`;

                cell.title =
                    `${name}: ${percent}% verfügbar\n` +
                    `${formatter.format(new Date(from))} – ` +
                    formatter.format(new Date(to));

                row.appendChild(cell);
            }

            matrix.appendChild(row);
        };

        for (const device of this.devices) {
            addRow(
                device.name,
                device.intervals
            );
        }

        addRow(
            "Gemeinsam verfügbar",
            common,
            true
        );

        scroller.appendChild(matrix);
        layout.appendChild(scroller);

        const legend = document.createElement("div");
        legend.className = "heatmap-legend";

        const high = document.createElement("span");
        high.textContent = "100 %";

        const gradient = document.createElement("div");
        gradient.className = "heatmap-gradient";

        const low = document.createElement("span");
        low.textContent = "0 %";

        legend.append(
            high,
            gradient,
            low
        );

        layout.appendChild(legend);

        this.container.replaceChildren(layout);
    }
}

window.AvailabilityHeatmap = AvailabilityHeatmap;
