import ViewHandler from '/SWAC/swac/ViewHandler.js';
import Model from '/SWAC/swac/Model.js';

// Anomaly overview: checks all numeric columns of the selected devices at
// SmartDataLyser and shows the result as categorical Heatmap.
var overviewOptions = {
    sourceId: 'overview_source',
    gridId: 'overview_grid',
    lyserUrl: '/SmartDataLyser/smartdatalyser/anomaly/overview',
    smartdataUrl: '/SmartData',
    storage: 'smartmonitoring',
    detailPage: 'anomalies.html',
    numericTypes: ['int2', 'int4', 'int8', 'float4', 'float8', 'numeric', 'decimal'],
    excludedAttributes: ['id', 'oo_id', 'pos_accuracy', 'pos_altitude_accuracy', 'pos_heading', 'pos_speed']
};

// Last result, needed to open the details of a clicked cell
var overviewState = {
    buckets: [],
    labels: [],
    end: null,
    cells: {}
};

// UIkit has no icon for "jumping between extremes"
UIkit.icon.add('anomaly-pulse', '<svg width="20" height="20" viewBox="0 0 20 20"><polyline fill="none" stroke="#000" stroke-width="1.3" points="1,10 5,10 7,4 10,16 13,4 15,10 19,10"/></svg>');

function getText(key, fallback) {
    let language = window.swac && window.swac.lang;
    return language ? language.getTranslationForId(key) || fallback : fallback;
}

function setStatus(message, loading = false) {
    document.querySelector('.overview_status').textContent = message || '';
    document.querySelector('.overview_loading').hidden = !loading;
}

function getCategories() {
    return {
        outlier: {label: getText('data_overview_outlier', 'Outlier'), color: '#d62728', icon: 'warning'},
        jump: {label: getText('data_overview_jump', 'Jump'), color: '#d62728', icon: 'bolt'},
        flatline: {label: getText('data_anomalies_flatline', 'Constant for too long'), color: '#ff7f0e', icon: 'minus'},
        oscillation: {label: getText('data_anomalies_oscillation', 'Jumping between extremes'), color: '#9467bd', icon: 'anomaly-pulse'},
        missing: {label: getText('data_overview_missing', 'Missing values'), color: '#6b7280', icon: 'ban'}
    };
}

/**
 * Gets time attribute and numeric columns of every selected device.
 *
 * @returns {Object} {series, skipped}, skipped are names of devices without checkable columns
 */
async function buildSeries(selection) {
    let series = [];
    let skipped = [];
    for (let set of selection.sets) {
        let definitions = await Model.getValueDefinitions({fromName: set.collection}) || [];
        let timeDef = definitions.find(def => def.name === 'ts') || definitions.find(def => String(def.type).startsWith('timestamp'));
        let attributes = definitions.filter(def => overviewOptions.numericTypes.includes(def.type)
                    && !overviewOptions.excludedAttributes.includes(def.name)).map(def => def.name);
        if (!timeDef || attributes.length === 0) {
            skipped.push(set.name);
            continue;
        }
        series.push({id: set.id, name: set.name, collection: set.collection, filter: set.filter,
            dateattribute: timeDef.name, attributes: attributes});
    }
    return {series, skipped};
}

function bucketLabel(value, bucket) {
    let date = new Date(value);
    if (bucket === 'hour')
        return date.toLocaleString(undefined, {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'});
    return date.toLocaleDateString(undefined, {day: '2-digit', month: '2-digit'});
}

/**
 * @param {Object} result Answer of SmartDataLyser
 * @param {Object} names Device names by id. The names in the answer lose
 *  everything after a quotation mark (JSON output of ResponseObjectBuilder).
 */
async function renderGrid(result, names) {
    let labels = result.buckets.map(value => bucketLabel(value, result.bucket));
    overviewState = {buckets: result.buckets, labels: labels, end: result.end, cells: {}};
    // Heatmap categories: null = normal, missing attribute = no data
    let rows = result.rows.map(function (row) {
        overviewState.cells[row.id] = row.cells;
        let set = {id: row.id, name: names[row.id] || row.name};
        row.cells.forEach(function (cell, index) {
            if (cell.category === 'normal')
                set[labels[index]] = null;
            else if (cell.category !== 'nodata')
                set[labels[index]] = cell.category;
        });
        return set;
    });

    let previous = document.getElementById(overviewOptions.gridId);
    if (previous && previous.swac_comp)
        previous.swac_comp.delete();
    window.overview_grid_data = rows;
    window.overview_grid_options = {mode: 'categories', categories: getCategories(), attributeOrder: labels};
    let requestor = document.createElement('div');
    requestor.id = overviewOptions.gridId;
    requestor.setAttribute('swa', 'Heatmap FROM overview_grid_data OPTIONS overview_grid_options');
    document.querySelector('.overview_result').replaceChildren(requestor);
    await new ViewHandler().load(requestor);
}

async function createOverview(event) {
    if (event)
        event.preventDefault();
    let comp = document.getElementById(overviewOptions.sourceId).swac_comp;
    let selection = comp && comp.getSelection ? comp.getSelection() : null;
    if (!selection)
        return;
    setStatus(getText('data_overview_running', 'Checking the devices ...'), true);
    try {
        let {series, skipped} = await buildSeries(selection);
        let messages = skipped.length > 0 ? [getText('data_overview_skipped', 'No checkable values') + ': ' + skipped.join(', ')] : [];
        if (series.length === 0) {
            setStatus(messages.join(' '));
            return;
        }
        let response = await fetch(overviewOptions.lyserUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({smartdataurl: overviewOptions.smartdataUrl, storage: overviewOptions.storage,
                start: selection.from, end: selection.to, series: series})
        });
        let result = await response.json().catch(() => ({}));
        if (!response.ok)
            throw new Error((result.errors && result.errors.join(' ')) || 'HTTP ' + response.status);
        let names = Object.fromEntries(series.map(curSeries => [curSeries.id, curSeries.name]));
        await renderGrid(result, names);
        for (let row of result.rows) {
            if (row.error)
                messages.push(names[row.id] + ': ' + row.error);
        }
        setStatus(messages.join(' '));
    } catch (error) {
        setStatus(getText('data_overview_error', 'The overview could not be created') + ' - ' + error.message);
    }
}

/**
 * Opens the detail page for the clicked cell: device, the measured value that
 * caused the category and the period of the cell. Normal cells have nothing to show.
 */
function openDetails(event) {
    let index = overviewState.labels.indexOf(event.detail.attribute);
    let cell = (overviewState.cells[event.detail.set.id] || [])[index];
    if (!cell || !cell.attribute)
        return;
    let params = new URLSearchParams({
        oo_id: event.detail.set.id,
        attribute: cell.attribute,
        start: overviewState.buckets[index],
        end: overviewState.buckets[index + 1] || overviewState.end
    });
    window.location.href = overviewOptions.detailPage + '?' + params.toString();
}

function initialise() {
    document.querySelector('#overview_form').addEventListener('submit', createOverview);
    document.addEventListener('swac_' + overviewOptions.gridId + '_heatmap_cell_clicked', openDetails);
    // Devices in the URL (shared link, back from the details): create the overview directly
    if (new URLSearchParams(window.location.search).get('oo_id')) {
        let eventName = 'swac_' + overviewOptions.sourceId + '_dataselect_changed';
        document.addEventListener(eventName, function onPreselected(evt) {
            if (evt.detail.changed !== 'set')
                return;
            document.removeEventListener(eventName, onPreselected);
            if (evt.detail.selection)
                createOverview();
        });
    }
}

initialise();
