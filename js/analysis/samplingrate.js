/*
import ViewHandler from '/SWAC/swac/ViewHandler.js';
import SWAC from '/SWAC/swac/swac.js';
*/

// Only the device is needed, the chart shows the intervals of its data table
window['samplingrate_source_options'] = {
    showAttribute: false
};

// The chart reads its table from the URL, so a new device reloads the page with it
document.addEventListener('swac_samplingrate_source_dataselect_changed', function (evt) {
    let selection = evt.detail.selection;
    let params = new URLSearchParams(window.location.search);
    let collection = selection ? selection.collection : null;
    if (collection === params.get('data_collection'))
        return;
    if (selection) {
        params.set('data_collection', collection);
        params.set('oo_id', selection.id);
    } else {
        params.delete('data_collection');
        params.delete('oo_id');
    }
    window.location.search = params.toString();
});

window['samplingrate_chart_options'] = {
    fromName: new URLSearchParams(window.location.search).get('data_collection'),
    xAxisAttrName: 'ts',
    yAxisAttrNames: ['swac_sampling_interval_ms'],
    plugins: new Map([['Linechart', {id: 'Linechart', active: true}]]),
    customAfterAddSet: function (set) {
        set.swac_sampling_interval_ms = null;
        set.swac_sampling_median_ms = null;
        this.options.sourceColors[set.swac_fromName + '_swac_sampling_median_ms'] = '#1565c0';
    },
    customAfterLoad: updateSamplingrateChart
};

function updateSamplingrateChart(requestor) {
    let chart = requestor.swac_comp;
    let count = 0;
    let hasInterval = false;
    for (let sourceName in chart.getData()) {
        let sets = chart.getData()[sourceName].getSets();
        let median = chart.calculateSamplingRate(sets, chart.options.xAxisAttrName);
        if (median !== null)
            hasInterval = true;
        for (let set of sets) {
            if (!set)
                continue;
            count++;
        }
    }
    document.getElementById('samplingrate_status').textContent = !chart.options.fromName
            ? 'Bitte eine Datensammlung auswählen.' : count === 0 ? 'Keine Daten vorhanden.'
            : !hasInterval ? 'Für die Sampling Rate  werden mindestens zwei unterschiedliche gültige Zeitstempel benötigt.' : '';
    if (count > 0) {
        let linechart = chart.getPlugin('Linechart').swac_comp;
        if (linechart.chart)
            linechart.chart.update();
    }
}
