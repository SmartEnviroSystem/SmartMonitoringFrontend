// Project specific anomaly detection settings.
// Device, measured value, time attribute and period are selected with the
// SWAC component Dataselect, its options are set in anomalies.html.
var anomaliesOptions = {
    sourceId: 'anomalies_source',
    checksId: 'anomalies_checks',
    storage: 'smartmonitoring',
    smartdataUrl: '/SmartData',
    lyserUrl: '/SmartDataLyser/smartdatalyser/anomaly/',
    seriesColor: '#1e87f0',
    checkColors: {
        rateofchange: '#d62728',
        flatline: '#ff7f0e',
        oscillation: '#9467bd'
    },
    // Larger series are thinned out in the chart, the analysis uses all values
    chartSamples: 2000
};

// Order and translation keys of the parameters reported by SmartDataLyser
var anomaliesParameterLabels = {
    maxdelta: 'data_anomalies_maxdelta',
    minduration: 'data_anomalies_minduration',
    epsilon: 'data_anomalies_epsilon',
    window: 'data_anomalies_window',
    minchanges: 'data_anomalies_minchanges',
    minamplitude: 'data_anomalies_minamplitude',
    minstep: 'data_anomalies_minstep',
    measurefreq: 'data_anomalies_measurefreq'
};

var anomaliesState = {
    chart: null,
    // Index of the chart dataset showing the anomalies of each check
    datasetIndex: {}
};

function getAnomaliesText(key, fallback) {
    let language = window.swac && window.swac.lang;
    return language ? language.getTranslationForId(key) || fallback : fallback;
}

function setStatus(message) {
    document.querySelector('.anomalies_status').textContent = message || '';
}

/**
 * Gets the Dataselect component once SWAC has loaded it.
 */
function getSourceComponent() {
    let comp = document.getElementById(anomaliesOptions.sourceId).swac_comp;
    return comp && comp.getSelection ? comp : null;
}

/**
 * Gets device, measured value, time attribute and period selected in the
 * Dataselect component.
 *
 * @returns {Object} {id, name, collection, attribute, timeAttr, from, to} or null
 */
function getSource() {
    let comp = getSourceComponent();
    return comp ? comp.getSelection() : null;
}

/**
 * Gets the SWAC Select component listing the checks once SWAC has loaded it.
 */
function getChecksComponent() {
    let comp = document.getElementById(anomaliesOptions.checksId).swac_comp;
    return comp && comp.getInputs ? comp : null;
}

/**
 * Gets the checks offered by the Select component, by the id of their option.
 *
 * @returns {Object} Check names (rateofchange, ...) by option id
 */
function getCheckOptions() {
    let checks = {};
    let comp = getChecksComponent();
    if (!comp)
        return checks;
    for (let source in comp.getData()) {
        for (let set of comp.getData()[source].getSets()) {
            if (set)
                checks[set.id] = set.check;
        }
    }
    return checks;
}

/**
 * @returns {String[]} Names of the selected checks, e.g. ['rateofchange', 'flatline']
 */
function getSelectedChecks() {
    let comp = getChecksComponent();
    if (!comp)
        return [];
    let checks = getCheckOptions();
    return comp.getInputs().map(input => checks[input.value]).filter(Boolean);
}

function selectAllChecks() {
    let comp = getChecksComponent();
    if (!comp)
        return;
    // The option names are translation keys, mark them so SWAC translates them like swac_lang in HTML
    for (let bp of comp.requestor.querySelectorAll('label swac-bp[attrname="name"]'))
        bp.setAttribute('swac_lang', bp.textContent);
    window.swac.lang.translateAll(comp.requestor);
    let inputs = {};
    for (let id in getCheckOptions())
        inputs[id] = true;
    comp.setInputs(inputs);
    updateCheckParams();
}

/**
 * Shows the number of selected checks and the parameters of the selected checks only.
 */
function updateCheckParams() {
    let selected = getSelectedChecks();
    document.querySelector('.anomalies_checks_count').textContent = selected.length;
    for (let params of document.querySelectorAll('.anomalies_params')) {
        let active = selected.includes(params.dataset.check);
        params.hidden = !active;
        for (let input of params.querySelectorAll('input'))
            input.disabled = !active;
    }
}

