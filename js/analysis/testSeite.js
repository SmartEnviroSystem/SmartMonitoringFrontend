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
window.test_source_options = {attributeRequired: true};

function getTestSelection() {
    let source = document.getElementById('test_source').swac_comp;
    return (source && source.getSelection && source.getSelection()) || {};
}

let heatmapUpdate = Promise.resolve();
function updateTestHeatmap() {
    let result = document.getElementById('test_result');
    result.hidden = true;
    heatmapUpdate = heatmapUpdate.then(async function () {
        let collection = getTestSelection().collection;
        let attribute = getTestSelection().attribute;
        if (!collection || !attribute)
            return;
        let availableAttributes = document.getElementById('test_source').swac_comp.getAttributes().map(function (definition) {
            return definition.name;
        });
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
        // Selection may have changed while the heatmap was loading
        result.hidden = collection !== getTestSelection().collection
                || attribute !== getTestSelection().attribute;
    }).catch(function (error) {
        console.error('Heatmap could not load the selected data.', error);
    });
}

document.addEventListener('swac_test_source_dataselect_changed', updateTestHeatmap);

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
