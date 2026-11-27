/*
import ViewHandler from '/SWAC/swac/ViewHandler.js';
import SWAC from '/SWAC/swac/swac.js';
*/

// Device and period, the chart shows the intervals of the device in this period
window['samplingrate_source_options'] = {
    showAttribute: false,
    showPeriod: true
};

// The chart reads device and period from the URL, so the page is reloaded with them
document.addEventListener('submit', function (evt) {
    if (evt.target.id !== 'samplingrate_form')
        return;
    evt.preventDefault();
    let comp = document.getElementById('samplingrate_source').swac_comp;
    let selection = comp ? comp.getSelection() : null;
    if (!selection)
        return;
    window.location.search = new URLSearchParams({
        oo_id: selection.id,
        data_collection: selection.collection,
        start: selection.from,
        end: selection.to
    }).toString();
});

window['samplingrate_chart_options'] = {
    fromName: new URLSearchParams(window.location.search).get('data_collection'),
    xAxisAttrName: 'ts',
    yAxisAttrNames: ['swac_sampling_median_sec', 'swac_sampling_interval_sec'],
    plugins: new Map([
	    [ 'Linechart', 
		    { id: 'Linechart', 
		      active: true,
		      sharedYAxis: true
		    }]
    ]),
    customAfterAddSet: function (set) {
        set.swac_sampling_interval_sec = null;
        set.swac_sampling_median_sec = null;
        this.options.sourceColors[set.swac_fromName + '_swac_sampling_median_sec'] = '#1565c0';
	
	this.options.sourceColors[set.swac_fromName + '_swac_sampling_interval_sec'] = '#2e7d32';
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
