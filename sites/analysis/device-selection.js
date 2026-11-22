
"use strict";

class DeviceSelection {
    constructor(target, options = {}) {
        this.container = typeof target === "string"
            ? document.getElementById(target) : target;

        if (!this.container) {
            throw new Error("Geräteauswahl nicht gefunden.");
        }

        this.multiple = options.multiple ?? false;
        this.onChange = options.onChange ?? (() => {});
        this.devices = [];
        this.selectedIds = new Set();
        this.expandedIds = new Set();
        this.open = false;

        this.container.classList.add("device-selector");
        this.render();
    }

    setDevices(devices) {
        const previous = new Set(this.selectedIds);

        this.devices = (devices || []).map(device => ({
            ...device,
            id: String(device.id),
            name: String(device.name ?? device.id),
            parentId: device.parentId == null
                ? null : String(device.parentId)
        }));

        const valid = new Set(this.devices.map(d => d.id));

        this.selectedIds = new Set(
            [...previous].filter(id => valid.has(id))
        );

        this.expandedIds = new Set(
            this.devices.filter(device =>
                this.devices.some(child =>
                    child.parentId === device.id
                )
            ).map(device => device.id)
        );

        this.render();
        this.onChange(this.getSelected());
    }

    getSelected() {
        return this.devices.filter(device =>
            this.selectedIds.has(device.id)
        );
    }

    setSelected(ids) {
        const valid = new Set(this.devices.map(d => d.id));
        const values = (ids || []).map(String)
            .filter(id => valid.has(id));

        this.selectedIds = new Set(
            this.multiple ? values : values.slice(0, 1)
        );

        this.render();
        this.onChange(this.getSelected());
    }

    getChildren(parentId) {
        return this.devices.filter(device =>
            device.parentId === parentId
        );
    }

    toggleSelection(id) {
        if (this.multiple) {
            if (this.selectedIds.has(id)) {
                this.selectedIds.delete(id);
            } else {
                this.selectedIds.add(id);
            }
        } else {
            this.selectedIds.clear();
            this.selectedIds.add(id);
            this.open = false;
        }

        this.render();
        this.onChange(this.getSelected());
    }

    createRow(device, depth, visited) {
        if (visited.has(device.id)) return null;
        visited.add(device.id);

        const wrapper = document.createElement("div");
        wrapper.className = "device-tree-item";

        const row = document.createElement("div");
        row.className = "device-tree-row";
        row.style.paddingLeft = `${8 + depth * 20}px`;

        const children = this.getChildren(device.id);
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "tree-toggle";

        if (children.length) {
            toggle.textContent = this.expandedIds.has(device.id)
                ? "▾" : "▸";
            toggle.setAttribute(
                "aria-label",
                `${device.name} auf- oder zuklappen`
            );
            toggle.addEventListener("click", () => {
                if (this.expandedIds.has(device.id)) {
                    this.expandedIds.delete(device.id);
                } else {
                    this.expandedIds.add(device.id);
                }
                this.render();
            });
        } else {
            toggle.disabled = true;
        }

        const label = document.createElement("label");
        label.className = "device-tree-label";

        const input = document.createElement("input");
        input.type = this.multiple ? "checkbox" : "radio";
        input.name = `${this.container.id}-selection`;
        input.checked = this.selectedIds.has(device.id);
        input.addEventListener("change", () =>
            this.toggleSelection(device.id)
        );

        const name = document.createElement("span");
        name.textContent = device.name;

        label.append(input, name);
        row.append(toggle, label);
        wrapper.appendChild(row);

        if (children.length && this.expandedIds.has(device.id)) {
            const nested = document.createElement("div");
            nested.className = "device-tree-children";

            for (const child of children) {
                const element = this.createRow(
                    child, depth + 1, visited
                );
                if (element) nested.appendChild(element);
            }
            wrapper.appendChild(nested);
        }

        return wrapper;
    }

    render() {
        this.container.replaceChildren();

        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "device-trigger";

        const selected = this.getSelected();
        trigger.textContent = !selected.length
            ? (this.multiple ? "Geräte auswählen" : "Gerät auswählen")
            : this.multiple && selected.length > 1
                ? `${selected.length} Geräte ausgewählt`
                : selected[0].name;

        trigger.setAttribute("aria-expanded", String(this.open));
        trigger.addEventListener("click", () => {
            this.open = !this.open;
            this.render();
        });

        this.container.appendChild(trigger);
        if (!this.open) return;

        const menu = document.createElement("div");
        menu.className = "device-menu";

        if (!this.devices.length) {
            const empty = document.createElement("p");
            empty.className = "device-empty";
            empty.textContent = "Keine Geräte vorhanden.";
            menu.appendChild(empty);
        } else {
            const ids = new Set(this.devices.map(d => d.id));
            const visited = new Set();

            const roots = this.devices.filter(d =>
                !d.parentId ||
                !ids.has(d.parentId) ||
                d.parentId === d.id
            );

            for (const device of [...roots, ...this.devices]) {
                const row = this.createRow(device, 0, visited);
                if (row) menu.appendChild(row);
            }
        }

        this.container.appendChild(menu);
    }

    destroy() {
        this.container.replaceChildren();
    }
}

window.DeviceSelection = DeviceSelection;
