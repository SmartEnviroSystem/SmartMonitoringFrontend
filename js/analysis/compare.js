import DataAggregation from '/SWAC/swac/DataAggregation.js?ver=17.08.2026.9';
import TableExport from '/SWAC/swac/TableExport.js?ver=17.08.2026.9';

// Project specific comparison settings.
var dataCompareOptions = {
    stationSource: 'tbl_observedobject',
    stationFilter: 'data_collection,nis',
    stationNameAttr: 'name',
    collectionAttr: 'data_collection',
    timeAttr: 'ts',
    sourceSize: 5000,
    excludedAttributes: ['id', 'oo_id', 'ts', 'measurement_name', 'measurement_process', 'pos', 'pos_accuracy', 'pos_altitude', 'pos_altitude_accuracy', 'pos_heading', 'pos_speed']
};

var compareState = {
    stations: [],
    selections: [],
    sourceCache: new Map(),
    results: [],
    chart: null,
    intervalMs: 0,
    globalAttributes: [],
    individualAttributes: false,
    individualPeriods: {
        from: false,
        to: false
    },
    sameTime: false
};

function getSets(source) {
    if (!source)
        return [];
    if (typeof source[Symbol.iterator] === 'function')
        return Array.from(source);
    if (source.getSets)
        return source.getSets().filter(Boolean);
    return [];
}

function getStationCollection(station) {
    return station[dataCompareOptions.collectionAttr];
}

function getStationName(station) {
    return station[dataCompareOptions.stationNameAttr] || getStationCollection(station);
}

function isNumber(value) {
    return DataAggregation.isNumericValue(value);
}

function getNumber(value) {
    return DataAggregation.toNumber(value);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, function (character) {
        return {'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[character];
    });
}

function getComparisonText(key, fallback) {
    let language = window.swac && window.swac.lang;
    return language ? language.getTranslationForId(key) || fallback : fallback;
}

function setStatus(message) {
    document.querySelector('.station_compare_status').textContent = message || '';
}

function clearResult() {
    document.querySelector('.station_compare_result').innerHTML = '';
    if (compareState.chart) {
        compareState.chart.destroy();
        compareState.chart = null;
    }
}

function getSelection(index) {
    return compareState.selections[index];
}

function getStationForSelection(selection) {
    return compareState.stations.find(function (station) {
        return getStationCollection(station) === selection.collection;
    });
}

/**
 * Gets the current global period inputs.
 *
 * @returns {Object} Period input values
 */
function getGlobalPeriod() {
    return {
        fromDate: document.querySelector('#station_compare_all_from_date')?.value || '',
        fromTime: document.querySelector('#station_compare_all_from_time')?.value || '',
        toDate: document.querySelector('#station_compare_all_to_date')?.value || '',
        toTime: document.querySelector('#station_compare_all_to_time')?.value || ''
    };
}

function createSelection(collection) {
    let period = getGlobalPeriod();
    return {
        collection: collection || '',
        fromDate: period.fromDate,
        fromTime: period.fromTime,
        toDate: period.toDate,
        toTime: period.toTime,
        attributes: []
    };
}

