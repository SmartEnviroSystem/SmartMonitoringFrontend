import ViewHandler from '/SWAC/swac/ViewHandler.js';
import Model from '/SWAC/swac/Model.js';

window.heatmap_view_options = {
    datadescription: 'heatmap_legend',
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
window.heatmap_legend_options = {formatAttributeBorders: false};
window.heatmap_source_options = {attributeRequired: true};

function getHeatmapSelection() {
    let source = document.getElementById('heatmap_source').swac_comp;
    return (source && source.getSelection && source.getSelection()) || {};
}

let heatmapUpdate = Promise.resolve();
function updateHeatmap() {
    let result = document.getElementById('heatmap_result');
    result.hidden = true;
    heatmapUpdate = heatmapUpdate.then(async function () {
        let collection = getHeatmapSelection().collection;
        let attribute = getHeatmapSelection().attribute;
        if (!collection || !attribute)
            return;
        let definitions = await Model.getValueDefinitions({fromName: collection});
        let availableAttributes = definitions.map(function (definition) {
            return definition.name;
        });
        let previous = document.getElementById('heatmap_view');
        if (previous && previous.swac_comp)
            previous.swac_comp.delete();
        window.heatmap_view_options.attributeOrder = ['TS', 'ts_datetime', attribute];
        window.heatmap_view_options.attrVisibility = [{hide: availableAttributes.concat(['ts_date', 'ts_time', 'ts_day']).filter(function (name) {
            return name !== attribute && name !== 'TS' && name !== 'ts_datetime';
        })}];
        let requestor = document.createElement('div');
        requestor.id = 'heatmap_view';
        requestor.setAttribute('swa', 'Heatmap FROM ' + collection);
        result.replaceChildren(requestor);
        let loading = document.querySelector('.heatmap_loading');
        loading.hidden = false;
        try {
            await new ViewHandler().load(requestor);
        } finally {
            loading.hidden = true;
        }
        // Selection may have changed while the heatmap was loading
        result.hidden = collection !== getHeatmapSelection().collection
                || attribute !== getHeatmapSelection().attribute;
    }).catch(function (error) {
        console.error('Heatmap could not load the selected data.', error);
    });
}

document.addEventListener('swac_heatmap_source_dataselect_changed', updateHeatmap);

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