/**
 * Collects the form input into one request per selected check.
 *
 * @returns {Object[]} List of {check, url}
 */
function buildRequests() {
    let source = getSource();
    let common = new URLSearchParams({
        smartdataurl: anomaliesOptions.smartdataUrl,
        storage: anomaliesOptions.storage,
        collection: source.collection,
        dateattribute: source.timeAttr,
        attribute: source.attribute,
        start: source.from,
        end: source.to
    });
    // Only the values of the selected device, if several devices share the collection
    if (source.filter)
        common.set('filter', source.filter);
    let measurefreq = document.querySelector('#anomalies_measurefreq').value;
    if (measurefreq)
        common.set('measurefreq', measurefreq);

    let requests = [];
    for (let check of getSelectedChecks()) {
        let params = new URLSearchParams(common);
        let paramInputs = document.querySelectorAll('.anomalies_params[data-check="' + check + '"] input');
        for (let input of paramInputs) {
            if (input.value === '')
                continue;
            // Durations are entered in minutes but transmitted in seconds
            let value = input.name === 'minduration' ? String(Number(input.value) * 60) : input.value;
            params.set(input.name, value);
        }
        requests.push({
            check: check,
            url: anomaliesOptions.lyserUrl + check + '?' + params.toString()
        });
    }
    return requests;
}

function validateForm() {
    let source = getSource();
    if (!source)
        return getAnomaliesText('data_anomalies_error_device', 'Please select a device.');
    if (!source.attribute)
        return getAnomaliesText('data_anomalies_error_attribute', 'Please select a measured value.');
    if (!source.timeAttr)
        return getAnomaliesText('data_anomalies_no_timeattr', 'Please select the time attribute.');
    // The period is checked by Dataselect, the browser blocks the submit if it is invalid
    if (getSelectedChecks().length === 0)
        return getAnomaliesText('data_anomalies_error_check', 'Please select at least one check.');
    return null;
}

function renderRequests(requests) {
    let list = document.querySelector('.anomalies_requests');
    list.innerHTML = '';
    for (let request of requests) {
        let item = document.createElement('li');
        let name = document.createElement('span');
        name.className = 'uk-text-bold';
        name.textContent = getAnomaliesText('data_anomalies_' + request.check, request.check) + ': ';
        let link = document.createElement('a');
        link.href = request.url;
        link.target = '_blank';
        link.textContent = request.url;
        item.appendChild(name);
        item.appendChild(link);
        list.appendChild(item);
    }
}

function formatNumber(value, digits = 3) {
    return Number(value).toLocaleString(undefined, {maximumFractionDigits: digits});
}

/**
 * Formats a period, the date is shown once if both ends are on the same day.
 */
function formatPeriod(from, until) {
    let start = new Date(from);
    let end = new Date(until);
    let endText = start.toDateString() === end.toDateString()
            ? end.toLocaleTimeString(undefined, {timeStyle: 'short'}) : formatTime(until);
    return formatTime(from) + ' – ' + endText;
}

function formatDuration(from, until) {
    let minutes = Math.round((new Date(until) - new Date(from)) / 60000);
    if (minutes < 60)
        return minutes + ' min';
    if (minutes < 48 * 60)
        return formatNumber(minutes / 60, 1) + ' h';
    return formatNumber(minutes / 1440, 1) + ' d';
}

/**
 * Describes how strong an anomaly is, using the indicator of its check.
 *
 * @param {Object} anomaly Anomaly from SmartDataLyser
 * @param {Object} parameters Parameters the check used
 */
function formatStrength(anomaly, parameters) {
    let label = getAnomaliesText('data_anomalies_indicator_' + anomaly.type, '');
    if (anomaly.type === 'rateofchange') {
        let factor = anomaly.indicator / parameters.maxdelta;
        return formatNumber(anomaly.indicator, 2) + ' /min (' + formatNumber(factor, factor >= 10 ? 0 : 1) + label + ')';
    }
    if (anomaly.type === 'flatline')
        return label + ' ' + formatNumber(anomaly.indicator);
    return formatNumber(anomaly.indicator) + ' ' + label;
}

function formatTime(value) {
    let date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, {dateStyle: 'short', timeStyle: 'short'});
}