function getPeriodDate(dateValue, timeValue, isEnd) {
    if (!dateValue)
        return null;
    let time = timeValue || (isEnd ? '23:59:59.999' : '00:00');
    let date = new Date(dateValue + 'T' + time);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getStationData(collection, selection) {
    if (!collection)
        return Promise.resolve([]);

    let filterStr = buildTimeFilter(selection);

    let fromWheres = {
        order: dataCompareOptions.timeAttr + ',ASC'
    };

    if (filterStr) {
        fromWheres.filter = filterStr;
    } else {
        fromWheres.size = dataCompareOptions.sourceSize;
    }

    console.log('Lade Daten für', collection, 'fromWheres:', fromWheres);

    let request = window.swac.Model.load({
        fromName: collection,
        fromWheres: fromWheres
    })
            .then(getSets)
            .catch(function (e) {
                console.log('Fehler beim Laden der Station:', collection, e);
                let station = compareState.stations.find(st => getStationCollection(st) === collection);
                if (station)
                    station._compareError = true;
                return [];
            });

    compareState.sourceCache.set(collection, request);
    return request;
}


function buildTimeFilter(selection) {
    let hasFrom = selection && selection.fromDate;
    let hasTo = selection && selection.toDate;

    if (!hasFrom && !hasTo)
        return null;

    let parts = [];

    if (hasFrom) {
        // z.B. 2026-06-15T00:00
        let fromTs = selection.fromDate + 'T' + (selection.fromTime || '00:00');
        parts.push('ts,gt,' + fromTs);
    }

    if (hasTo) {
        // z.B. 2026-06-15T23:59:59
        let toTs = selection.toDate + 'T' + (selection.toTime || '23:59:59');
        parts.push('ts,lt,' + toTs);
    }

    // Ergebnis: "ts,gt,2026-06-15T00:00&filter=ts,lt,2026-06-15T23:59:59"
    return parts.join('&filter=');
}

function getNumericAttributes(sets) {
    let attributes = new Set();
    for (let set of sets) {
        for (let attribute of Object.keys(set)) {
            if (attribute.startsWith('swac_') || dataCompareOptions.excludedAttributes.includes(attribute))
                continue;
            if (isNumber(set[attribute]))
                attributes.add(attribute);
        }
    }
    return Array.from(attributes).sort(function (first, second) {
        return first.localeCompare(second);
    });
}

function renderStationRows() {
    let list = document.querySelector('.station_compare_stationlist');
    list.innerHTML = '';

    for (let index = 0; index < compareState.selections.length; index++) {
        let selection = getSelection(index);
        let row = document.createElement('div');
        row.className = 'station_compare_stationrow';
        let removeLabel = escapeHtml(getComparisonText('data_compare_remove_collection', 'Remove collection'));
        let removeButton = index < 2
                ? '<span class="station_compare_remove_placeholder"></span>'
                : '<button type="button" class="uk-icon-button station_compare_remove" data-index="' + index + '" uk-icon="close" uk-tooltip="' + removeLabel + '" title="' + removeLabel + '" aria-label="' + removeLabel + '"></button>';
        row.innerHTML = '<label class="station_compare_station_select"><span>' + getComparisonText('data_compare_collection', 'Station') + ' ' + (index + 1) + '</span><select class="uk-select station_compare_station" data-index="' + index + '"></select></label>'
                + '<label><span>' + getComparisonText('data_compare_from', 'From') + '</span><span class="station_compare_period_controls"><input class="uk-input station_compare_from_date" data-index="' + index + '" type="date"><input class="uk-input station_compare_from_time" data-index="' + index + '" type="time"></span></label>'
                + '<label><span>' + getComparisonText('data_compare_to', 'To') + '</span><span class="station_compare_period_controls"><input class="uk-input station_compare_to_date" data-index="' + index + '" type="date"><input class="uk-input station_compare_to_time" data-index="' + index + '" type="time"></span></label>'
                + '<label class="station_compare_station_attributes"><span>' + getComparisonText('data_compare_attributes', 'Attributes') + '</span><select class="uk-select station_compare_attributes" data-index="' + index + '"></select></label>'
                + removeButton;

        let stationSelect = row.querySelector('.station_compare_station');
        stationSelect.innerHTML = '<option value="">' + getComparisonText('data_compare_select_collection', 'Select collection') + '</option>';
        for (let station of compareState.stations) {
            let collection = getStationCollection(station);
            let option = document.createElement('option');
            option.value = collection;
            option.textContent = getStationName(station);

            if (station._compareError) {
                option.disabled = true;
                option.textContent += ' (Datenabruf fehlgeschlagen)';
                option.title = 'Der Datenabruf für diese Station ist fehlgeschlagen.';
            }

            option.selected = collection === selection.collection;
            stationSelect.appendChild(option);
        }


        row.querySelector('.station_compare_from_date').value = selection.fromDate;
        row.querySelector('.station_compare_from_time').value = selection.fromTime;
        row.querySelector('.station_compare_to_date').value = selection.toDate;
        row.querySelector('.station_compare_to_time').value = selection.toTime;
        renderAttributeSelect(row.querySelector('.station_compare_attributes'), selection.availableAttributes || [], selection.attributes);
        list.appendChild(row);
    }
    updateAttributeSelectionMode();
    updatePeriodSelectionMode();
}

function renderAttributeSelect(select, attributes, selected) {
    select.innerHTML = '';
    select.disabled = attributes.length === 0;
    let empty = document.createElement('option');
    empty.value = '';
    empty.textContent = getComparisonText('data_compare_select_attributes', 'Select attribute');
    empty.setAttribute('swac_lang', 'data_compare_select_attributes');
    empty.selected = selected.length === 0;
    select.appendChild(empty);
    for (let attribute of attributes) {
        let option = document.createElement('option');
        option.value = attribute;
        option.textContent = attribute;
        option.selected = selected[0] === attribute;
        select.appendChild(option);
    }
}

/**
 * Gets numeric attributes available for every selected station.
 *
 * @returns {Array} Shared attribute names
 */
function getCommonAttributes() {
    let selections = compareState.selections.filter(function (selection) {
        return selection.collection;
    });
    if (selections.length === 0 || selections.some(function (selection) {
        return !Array.isArray(selection.availableAttributes);
    }))
        return [];

    let attributes = selections[0].availableAttributes.slice();
    return attributes.filter(function (attribute) {
        return selections.every(function (selection) {
            return selection.availableAttributes.includes(attribute);
        });
    }).sort();
}

/**
 * Updates the common attribute selection from the selected stations.
 *
 * @returns {undefined}
 */
function updateGlobalAttributeOptions() {
    let attributes = getCommonAttributes();
    let selections = compareState.selections.filter(function (selection) {
        return selection.collection;
    });
    let canUseIndividualAttributes = selections.length >= 2
            && selections.every(function (selection) {
                return Array.isArray(selection.availableAttributes) && selection.availableAttributes.length > 0;
            });
    if (!compareState.individualAttributes && attributes.length == 0 && canUseIndividualAttributes) {
        compareState.individualAttributes = true;
        document.querySelector('#station_compare_individual_attributes').checked = true;
        for (let selection of selections) {
            if (selection.attributes.length == 0)
                selection.attributes = [selection.availableAttributes[0]];
        }
    }

    let selected = compareState.globalAttributes[0];
    if (!attributes.includes(selected))
        selected = attributes[0] || '';
    compareState.globalAttributes = selected ? [selected] : [];

    if (!compareState.individualAttributes) {
        for (let selection of compareState.selections) {
            if (selection.collection)
                selection.attributes = selected ? [selected] : [];
        }
    }

    renderAttributeSelect(document.querySelector('#station_compare_all_attributes'), attributes, compareState.globalAttributes);
}

/**
 * Enables the common or station specific attribute inputs.
 *
 * @returns {undefined}
 */
function updateAttributeSelectionMode() {
    let globalSelect = document.querySelector('#station_compare_all_attributes');
    let individualInput = document.querySelector('#station_compare_individual_attributes');
    compareState.individualAttributes = individualInput.checked;
    globalSelect.disabled = compareState.individualAttributes || globalSelect.options.length <= 1;

    for (let select of document.querySelectorAll('.station_compare_attributes'))
        select.disabled = !compareState.individualAttributes || select.options.length <= 1;
}

/**
 * Enables global or station specific period inputs.
 *
 * @returns {undefined}
 */
function updatePeriodSelectionMode() {
    let individualFrom = document.querySelector('#station_compare_individual_from').checked;
    let individualTo = document.querySelector('#station_compare_individual_to').checked;
    compareState.individualPeriods.from = individualFrom;
    compareState.individualPeriods.to = individualTo;

    document.querySelector('#station_compare_all_from_date').disabled = individualFrom;
    document.querySelector('#station_compare_all_from_time').disabled = individualFrom;
    document.querySelector('#station_compare_all_to_date').disabled = individualTo;
    document.querySelector('#station_compare_all_to_time').disabled = individualTo;

    for (let input of document.querySelectorAll('.station_compare_from_date, .station_compare_from_time'))
        input.disabled = !individualFrom;
    for (let input of document.querySelectorAll('.station_compare_to_date, .station_compare_to_time'))
        input.disabled = !individualTo;
}

function updateSelectionAttributes(index) {
    let selection = getSelection(index);
    if (!selection.collection) {
        selection.availableAttributes = [];
        selection.attributes = [];
        updateGlobalAttributeOptions();
        renderStationRows();
        return Promise.resolve();
    }

    let collection = selection.collection;
    return getStationData(collection, selection).then(function (sets) {
        if (selection.collection !== collection)
            return;
        selection.availableAttributes = getNumericAttributes(sets);
        selection.attributes = selection.attributes.filter(function (attribute) {
            return selection.availableAttributes.includes(attribute);
        });
        let globalAttribute = compareState.globalAttributes[0];
        if (!compareState.individualAttributes && globalAttribute && selection.availableAttributes.includes(globalAttribute))
            selection.attributes = [globalAttribute];
        if (selection.attributes.length === 0 && selection.availableAttributes.length > 0)
            selection.attributes = [selection.availableAttributes[0]];
        updateGlobalAttributeOptions();
        renderStationRows();
    });
}

function resetComparison() {
    compareState.results = [];
    compareState.intervalMs = 0;
    clearResult();
    setStatus('');
}

function getAggregation() {
    let amount = Number(document.querySelector('#station_compare_aggregation_amount').value);
    if (!Number.isFinite(amount) || amount <= 0)
        return null;
    return {
        amount: Math.floor(amount),
        unit: document.querySelector('#station_compare_aggregation_unit').value
    };
}

function getAggregationMilliseconds(aggregation) {
    if (!aggregation)
        return 0;
    return aggregation.amount * {
        minutes: 60000,
        hours: 3600000,
        days: 86400000
    }[aggregation.unit];
}

function resetAggregation() {
    document.querySelector('#station_compare_aggregation_amount').value = 0;
    document.querySelector('#station_compare_aggregation_unit').value = 'minutes';
    executeComparison();
}

/**
 * Restores the initial comparison configuration.
 *
 * @returns {undefined}
 */
function resetCompareSelections() {
    document.querySelector('#station_compare_mode').value = 'table';
    document.querySelector('#station_compare_all_from_date').value = '';
    document.querySelector('#station_compare_all_from_time').value = '';
    document.querySelector('#station_compare_all_to_date').value = '';
    document.querySelector('#station_compare_all_to_time').value = '';
    document.querySelector('#station_compare_same_time').checked = false;
    document.querySelector('#station_compare_individual_attributes').checked = false;
    document.querySelector('#station_compare_individual_from').checked = false;
    document.querySelector('#station_compare_individual_to').checked = false;
    document.querySelector('#station_compare_aggregation_amount').value = 0;
    document.querySelector('#station_compare_aggregation_unit').value = 'minutes';

    compareState.globalAttributes = [];
    compareState.individualAttributes = false;
    compareState.individualPeriods = {from: false, to: false};
    compareState.sameTime = false;
    compareState.selections = compareState.stations.slice(0, 2).map(function (station) {
        return createSelection(getStationCollection(station));
    });
    updateGlobalAttributeOptions();
    renderStationRows();
    resetComparison();
    Promise.all(compareState.selections.map(function (selection, index) {
        return updateSelectionAttributes(index);
    }));
}

function getResultSets(selection, sets) {
    let from = getPeriodDate(selection.fromDate, selection.fromTime, false);
    let to = getPeriodDate(selection.toDate, selection.toTime, true);
    if (selection.fromDate && !selection.toDate)
        to = getPeriodDate(selection.fromDate, '', true);
    if (selection.toDate && !selection.fromDate)
        from = getPeriodDate(selection.toDate, '', false);
    let filtered = DataAggregation.filterByTime(sets, dataCompareOptions.timeAttr, from, to);
    return DataAggregation.aggregateSets(filtered, dataCompareOptions.timeAttr, getAggregation())
            .sort(function (first, second) {
                return getTimeValue(first) - getTimeValue(second);
            });
}

function getTimeValue(set) {
    let date = new Date(set[dataCompareOptions.timeAttr]);
    return Number.isNaN(date.getTime()) ? NaN : date.getTime();
}

function formatTimestamp(set) {
    let date = new Date(set[dataCompareOptions.timeAttr]);
    if (Number.isNaN(date.getTime()))
        return String(set[dataCompareOptions.timeAttr] || '');
    return date.toLocaleString(document.documentElement.lang || 'de-DE');
}

function getMedian(values) {
    if (values.length === 0)
        return 0;
    let sorted = values.slice().sort(function (first, second) {
        return first - second;
    });
    let middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function getMeasurementInterval(results) {
    console.group('Intervallsuche Debug', results);

    let aggregation = getAggregation();
    let aggregationInterval = getAggregationMilliseconds(aggregation);

    console.log('Aggregation:', aggregation);
    console.log('Aggregation Interval (ms):', aggregationInterval);

    // Wenn Aggregation gesetzt ist → direkt zurückgeben
    if (aggregationInterval > 0) {
        console.log('→ Aggregation aktiv, Intervall =', aggregationInterval);
        console.groupEnd();
        return aggregationInterval;
    }

    console.log('→ Keine Aggregation, berechne Intervall aus Zeitdifferenzen');

    let differences = [];

    for (let result of results) {
        console.group('Station', result.selection.collection);
        let times = result.sets
                .map(getTimeValue)
                .filter(Number.isFinite);

        console.log('Zeitstempel:', times);

        if (times.length < 2) {
            console.warn('⚠ Weniger als 2 Zeitstempel → keine Differenzen möglich');
            console.groupEnd();
            continue;
        }

        for (let index = 1; index < times.length; index++) {
            let difference = times[index] - times[index - 1];

            console.log(
                    `Diff ${index}: ${times[index]} - ${times[index - 1]} = ${difference}`
                    );

            if (difference > 0) {
                differences.push(difference);
            } else {
                console.warn('⚠ Ungültige Differenz (<=0), ignoriert:', difference);
            }
        }

        console.groupEnd();
    }

    console.log('Gesammelte Differenzen:', differences);

    if (differences.length === 0) {
        console.error('❌ Keine gültigen Zeitdifferenzen gefunden!');
        console.groupEnd();
        return 0;
    }

    let median = getMedian(differences);
    console.log('Median der Differenzen:', median);

    console.groupEnd();
    return median;
}


function getDisplaySeries() {
    let series = [];
    for (let result of compareState.results) {
        let station = getStationForSelection(result.selection);
        for (let attribute of result.selection.attributes) {
            series.push({
                label: getStationName(station) + ' ' + (result.index + 1) + ' ' + attribute,
                sets: result.sets,
                attribute: attribute
            });
        }
    }
    return series;
}

function buildComparisonData() {
    let series = getDisplaySeries();
    if (series.length === 0 || compareState.intervalMs <= 0)
        return null;

    let rowsByInterval = new Map();
    for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex++) {
        let current = series[seriesIndex];
        let timedSets = current.sets.filter(function (set) {
            return Number.isFinite(getTimeValue(set));
        });
        if (timedSets.length === 0)
            continue;
//        let start = getTimeValue(timedSets[0]);
        let start = Math.min(...compareState.results
                .flatMap(r => r.sets.map(getTimeValue))
                .filter(Number.isFinite));

        for (let set of timedSets) {
            let value = getNumber(set[current.attribute]);
            if (value === null)
                continue;
            let interval = compareState.sameTime
                    ? getTimeOfDayValue(getTimeValue(set))
                    : Math.round((getTimeValue(set) - start) / compareState.intervalMs);
            if (!rowsByInterval.has(interval)) {
                rowsByInterval.set(interval, {
                    values: new Array(series.length).fill(null),
                    timestamps: new Array(series.length).fill('')
                });
            }
            let row = rowsByInterval.get(interval);
            row.values[seriesIndex] = value;
            row.timestamps[seriesIndex] = formatTimestamp(set);
        }
    }

    return {
        series: series,
        rows: Array.from(rowsByInterval.keys()).sort(function (first, second) {
            return first - second;
        }).map(function (interval) {
            return {
                label: compareState.sameTime ? formatTimeOfDay(interval) : formatDuration(interval * compareState.intervalMs),
                values: rowsByInterval.get(interval).values,
                timestamps: rowsByInterval.get(interval).timestamps
            };
        })
    };
}

function buildComparisonRows(comparison) {
    if (!comparison || comparison.rows.length === 0)
        return [];

    let timestamp = getComparisonText('data_compare_timestamp', 'Timestamp');
    let header = [getComparisonText(compareState.sameTime ? 'data_compare_time' : 'data_compare_interval', compareState.sameTime ? 'Time' : 'Interval')];
    for (let current of comparison.series) {
        header.push(current.label);
        header.push(current.label + ' ' + timestamp);
    }

    let rows = [header];
    for (let row of comparison.rows) {
        let values = [row.label];
        for (let index = 0; index < comparison.series.length; index++) {
            values.push(row.values[index]);
            values.push(row.timestamps[index]);
        }
        rows.push(values);
    }
    return rows;
}

function getTimeOfDayValue(time) {
    let date = new Date(time);
    return date.getHours() * 3600000 + date.getMinutes() * 60000 + date.getSeconds() * 1000 + date.getMilliseconds();
}

function formatTimeOfDay(milliseconds) {
    let totalSeconds = Math.floor(milliseconds / 1000);
    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = totalSeconds % 60;
    let pad = function (value) {
        return String(value).padStart(2, '0');
    };
    return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
}

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

function formatNumber(value) {
    if (!Number.isFinite(value))
        return '';
    return new Intl.NumberFormat(document.documentElement.lang || 'de-DE', {
        maximumFractionDigits: 4
    }).format(value);
}

function getStationColor(index) {
    return 'hsl(' + ((index * 137.508) % 360) + ', 67%, 43%)';
}

function renderTable(rows) {
    let html = '<table class="uk-table uk-table-divider uk-table-striped station_compare_table"><thead><tr>';
    for (let header of rows[0])
        html += '<th>' + escapeHtml(header) + '</th>';
    html += '</tr></thead><tbody>';
    for (let row of rows.slice(1)) {
        html += '<tr>' + row.map(function (value) {
            let displayValue = typeof value === 'number' ? formatNumber(value) : value;
            return '<td class="station_compare_value">' + escapeHtml(displayValue) + '</td>';
        }).join('') + '</tr>';
    }
    html += '</tbody></table>';
    document.querySelector('.station_compare_result').innerHTML = html;
}

function renderChart(comparison) {
    if (typeof Chart === 'undefined') {
        setStatus(getComparisonText('data_compare_chart_error', 'The chart could not be loaded.'));
        return;
    }

    let labels = comparison.rows.map(function (row) {
        return row.label;
    });
    let datasets = comparison.series.map(function (series, index) {
        let color = getStationColor(index);
        return {
            label: series.label,
            data: comparison.rows.map(function (row) {
                let value = row.values[index];
                return Number.isFinite(value) ? value : null;
            }),
            borderColor: color,
            backgroundColor: color,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 4,
            tension: 0.2,
            spanGaps: true
        };
    });

    document.querySelector('.station_compare_result').innerHTML = '<div class="station_compare_chart"><canvas></canvas></div>';
    compareState.chart = new Chart(document.querySelector('.station_compare_chart canvas'), {
        type: 'line',
        data: {labels: labels, datasets: datasets},
        options: {
            maintainAspectRatio: false,
            interaction: {mode: 'nearest', intersect: false},
            scales: {
                x: {title: {display: true, text: getComparisonText(compareState.sameTime ? 'data_compare_time' : 'data_compare_interval', compareState.sameTime ? 'Time' : 'Interval')}},
                y: {title: {display: true, text: getComparisonText('data_compare_value', 'Value')}}
            }
        }
    });
}

/*
function calculateSamplingRate(sets) {
    let times = sets
        .map(getTimeValue)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);

    if (times.length < 2)
        return null;

    let differences = [];

    for (let i = 1; i < times.length; i++) {
        let diff = times[i] - times[i - 1];

        if (diff > 0)
            differences.push(diff);
    }

    if (differences.length === 0)
        return null;

    return getMedian(differences);
}

*/ 

function calculateSamplingRate1(sets) {
    let times = sets
        .map(getTimeValue)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);

    if (times.length < 2)
        return null;

    let differences = [];

    for (let i = 1; i < times.length; i++) {
        let diff = times[i] - times[i - 1];

        if (diff > 0)
            differences.push(diff);
    }

    return differences.length ? getMedian(differences) : null;
}

