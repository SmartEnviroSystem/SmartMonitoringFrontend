// Project specific anomaly detection settings.
var anomaliesOptions = {
    deviceSource: 'tbl_observedobject',
    deviceFilter: 'data_collection,nis',
    deviceNameAttr: 'name',
    collectionAttr: 'data_collection',
    defaultTimeAttr: 'ts',
    defaultPeriodDays: 30,
    storage: 'smartmonitoring',
    smartdataUrl: '/SmartData',
    lyserUrl: '/SmartDataLyser/smartdatalyser/anomaly/',
    excludedAttributes: ['id', 'oo_id', 'pos_accuracy', 'pos_altitude_accuracy', 'pos_heading', 'pos_speed'],
    numericTypes: ['int2', 'int4', 'int8', 'float4', 'float8', 'numeric', 'decimal', 'smallint', 'integer', 'bigint', 'real', 'double precision'],
    timeTypes: ['timestamp', 'timestamptz', 'timestamp without time zone', 'timestamp with time zone'],
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
    devices: [],
    chart: null
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

function getAnomaliesText(key, fallback) {
    let language = window.swac && window.swac.lang;
    return language ? language.getTranslationForId(key) || fallback : fallback;
}

function setStatus(message) {
    document.querySelector('.anomalies_status').textContent = message || '';
}

/**
 * Creates an option element whose text is translated by SWAC.
 */
function createOption(value, text, langKey) {
    let option = document.createElement('option');
    option.value = value;
    option.textContent = langKey ? getAnomaliesText(langKey, text) : text;
    if (langKey)
        option.setAttribute('swac_lang_id', langKey);
    return option;
}

/**
 * Formats a date as value for an input of type datetime-local (local time).
 */
function toDateTimeLocal(date) {
    let pad = function (number) {
        return String(number).padStart(2, '0');
    };
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
            + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

function setDefaultPeriod() {
    let to = new Date();
    let from = new Date(to.getTime() - anomaliesOptions.defaultPeriodDays * 24 * 60 * 60 * 1000);
    document.querySelector('#anomalies_from').value = toDateTimeLocal(from);
    document.querySelector('#anomalies_to').value = toDateTimeLocal(to);
}

function getSelectedDevice() {
    let id = document.querySelector('#anomalies_device').value;
    return anomaliesState.devices.find(function (device) {
        return String(device.id) === id;
    });
}

function renderDevices() {
    let select = document.querySelector('#anomalies_device');
    select.innerHTML = '';
    select.appendChild(createOption('', 'Select device', 'data_anomalies_select_device'));
    for (let device of anomaliesState.devices) {
        let name = device[anomaliesOptions.deviceNameAttr] || device[anomaliesOptions.collectionAttr];
        select.appendChild(createOption(device.id, name + ' (' + device[anomaliesOptions.collectionAttr] + ')'));
    }

    // Preselect device given by url, e.g. anomalies.html?oo_id=3
    let ooId = new URLSearchParams(window.location.search).get('oo_id');
    if (ooId && anomaliesState.devices.some(device => String(device.id) === ooId)) {
        select.value = ooId;
        loadAttributes();
    }
}

function resetAttributeSelects(langKey, fallback) {
    let attrSelect = document.querySelector('#anomalies_attribute');
    attrSelect.innerHTML = '';
    attrSelect.appendChild(createOption('', fallback, langKey));
    attrSelect.disabled = true;

    let timeSelect = document.querySelector('#anomalies_timeattr');
    timeSelect.innerHTML = '';
    timeSelect.disabled = true;
}

/**
 * Loads the structure of the selected devices data collection from SmartData
 * and offers its numeric attributes as measured values.
 */
function loadAttributes() {
    let device = getSelectedDevice();
    if (!device) {
        resetAttributeSelects('data_anomalies_select_device_first', 'Select device first');
        return;
    }
    resetAttributeSelects('data_anomalies_loading', 'Loading ...');

    window.swac.Model.getValueDefinitions({
        fromName: device[anomaliesOptions.collectionAttr]
    }).then(function (attributes) {
        let numeric = [];
        let times = [];
        for (let attribute of attributes || []) {
            if (anomaliesOptions.excludedAttributes.includes(attribute.name))
                continue;
            if (anomaliesOptions.timeTypes.includes(attribute.type))
                times.push(attribute.name);
            else if (anomaliesOptions.numericTypes.includes(attribute.type))
                numeric.push(attribute.name);
        }
        numeric.sort();
        renderAttributes(numeric, times);
    }).catch(function (error) {
        console.error('Anomaly detection could not load the data structure.', error);
        resetAttributeSelects('data_anomalies_structure_error', 'Data structure could not be loaded');
        setStatus(getAnomaliesText('data_anomalies_structure_error', 'Data structure could not be loaded'));
    });
}

function renderAttributes(numeric, times) {
    let attrSelect = document.querySelector('#anomalies_attribute');
    attrSelect.innerHTML = '';
    if (numeric.length === 0) {
        attrSelect.appendChild(createOption('', 'No numeric values', 'data_anomalies_no_numeric'));
    } else {
        attrSelect.appendChild(createOption('', 'Select measured value', 'data_anomalies_select_attribute'));
        for (let name of numeric)
            attrSelect.appendChild(createOption(name, name));
        attrSelect.disabled = false;
    }

    let timeSelect = document.querySelector('#anomalies_timeattr');
    timeSelect.innerHTML = '';
    for (let name of times)
        timeSelect.appendChild(createOption(name, name));
    if (times.includes(anomaliesOptions.defaultTimeAttr))
        timeSelect.value = anomaliesOptions.defaultTimeAttr;
    timeSelect.disabled = times.length < 2;
    if (times.length === 0)
        setStatus(getAnomaliesText('data_anomalies_no_timeattr', 'The data has no time attribute.'));
    else
        setStatus('');
}

/**
 * Enables parameter inputs only for active checks.
 */
function updateCheckParams() {
    for (let check of document.querySelectorAll('.anomalies_check')) {
        let params = document.querySelector('.anomalies_params[data-check="' + check.value + '"]');
        params.style.opacity = check.checked ? '' : '0.4';
        for (let input of params.querySelectorAll('input'))
            input.disabled = !check.checked;
    }
}

/**
 * Collects the form input into one request per selected check.
 *
 * @returns {Object[]} List of {check, url}
 */
function buildRequests() {
    let device = getSelectedDevice();
    let common = new URLSearchParams({
        smartdataurl: anomaliesOptions.smartdataUrl,
        storage: anomaliesOptions.storage,
        collection: device[anomaliesOptions.collectionAttr],
        dateattribute: document.querySelector('#anomalies_timeattr').value || anomaliesOptions.defaultTimeAttr,
        attribute: document.querySelector('#anomalies_attribute').value,
        start: document.querySelector('#anomalies_from').value,
        end: document.querySelector('#anomalies_to').value
    });
    let measurefreq = document.querySelector('#anomalies_measurefreq').value;
    if (measurefreq)
        common.set('measurefreq', measurefreq);

    let requests = [];
    for (let check of document.querySelectorAll('.anomalies_check:checked')) {
        let params = new URLSearchParams(common);
        let paramInputs = document.querySelectorAll('.anomalies_params[data-check="' + check.value + '"] input');
        for (let input of paramInputs) {
            if (input.value === '')
                continue;
            // Durations are entered in minutes but transmitted in seconds
            let value = input.name === 'minduration' ? String(Number(input.value) * 60) : input.value;
            params.set(input.name, value);
        }
        requests.push({
            check: check.value,
            url: anomaliesOptions.lyserUrl + check.value + '?' + params.toString()
        });
    }
    return requests;
}

function validateForm() {
    if (!getSelectedDevice())
        return getAnomaliesText('data_anomalies_error_device', 'Please select a device.');
    if (!document.querySelector('#anomalies_attribute').value)
        return getAnomaliesText('data_anomalies_error_attribute', 'Please select a measured value.');
    let from = document.querySelector('#anomalies_from').value;
    let to = document.querySelector('#anomalies_to').value;
    if (!from || !to || from >= to)
        return getAnomaliesText('data_anomalies_error_period', 'The start must be before the end.');
    if (document.querySelectorAll('.anomalies_check:checked').length === 0)
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

function formatNumber(value) {
    return Number(value).toLocaleString(undefined, {maximumFractionDigits: 3});
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
    let collection = getSelectedDevice()[anomaliesOptions.collectionAttr];
    let timeAttr = document.querySelector('#anomalies_timeattr').value || anomaliesOptions.defaultTimeAttr;
    let attribute = document.querySelector('#anomalies_attribute').value;
    let params = new URLSearchParams({
        storage: anomaliesOptions.storage,
        includes: timeAttr + ',' + attribute,
        order: timeAttr + ',ASC'
    });
    params.append('filter', timeAttr + ',gt,' + document.querySelector('#anomalies_from').value);
    params.append('filter', timeAttr + ',lt,' + document.querySelector('#anomalies_to').value);
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
                    + checkResult.result.anomalies.length + ' · ' + formatParameters(checkResult.result.parameters);
        }
        item.appendChild(text);
        list.appendChild(item);
    }
}

function renderTable(results) {
    let anomalies = [];
    for (let checkResult of results) {
        if (checkResult.result)
            anomalies.push(...checkResult.result.anomalies);
    }
    anomalies.sort(function (first, second) {
        return first.from.localeCompare(second.from);
    });

    let body = document.querySelector('.anomalies_table');
    for (let anomaly of anomalies) {
        let row = document.createElement('tr');
        let cells = [
            getAnomaliesText('data_anomalies_' + anomaly.type, anomaly.type),
            formatTime(anomaly.from),
            formatTime(anomaly.until),
            anomaly.count,
            formatNumber(anomaly.min),
            formatNumber(anomaly.max),
            getAnomaliesText('data_anomalies_indicator_' + anomaly.type, '') + ' ' + formatNumber(anomaly.indicator)
        ];
        for (let value of cells) {
            let cell = document.createElement('td');
            cell.textContent = value;
            row.appendChild(cell);
        }
        row.firstChild.style.color = anomaliesOptions.checkColors[anomaly.type];
        body.appendChild(row);
    }
    if (anomalies.length === 0) {
        let row = document.createElement('tr');
        let cell = document.createElement('td');
        cell.colSpan = 7;
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

    let datasets = [{
            label: document.querySelector('#anomalies_attribute').value,
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
        datasets.push({
            label: getAnomaliesText('data_anomalies_' + checkResult.check, checkResult.check),
            data: series.filter(function (point) {
                return periods.some(period => point.x >= period.from && point.x <= period.until);
            }),
            borderColor: color,
            backgroundColor: color,
            showLine: false,
            pointRadius: 3
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

function initialise(devices) {
    anomaliesState.devices = devices;
    renderDevices();
    setDefaultPeriod();
    updateCheckParams();

    let form = document.querySelector('#anomalies_form');
    form.addEventListener('submit', executeAnalysis);
    form.addEventListener('reset', function () {
        // Wait until the browser has reset the inputs
        setTimeout(function () {
            setDefaultPeriod();
            resetAttributeSelects('data_anomalies_select_device_first', 'Select device first');
            updateCheckParams();
            setStatus('');
            clearResult();
        }, 0);
    });
    document.querySelector('#anomalies_device').addEventListener('change', loadAttributes);
    for (let check of document.querySelectorAll('.anomalies_check'))
        check.addEventListener('change', updateCheckParams);
}

function loadDevices() {
    window.swac.Model.load({
        fromName: anomaliesOptions.deviceSource,
        fromWheres: {
            filter: anomaliesOptions.deviceFilter,
            order: anomaliesOptions.deviceNameAttr + ',ASC'
        }
    }).then(function (source) {
        initialise(getSets(source));
    }).catch(function (error) {
        console.error('Anomaly detection could not load devices.', error);
        setStatus(getAnomaliesText('data_anomalies_devices_error', 'The devices could not be loaded.'));
    });
}

if (window.swac && window.swac.Model)
    loadDevices();
else
    document.addEventListener('swac_ready', loadDevices, {once: true});