function clearResult() {
    if (anomaliesState.chart) {
        anomaliesState.chart.destroy();
        anomaliesState.chart = null;
    }
    document.querySelector('.anomalies_result').hidden = true;
    document.querySelector('.anomalies_zoomreset').hidden = true;
    document.querySelector('.anomalies_parameters').innerHTML = '';
    document.querySelector('.anomalies_summary').innerHTML = '';
    document.querySelector('.anomalies_table').innerHTML = '';
    document.querySelector('.anomalies_requests').innerHTML = '';
}

/**
 * Calls one check at SmartDataLyser. Never rejects, a failure is returned
 * as error so the other checks are still shown.
 */
function runCheck(request) {
    return fetch(request.url).then(function (response) {
        return response.json().catch(function () {
            return {};
        }).then(function (json) {
            if (!response.ok) {
                let error = (json.errors && json.errors.join(' ')) || ('HTTP ' + response.status);
                return {check: request.check, error: error};
            }
            return {check: request.check, result: json};
        });
    }).catch(function (error) {
        return {check: request.check, error: error.message};
    });
}

/**
 * Loads the analysed values from SmartData for the chart.
 *
 * @returns {Promise} List of {x: milliseconds, y: value}
 */
function loadSeries() {
    let source = getSource();
    let collection = source.collection;
    let timeAttr = source.timeAttr;
    let attribute = source.attribute;
    let params = new URLSearchParams({
        storage: anomaliesOptions.storage,
        includes: timeAttr + ',' + attribute,
        order: timeAttr + ',ASC'
    });
    if (source.filter)
        params.append('filter', source.filter);
    params.append('filter', timeAttr + ',gt,' + source.from);
    params.append('filter', timeAttr + ',lt,' + source.to);
    let url = anomaliesOptions.smartdataUrl + '/smartdata/records/' + encodeURIComponent(collection) + '?' + params.toString();

    return fetch(url).then(function (response) {
        if (!response.ok)
            throw new Error('HTTP ' + response.status);
        return response.json();
    }).then(function (json) {
        let points = [];
        for (let set of json.records || []) {
            let x = new Date(set[timeAttr]).getTime();
            let y = Number(set[attribute]);
            if (!Number.isNaN(x) && set[attribute] !== null && Number.isFinite(y))
                points.push({x: x, y: y});
        }
        return points;
    });
}

/**
 * Formats the parameters a check used, marking the automatically determined ones.
 */
function formatParameters(parameters) {
    let automatic = parameters.automatic || [];
    let parts = [];
    for (let name in anomaliesParameterLabels) {
        if (parameters[name] === undefined)
            continue;
        // Durations are shown in minutes like in the form
        let value = name === 'minduration' ? parameters[name] / 60 : parameters[name];
        let text = getAnomaliesText(anomaliesParameterLabels[name], name) + ' ' + formatNumber(value);
        if (automatic.includes(name))
            text += ' (' + getAnomaliesText('data_anomalies_auto', 'automatic') + ')';
        parts.push(text);
    }
    return parts.join(', ');
}

function renderSummary(results) {
    let list = document.querySelector('.anomalies_summary');
    for (let checkResult of results) {
        let item = document.createElement('li');
        let name = document.createElement('span');
        name.className = 'uk-text-bold';
        name.style.color = anomaliesOptions.checkColors[checkResult.check];
        name.textContent = getAnomaliesText('data_anomalies_' + checkResult.check, checkResult.check) + ': ';
        item.appendChild(name);

        let text = document.createElement('span');
        if (checkResult.error) {
            text.className = 'uk-text-danger';
            text.textContent = getAnomaliesText('data_anomalies_check_error', 'The check failed') + ' - ' + checkResult.error;
        } else {
            text.textContent = getAnomaliesText('data_anomalies_findings', 'Findings') + ' '
                    + checkResult.result.anomalies.length;
            // The parameters are only needed for checking, they are shown in the technical details
            let paramItem = document.createElement('li');
            paramItem.append(name.cloneNode(true), formatParameters(checkResult.result.parameters));
            document.querySelector('.anomalies_parameters').appendChild(paramItem);
        }
        item.appendChild(text);
        list.appendChild(item);
    }
}