function renderSamplingRate(rows) {
	clearResult();
	/*
	let samplingRates = compareState.results.map(function (result) {
    		return {
        		collection: result.selection.collection,
        		interval: calculateSamplingRate(result.rawSets)
    		};
	});
	*/
 	let samplingRates1 = compareState.results.map(function (result) {
        	return calculateSamplingRate(result.rawSets);
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
	 
	 for (let rate of samplingRates1) {
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

function renderComparison() {
    clearResult();
    let comparison = buildComparisonData();
    let rows = buildComparisonRows(comparison);
    if (rows.length < 2) {
        setStatus(getComparisonText('data_compare_no_time_values', 'No time based numeric values are available for the selected attributes.'));
        return;
    }
    setStatus('');
    if (document.querySelector('#station_compare_mode').value === 'chart')
        renderChart(comparison);
	else if (document.querySelector('#station_compare_mode').value === 'table')
        renderTable(rows);
		else 
		renderSamplingRate(rows);
}

function executeComparison() {
    let selections = compareState.selections.filter(function (selection) {
        return selection.collection && selection.attributes.length > 0;
    });
    if (selections.length < 2) {
        setStatus(getComparisonText('data_compare_min_collections', 'Select at least two collections with attributes.'));
        return;
    }

    setStatus(getComparisonText('data_compare_loading', 'Station data is loading.'));
    clearResult();
    Promise.all(selections.map(function (selection) {
        return getStationData(selection.collection, selection).then(function (sets) {
            return {
                selection: selection,
		rawSets: sets,
                sets: getResultSets(selection, sets),
                index: compareState.selections.indexOf(selection)
            };
        });
    })).then(function (results) {
        compareState.results = results;
        compareState.intervalMs = getMeasurementInterval(results);
        if (compareState.intervalMs <= 0) {
            setStatus(getComparisonText('data_compare_interval_error', 'The measurement interval could not be determined.'));
            return;
        }
        renderComparison();
    }).catch(function (error) {
        console.error('Station comparison could not load data.', error);
        setStatus(getComparisonText('data_compare_data_error', 'The data of one station could not be loaded.'));
    });
}

/**
 * Copies the global period inputs into each station selection.
 *
 * @returns {undefined}
 */
function applyGlobalPeriod() {
    let period = getGlobalPeriod();
    for (let selection of compareState.selections) {
        if (!compareState.individualPeriods.from) {
            selection.fromDate = period.fromDate;
            selection.fromTime = period.fromTime;
        }
        if (!compareState.individualPeriods.to) {
            selection.toDate = period.toDate;
            selection.toTime = period.toTime;
        }
    }
    renderStationRows();
    resetComparison();
}

/**
 * Copies the selected global attribute to compatible station selections.
 *
 * @param {String} attribute Attribute name
 * @returns {undefined}
 */
function applyGlobalAttribute(attribute) {
    compareState.globalAttributes = attribute ? [attribute] : [];
    if (!compareState.individualAttributes && attribute) {
        for (let selection of compareState.selections) {
            if ((selection.availableAttributes || []).includes(attribute))
                selection.attributes = [attribute];
        }
    }
    renderStationRows();
    resetComparison();
}

/**
 * Switches between common and station specific attribute selection.
 *
 * @returns {undefined}
 */
function setIndividualAttributeSelection() {
    compareState.individualAttributes = document.querySelector('#station_compare_individual_attributes').checked;
    updateGlobalAttributeOptions();
    renderStationRows();
    resetComparison();
}

/**
 * Switches a period boundary between global and station specific input.
 *
 * @param {String} boundary Period boundary name
 * @returns {undefined}
 */
function setIndividualPeriodSelection(boundary) {
    let period = getGlobalPeriod();
    let individual = document.querySelector('#station_compare_individual_' + boundary).checked;
    compareState.individualPeriods[boundary] = individual;
    if (!individual) {
        for (let selection of compareState.selections) {
            if (boundary == 'from') {
                selection.fromDate = period.fromDate;
                selection.fromTime = period.fromTime;
            } else {
                selection.toDate = period.toDate;
                selection.toTime = period.toTime;
            }
        }
    }
    renderStationRows();
    resetComparison();
}

function exportComparison() {
    let rows = buildComparisonRows(buildComparisonData());
    if (rows.length < 2) {
        setStatus(getComparisonText('data_compare_export_empty', 'There is no comparison data to export.'));
        return;
    }
    let format = document.querySelector('#station_compare_export_format').value;
    let blob = TableExport.createBlob(rows, format);
    TableExport.download(blob, TableExport.getFilename('station_compare', format));
}

function onSelectionChange(event) {
    if (!event.target.matches('.station_compare_station, .station_compare_from_date, .station_compare_from_time, .station_compare_to_date, .station_compare_to_time, .station_compare_attributes, #station_compare_all_from_date, #station_compare_all_from_time, #station_compare_all_to_date, #station_compare_all_to_time, #station_compare_all_attributes, #station_compare_individual_attributes, #station_compare_individual_from, #station_compare_individual_to, #station_compare_same_time'))
        return;
    if (event.target.id === 'station_compare_all_attributes') {
        applyGlobalAttribute(event.target.value);
        return;
    }
    if (event.target.id === 'station_compare_individual_attributes') {
        setIndividualAttributeSelection();
        return;
    }
    if (event.target.id === 'station_compare_individual_from') {
        setIndividualPeriodSelection('from');
        return;
    }
    if (event.target.id === 'station_compare_individual_to') {
        setIndividualPeriodSelection('to');
        return;
    }
    if (event.target.id.startsWith('station_compare_all_')) {
        applyGlobalPeriod();
        return;
    }
    if (event.target.id === 'station_compare_same_time') {
        compareState.sameTime = event.target.checked;
        if (compareState.results.length > 0)
            renderComparison();
        return;
    }
    let index = Number(event.target.dataset.index);
    let selection = getSelection(index);
    if (event.target.classList.contains('station_compare_station')) {
        selection.collection = event.target.value;
        selection.attributes = [];
        selection.availableAttributes = [];
        resetComparison();
        updateSelectionAttributes(index);
        return;
    }
    if (event.target.classList.contains('station_compare_from_date'))
        selection.fromDate = event.target.value;
    if (event.target.classList.contains('station_compare_from_time'))
        selection.fromTime = event.target.value;
    if (event.target.classList.contains('station_compare_to_date'))
        selection.toDate = event.target.value;
    if (event.target.classList.contains('station_compare_to_time'))
        selection.toTime = event.target.value;
    if (event.target.classList.contains('station_compare_attributes'))
        selection.attributes = event.target.value ? [event.target.value] : [];
    resetComparison();
}

function initialise(stations) {
    compareState.stations = stations.sort(function (first, second) {
        return getStationName(first).localeCompare(getStationName(second));
    });
    compareState.selections = compareState.stations.slice(0, 2).map(function (station) {
        return createSelection(getStationCollection(station));
    });
    renderStationRows();
    Promise.all(compareState.selections.map(function (selection, index) {
        return updateSelectionAttributes(index);
    }));

    let compare = document.querySelector('#station_compare');
    compare.addEventListener('change', onSelectionChange);
    compare.addEventListener('click', function (event) {
        let removeButton = event.target.closest('.station_compare_remove');
        if (removeButton) {
            compareState.selections.splice(Number(removeButton.dataset.index), 1);
            updateGlobalAttributeOptions();
            renderStationRows();
            resetComparison();
            return;
        }
        if (event.target.closest('.station_compare_add')) {
            compareState.selections.push(createSelection());
            renderStationRows();
            return;
        }
        if (event.target.closest('.station_compare_reset')) {
            resetCompareSelections();
            return;
        }
        if (event.target.closest('.station_compare_execute')) {
            executeComparison();
            return;
        }
    });
    document.querySelector('.station_compare_apply_aggregation').addEventListener('click', executeComparison);
    document.querySelector('.station_compare_reset_aggregation').addEventListener('click', resetAggregation);
    document.querySelector('.station_compare_export').addEventListener('click', exportComparison);
    document.querySelector('#station_compare_mode').addEventListener('change', function () {
        if (compareState.results.length > 0)
            renderComparison();
    });
}

document.addEventListener('swac_lang_loaded', function () {
    if (compareState.selections.length === 0)
        return;
    updateGlobalAttributeOptions();
    renderStationRows();
});

function loadStations() {
    window.swac.Model.load({
        fromName: dataCompareOptions.stationSource,
        fromWheres: {
            filter: dataCompareOptions.stationFilter,
            order: dataCompareOptions.stationNameAttr + ',ASC'
        }
    }).then(function (source) {
        initialise(getSets(source));
    }).catch(function (error) {
        console.error('Station comparison could not load stations.', error);
        setStatus(getComparisonText('data_compare_collections_error', 'The stations could not be loaded.'));
    });
}

if (window.swac && window.swac.Model)
    loadStations();
else
    document.addEventListener('swac_ready', loadStations, {once: true});
