import ViewHandler from '/SWAC/swac/ViewHandler.js';

function renderSamplingRate(rows) {
	clearResult();
 	let samplingRates = compareState.results.map(function (result) {
        	return calculateSamplingRate(result.sets);
    	});
	alert("Sampling");
	let html = '<h1>Sampling Rate</h1>'

	html += '<table class="uk-table uk-table-divider uk-table-striped station_compare_table"><thead><tr>';
	for (let header of rows[0])
        	html += '<th>' + escapeHtml(header) + '</th>';
		html += '<th bgcolor="green">Sampling-Rate</th>'
    		html += '</tr></thead><tbody>';
    	for (let row of rows.slice(1)) {
        	html += '<tr>' + row.map(function (value) {
            	let displayValue = typeof value === 'number' ? formatNumber(value) : value;
            	return '<td class="station_compare_value">' + escapeHtml(displayValue) + '</td>';
        }).join('') ;
	 
	 for (let rate of samplingRates) {
            let displayRate = rate === null
                ? '-'
                : formatNumber(rate / 1000) + ' s';

            html += '<td class="station_compare_value">';
            html += escapeHtml(displayRate);
            html += '</td>';
	 } }

        html += '</tr>';
    html += '</tbody></table>';
    document.querySelector('.station_compare_result').innerHTML = html;
}