function renderTable(results) {
    let anomalies = [];
    let parameters = {};
    for (let checkResult of results) {
        if (checkResult.result) {
            anomalies.push(...checkResult.result.anomalies);
            parameters[checkResult.check] = checkResult.result.parameters;
        }
    }
    anomalies.sort(function (first, second) {
        return first.from.localeCompare(second.from);
    });

    let body = document.querySelector('.anomalies_table');
    for (let anomaly of anomalies) {
        let row = document.createElement('tr');
        let cells = [
            getAnomaliesText('data_anomalies_' + anomaly.type, anomaly.type),
            formatPeriod(anomaly.from, anomaly.until),
            formatDuration(anomaly.from, anomaly.until),
            anomaly.min === anomaly.max ? formatNumber(anomaly.min) : formatNumber(anomaly.min) + ' – ' + formatNumber(anomaly.max),
            formatStrength(anomaly, parameters[anomaly.type])
        ];
        for (let value of cells) {
            let cell = document.createElement('td');
            cell.textContent = value;
            row.appendChild(cell);
        }
        row.firstChild.style.color = anomaliesOptions.checkColors[anomaly.type];
        // Hover highlights the points in the chart, a click (focus) keeps them highlighted
        row.tabIndex = 0;
        row.style.cursor = 'pointer';
        row.addEventListener('mouseenter', () => highlightAnomaly(anomaly));
        row.addEventListener('focus', () => highlightAnomaly(anomaly));
        row.addEventListener('mouseleave', () => highlightAnomaly(document.activeElement === row ? anomaly : null));
        row.addEventListener('blur', () => highlightAnomaly(null));
        row.addEventListener('click', () => zoomToAnomaly(anomaly));
        row.addEventListener('keydown', function (event) {
            if (event.key === 'Enter')
                zoomToAnomaly(anomaly);
        });
        body.appendChild(row);
    }
    if (anomalies.length === 0) {
        let row = document.createElement('tr');
        let cell = document.createElement('td');
        cell.colSpan = 5;
        cell.textContent = getAnomaliesText('data_anomalies_none', 'No anomalies found.');
        row.appendChild(cell);
        body.appendChild(row);
    }
    return anomalies.length;
}

/**
 * Draws the analysed values and marks the values of every anomaly in the
 * colour of its check.
 */
function renderChart(series, results) {
    let chartElem = document.querySelector('.anomalies_chart');
    if (typeof Chart === 'undefined' || !series) {
        chartElem.hidden = true;
        return;
    }
    chartElem.hidden = false;

    anomaliesState.datasetIndex = {};
    let datasets = [{
            label: getSource().attribute,
            data: series,
            borderColor: anomaliesOptions.seriesColor,
            backgroundColor: anomaliesOptions.seriesColor,
            borderWidth: 1,
            pointRadius: 0
        }];
    for (let checkResult of results) {
        if (!checkResult.result || checkResult.result.anomalies.length === 0)
            continue;
        let periods = checkResult.result.anomalies.map(function (anomaly) {
            return {from: new Date(anomaly.from).getTime(), until: new Date(anomaly.until).getTime()};
        });
        let color = anomaliesOptions.checkColors[checkResult.check];
        anomaliesState.datasetIndex[checkResult.check] = datasets.length;
        datasets.push({
            label: getAnomaliesText('data_anomalies_' + checkResult.check, checkResult.check),
            data: series.filter(function (point) {
                return periods.some(period => point.x >= period.from && point.x <= period.until);
            }),
            borderColor: color,
            backgroundColor: color,
            showLine: false,
            pointRadius: 3,
            // Size of the points highlighted from the table
            pointHoverRadius: 8,
            pointHoverBorderWidth: 3,
            pointHoverBorderColor: '#000'
        });
    }

    anomaliesState.chart = new Chart(chartElem.querySelector('canvas'), {
        type: 'line',
        data: {datasets: datasets},
        options: {
            maintainAspectRatio: false,
            animation: false,
            parsing: false,
            normalized: true,
            interaction: {mode: 'nearest', intersect: false},
            plugins: {
                decimation: {enabled: true, algorithm: 'lttb', samples: anomaliesOptions.chartSamples}
            },
            scales: {
                x: {type: 'time'},
                y: {title: {display: true, text: getAnomaliesText('data_anomalies_chart_values', 'Values')}}
            }
        }
    });
}

