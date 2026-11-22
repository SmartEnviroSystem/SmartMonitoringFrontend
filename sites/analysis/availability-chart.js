
"use strict";

class AvailabilityChart {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) throw new Error("Diagramm nicht gefunden.");

        this.devices = [];
        this.start = 0;
        this.end = 1;
        this.hiddenDeviceIds = new Set();
        this.renderMessage("Bitte mindestens ein Gerät auswählen.");
    }

    setData({ devices = [], start, end }) {
        this.devices = devices.map(d => ({
            id: String(d.id),
            name: String(d.name),
            intervals: d.intervals || []
        }));
        this.start = Number(start);
        this.end = Number(end);
        this.hiddenDeviceIds = new Set(
            [...this.hiddenDeviceIds].filter(id =>
                this.devices.some(d => d.id === id)
            )
        );
        this.render();
    }

    static getCommonIntervals(allIntervals) {
        if (!allIntervals.length) return [];

        let common = allIntervals[0].map(pair => [...pair]);

        for (const intervals of allIntervals.slice(1)) {
            const next = [];
            for (const [a, b] of common) {
                for (const [c, d] of intervals) {
                    const from = Math.max(a, c);
                    const to = Math.min(b, d);
                    if (from < to) next.push([from, to]);
                }
            }
            common = next;
            if (!common.length) break;
        }
        return common;
    }

    formatTime(value) {
        return new Date(value).toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    createTimeline(intervals, common = false) {
        const timeline = document.createElement("div");
        timeline.className = "timeline";
        const duration = this.end - this.start;
        if (duration <= 0) return timeline;

        for (const [from, to] of intervals) {
            const a = Math.max(this.start, Number(from));
            const b = Math.min(this.end, Number(to));
            if (!Number.isFinite(a) ||
                !Number.isFinite(b) || a >= b) continue;

            const segment = document.createElement("div");
            segment.className = common
                ? "timeline-segment common-segment"
                : "timeline-segment";
            segment.style.left =
                `${(a - this.start) / duration * 100}%`;
            segment.style.width =
                `${(b - a) / duration * 100}%`;
            segment.title =
                `${this.formatTime(a)} – ${this.formatTime(b)}`;
            timeline.appendChild(segment);
        }
        return timeline;
    }

    renderMessage(message) {
        const node = document.createElement("div");
        node.className = "chart-message";
        node.textContent = message;
        this.container.replaceChildren(node);
    }

    render() {
        if (!Number.isFinite(this.start) ||
            !Number.isFinite(this.end) ||
            this.end <= this.start) {
            this.renderMessage("Ungültiger Zeitraum.");
            return;
        }
        if (!this.devices.length) {
            this.renderMessage("Bitte mindestens ein Gerät auswählen.");
            return;
        }

        const content = document.createElement("div");
        content.className = "chart-content";

        const axis = document.createElement("div");
        axis.className = "chart-axis";

        const title = document.createElement("strong");
        title.textContent = "Geräte";

        const times = document.createElement("div");
        times.className = "axis-times";

        for (let i = 0; i <= 3; i++) {
            const span = document.createElement("span");
            span.textContent = this.formatTime(
                this.start + (this.end - this.start) * i / 3
            );
            times.appendChild(span);
        }
        axis.append(title, times, document.createElement("span"));
        content.appendChild(axis);

        const addRow = (name, intervals, id = null, common = false) => {
            const row = document.createElement("div");
            row.className = `chart-row${common ? " common-row" : ""}`;

            const label = document.createElement("div");
            label.className = "chart-label";
            label.textContent = name;

            const hidden = id !== null && this.hiddenDeviceIds.has(id);
            row.append(
                label,
                this.createTimeline(hidden ? [] : intervals, common)
            );

            if (id === null) {
                row.appendChild(document.createElement("span"));
            } else {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "chart-eye-button";
                button.textContent = hidden ? "◌" : "◉";
                button.title = hidden ? "Einblenden" : "Ausblenden";
                button.addEventListener("click", () => {
                    if (hidden) this.hiddenDeviceIds.delete(id);
                    else this.hiddenDeviceIds.add(id);
                    this.render();
                });
                row.appendChild(button);
            }
            content.appendChild(row);
        };

        for (const device of this.devices) {
            addRow(device.name, device.intervals, device.id);
        }

        addRow(
            "Gemeinsam verfügbar",
            AvailabilityChart.getCommonIntervals(
                this.devices.map(d => d.intervals)
            ),
            null,
            true
        );

        this.container.replaceChildren(content);
    }
}

window.AvailabilityChart = AvailabilityChart;
