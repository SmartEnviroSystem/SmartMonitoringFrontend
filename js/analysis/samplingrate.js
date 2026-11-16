/*
import ViewHandler from '/SWAC/swac/ViewHandler.js';
import SWAC from '/SWAC/swac/swac.js';
*/

window['oo_change_options'] = {
    selectedParam: 'data_collection',
    paramsFromSet: ['id', 'data_collection']
};

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