/**
 * Lets the chart points of one anomaly light up.
 *
 * @param {Object} anomaly Anomaly from SmartDataLyser, null removes the highlight
 */
function highlightAnomaly(anomaly) {
    let chart = anomaliesState.chart;
    if (!chart)
        return;
    let elements = [];
    let datasetIndex = anomaly ? anomaliesState.datasetIndex[anomaly.type] : undefined;
    if (datasetIndex !== undefined) {
        let from = new Date(anomaly.from).getTime();
        let until = new Date(anomaly.until).getTime();
        chart.data.datasets[datasetIndex].data.forEach(function (point, index) {
            if (point.x >= from && point.x <= until)
                elements.push({datasetIndex: datasetIndex, index: index});
        });
    }
    chart.setActiveElements(elements);
    chart.update();
}

/**
 * Zooms the chart to one anomaly with some context around it.
 */
function zoomToAnomaly(anomaly) {
    let chart = anomaliesState.chart;
    if (!chart)
        return;
    let from = new Date(anomaly.from).getTime();
    let until = new Date(anomaly.until).getTime();
    let padding = Math.max(until - from, 3 * 3600 * 1000);
    chart.options.scales.x.min = from - padding;
    chart.options.scales.x.max = until + padding;
    chart.update();
    document.querySelector('.anomalies_zoomreset').hidden = false;
}

function resetZoom() {
    let chart = anomaliesState.chart;
    if (chart) {
        delete chart.options.scales.x.min;
        delete chart.options.scales.x.max;
        chart.update();
    }
    document.querySelector('.anomalies_zoomreset').hidden = true;
}

function executeAnalysis(event) {
    event.preventDefault();
    let error = validateForm();
    if (error) {
        setStatus(error);
        return;
    }
    clearResult();
    let requests = buildRequests();
    renderRequests(requests);
    setStatus(getAnomaliesText('data_anomalies_running', 'The analysis is running ...'));

    let seriesProm = loadSeries().catch(function (error) {
        console.error('Anomaly detection could not load the values for the chart.', error);
        return null;
    });
    Promise.all([Promise.all(requests.map(runCheck)), seriesProm]).then(function ([results, series]) {
        document.querySelector('.anomalies_result').hidden = false;
        renderSummary(results);
        let count = renderTable(results);
        renderChart(series, results);

        let messages = [];
        if (results.every(checkResult => checkResult.error))
            messages.push(getAnomaliesText('data_anomalies_all_failed', 'All checks failed. Is SmartDataLyser deployed?'));
        else
            messages.push(getAnomaliesText('data_anomalies_found', 'Anomalies found') + ': ' + count);
        if (!series)
            messages.push(getAnomaliesText('data_anomalies_series_error', 'The values for the chart could not be loaded.'));
        setStatus(messages.join(' '));
    });
}

function initialise() {
    updateCheckParams();

    let form = document.querySelector('#anomalies_form');
    form.addEventListener('submit', executeAnalysis);
    document.querySelector('.anomalies_zoomreset').addEventListener('click', resetZoom);
    form.addEventListener('reset', function () {
        // Wait until the browser has reset the inputs (the period goes back to the Dataselect preset)
        setTimeout(function () {
            let comp = getSourceComponent();
            if (comp)
                comp.setSelection('');
            selectAllChecks();
            setStatus('');
            clearResult();
        }, 0);
    });
    // Old results do not match a new selection
    document.addEventListener('swac_' + anomaliesOptions.sourceId + '_dataselect_changed', function () {
        setStatus('');
        clearResult();
    });
    // All checks are selected once the Select component has loaded its options
    if (window.swac && window.swac.loadedComponents && window.swac.loadedComponents.has(anomaliesOptions.checksId))
        selectAllChecks();
    else
        document.addEventListener('swac_' + anomaliesOptions.checksId + '_complete', selectAllChecks, {once: true});
    document.addEventListener('swac_' + anomaliesOptions.checksId + '_selection_changed', updateCheckParams);
}

initialise();
