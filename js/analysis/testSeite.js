import ViewHandler from '/SWAC/swac/ViewHandler.js';

window.test_heatmap_options = {
    datadescription: 'test_legend',
    autoLegend: true,
    customBeforeAddSet: function (set) {
        set.TS = '';
        let date = new Date(set.ts);
        if (Number.isNaN(date.getTime()))
            set.ts_datetime = String(set.ts || '');
        else
            set.ts_datetime = date.toLocaleString(document.documentElement.lang || 'de-DE');
    },
    customAfterLoad: function (requestor) {
        let component = requestor.swac_comp;
        let sets = component.data[component.options.mainSource].getSets().filter(function (set) {
            return set && Number.isFinite(new Date(set.ts).getTime());
        });
        let start = Math.min(...sets.map(function (set) { return new Date(set.ts).getTime(); }));
        for (let set of sets)
            set.TS = formatDuration(new Date(set.ts).getTime() - start);
    }
};
window.test_legend_options = {formatAttributeBorders: false};
let availableAttributes = [];
let heatmapUpdate = Promise.resolve();
function updateTestHeatmap() {
    let result = document.getElementById('test_result');
    result.hidden = true;
    heatmapUpdate = heatmapUpdate.then(async function () {
        let collection = document.getElementById('test_table').value;
        let attribute = document.getElementById('test_value').value;
        if (!collection || !attribute)
            return;
        let previous = document.getElementById('test_heatmap');
        if (previous && previous.swac_comp)
            previous.swac_comp.delete();
        window.test_heatmap_options.attributeOrder = ['TS', 'ts_datetime', attribute];
        window.test_heatmap_options.attrVisibility = [{hide: availableAttributes.concat(['ts_date', 'ts_time', 'ts_day']).filter(function (name) {
            return name !== attribute && name !== 'TS' && name !== 'ts_datetime';
        })}];
        let requestor = document.createElement('div');
        requestor.id = 'test_heatmap';
        requestor.setAttribute('swa', 'Heatmap FROM ' + collection);
        result.replaceChildren(requestor);
        await new ViewHandler().load(requestor);
        result.hidden = collection !== document.getElementById('test_table').value
                || attribute !== document.getElementById('test_value').value;
    }).catch(function (error) {
        console.error('Heatmap could not load the selected data.', error);
    });
}

document.addEventListener('DOMContentLoaded', function () {
    let tables = document.getElementById('test_table');
    let values = document.getElementById('test_value');
    function loadTables() {
        window.swac.Model.load({fromName: 'tbl_observedobject',
            fromWheres: {filter: 'data_collection,nis', order: 'name,ASC'}
        }).then(function (source) {
            let sets = source.getSets ? source.getSets() : source;
            for (let set of sets) {
                if (set && set.data_collection)
                    tables.add(new Option(set.name || set.data_collection, set.data_collection));
            }
        }).catch(function (error) {
            console.error(error);
            tables.options[0].text = 'Tabellen konnten nicht geladen werden';
        });
    }
    tables.addEventListener('change', async function () {
        document.getElementById('test_result').hidden = true;
        values.length = 0;
        values.add(new Option('Wert auswählen', ''));
        values.disabled = true;
        let collection = tables.value;
        if (!collection) return;
        try {
            let definitions = await window.swac.Model.getValueDefinitions({fromName: collection});
            if (tables.value !== collection) return;
            availableAttributes = (definitions || []).map(function (definition) { return definition.name; });
            for (let definition of definitions || []) {
                if (!['id', 'oo_id', 'ts'].includes(definition.name))
                    values.add(new Option(definition.name, definition.name));
            }
            values.disabled = values.options.length < 2;
        } catch (error) {
            if (tables.value !== collection) return;
            console.error(error);
            values.options[0].text = 'Werte konnten nicht geladen werden';
        }
    });
    values.addEventListener('change', updateTestHeatmap);
    document.addEventListener('swac_core_loaded', loadTables, {once: true});
});

function formatDuration(milliseconds) {
    let totalSeconds = Math.round(milliseconds / 1000);
    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = totalSeconds % 60;
    let pad = function (value) {
        return String(value).padStart(2, '0');
    };
    return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
}
