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
    timeTypes: ['timestamp', 'timestamptz', 'timestamp without time zone', 'timestamp with time zone']
};

var anomaliesState = {
    devices: []
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

function executeAnalysis(event) {
    event.preventDefault();
    let error = validateForm();
    if (error) {
        setStatus(error);
        return;
    }
    setStatus('');
    renderRequests(buildRequests());
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
            document.querySelector('.anomalies_requests').innerHTML = '';
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
