// Options for the observed object selector.
window['oo_change_options'] = {
    selectedParam: 'data_collection',
    keepCurrentParams: ['id'],
    paramsFromSet: ['data_collection'],
    fixedParams: {
        clearstate: 'true'
    },
    setOoId: false
};

function hasMapRouteValue(value) {
    if (value === null || typeof value === 'undefined')
        return false;

    let text = String(value).trim();
    return text !== '' && text.toLowerCase() !== 'null';
}

/**
 * Reads the selected route from the page URL.
 *
 * @returns {Object|null} Selected route or null
 */
function getMapRouteSelection() {
    let params = new URLSearchParams(window.location.search);
    if (params.get('route_detail') !== 'true')
        return null;

    return {
        name: params.has('route_name') ? params.get('route_name') : null,
        keyValues: {
            measurement_process: params.has('route_process')
                    ? params.get('route_process') : null
        }
    };
}

/**
 * Opens the detail view for one route group.
 *
 * @param {Object} group Selected route group
 * @param {Object} selection Route attribute values
 * @returns {undefined}
 */
function openMapRouteDetail(group, selection) {
    if (!group || !selection)
        return;

    let url = new URL(window.location.href);
    url.searchParams.set('route_detail', 'true');
    setMapRouteParameter(url, 'route_name', selection.name);
    setMapRouteParameter(url, 'route_process', selection.keyValues.measurement_process);
    window.location.assign(url.href);
}

/**
 * Adds or removes one route parameter.
 *
 * @param {URL} url Page URL
 * @param {String} name Parameter name
 * @param {*} value Parameter value
 * @returns {undefined}
 */
function setMapRouteParameter(url, name, value) {
    if (value === null || typeof value === 'undefined' || value === '')
        url.searchParams.delete(name);
    else
        url.searchParams.set(name, value);
}

/**
 * Returns from the route detail view to the station view.
 *
 * @returns {undefined}
 */
function leaveMapRouteDetail() {
    let url = new URL(window.location.href);
    url.searchParams.delete('route_detail');
    url.searchParams.delete('route_name');
    url.searchParams.delete('route_process');
    window.location.assign(url.href);
}

/**
 * Updates the project specific route detail view.
 *
 * @param {Map} groups Rendered route groups
 * @param {Object} context Route rendering context
 * @returns {undefined}
 */
function updateMapRouteDetail(groups, context) {
    let detail = document.getElementById('datamap_route_detail');
    let summary = document.getElementById('datamap_routes');
    let selection = getMapRouteSelection();
    if (!detail || !summary || !selection)
        return;

    detail.hidden = false;
    summary.hidden = true;
    let tableGroups = context && context.tableGroups ? context.tableGroups : groups;
    let group = [...tableGroups.values()].find(curGroup =>
        matchesMapRouteSelection(curGroup.rows[0].set, selection));
    let title = document.getElementById('datamap_route_detail_title');
    if (!group) {
        title.textContent = 'Route';
        renderMapRoutePoints([], context?.plugin);
        return;
    }
    title.textContent = group.name;
    renderMapRoutePoints(group.rows, context?.plugin);
}

/**
 * Checks whether one dataset belongs to the selected route.
 *
 * @param {Object} set Route dataset
 * @param {Object} selection Route attribute values
 * @returns {Boolean} True when the dataset belongs to the route
 */
function matchesMapRouteSelection(set, selection) {
    let name = hasMapRouteValue(set.measurement_name)
            ? String(set.measurement_name).trim() : null;
    let process = hasMapRouteValue(set.measurement_process)
            ? String(set.measurement_process).trim() : null;
    return name === selection.name
            && process === selection.keyValues.measurement_process;
}

/**
 * Renders route points as a sortable and filterable table.
 *
 * @param {Array} rows Route rows
 * @param {Object|null} routeAnalytics Route table helper
 * @returns {undefined}
 */
function renderMapRoutePoints(rows, routeAnalytics = null) {
    let table = document.getElementById('datamap_route_points');
    if (!table)
        return;

    let attrs = getMapRoutePointAttrs(rows);
    table.replaceChildren();
    let head = document.createElement('thead');
    let labelRow = document.createElement('tr');
    let filterRow = document.createElement('tr');
    for (let attr of attrs) {
        let labelCell = document.createElement('th');
        let label = document.createElement('span');
        label.classList.add('datamap-route-points-label');
        label.textContent = routeAnalytics && typeof routeAnalytics.getColumnName === 'function'
                ? routeAnalytics.getColumnName(attr, attr.toUpperCase()) : attr.toUpperCase();
        labelCell.appendChild(label);
        if (routeAnalytics && typeof routeAnalytics.addColumnRenameControl === 'function') {
            routeAnalytics.addColumnRenameControl(labelCell, attr, () =>
                renderMapRoutePoints(rows, routeAnalytics));
        }
        labelCell.addEventListener('click', () => sortMapRoutePoints(table, labelCell));
        labelCell.addEventListener('keypress', (event) => {
            if (event.key === 'Enter')
                sortMapRoutePoints(table, labelCell);
        });
        labelCell.tabIndex = 0;
        labelRow.appendChild(labelCell);

        let filterCell = document.createElement('th');
        let filter = document.createElement('input');
        filter.classList.add('uk-input', 'uk-form-small', 'datamap-route-points-filter');
        filter.type = 'search';
        filter.placeholder = attr;
        filter.dataset.columnIndex = labelRow.cells.length - 1;
        filter.addEventListener('click', (event) => event.stopPropagation());
        filter.addEventListener('input', () => filterMapRoutePoints(table));
        filterCell.appendChild(filter);
        filterRow.appendChild(filterCell);
    }
    head.appendChild(labelRow);
    head.appendChild(filterRow);
    table.appendChild(head);

    let body = document.createElement('tbody');
    for (let row of rows.slice().sort(compareMapRouteRows)) {
        let tableRow = document.createElement('tr');
        for (let attr of attrs) {
            let cell = document.createElement('td');
            let value = row.set[attr];
            cell.textContent = formatMapRouteValue(attr, value);
            cell.dataset.sortValue = getMapRouteSortValue(value);
            cell.dataset.searchValue = cell.textContent.toLowerCase();
            tableRow.appendChild(cell);
        }
        body.appendChild(tableRow);
    }
    table.appendChild(body);
}

/**
 * Gets all visible attributes with common route fields first.
 *
 * @param {Array} rows Route rows
 * @returns {Array} Attribute names
 */
function getMapRoutePointAttrs(rows) {
    let attrs = new Set();
    for (let row of rows) {
        for (let attr in row.set) {
            if (!attr.startsWith('swac_'))
                attrs.add(attr);
        }
    }
    let preferred = ['id', 'ts', 'measurement_name', 'measurement_process'];
    let ordered = preferred.filter(attr => attrs.delete(attr));
    return ordered.concat([...attrs].sort());
}

/**
 * Sorts route rows by timestamp.
 *
 * @param {Object} rowA First route row
 * @param {Object} rowB Second route row
 * @returns {Number} Sort result
 */
function compareMapRouteRows(rowA, rowB) {
    let timeA = Date.parse(rowA.set.ts);
    let timeB = Date.parse(rowB.set.ts);
    if (Number.isFinite(timeA) && Number.isFinite(timeB))
        return timeA - timeB;
    return String(rowA.set.id).localeCompare(String(rowB.set.id));
}

/**
 * Formats one route table value.
 *
 * @param {String} attr Attribute name
 * @param {*} value Source value
 * @returns {String} Display value
 */
function formatMapRouteValue(attr, value) {
    if (value === null || typeof value === 'undefined' || value === '')
        return 'null';
    if (attr === 'ts') {
        let time = Date.parse(value);
        if (Number.isFinite(time))
            return new Date(time).toLocaleString();
    }
    let geometry = formatMapGeometryValue(value);
    if (geometry !== null)
        return geometry;
    return String(value);
}

/**
 * Formats GeoJSON point values as WKT for table output.
 *
 * @param {*} value Source value
 * @returns {String|null} WKT value or null
 */
function formatMapGeometryValue(value) {
    let coordinates = getMapGeometryCoordinates(value);
    if (!coordinates)
        return null;

    return (coordinates.length > 2 ? 'POINT Z' : 'POINT')
            + '(' + coordinates.join(' ') + ')';
}

/**
 * Reads point coordinates from common geometry values.
 *
 * @param {*} value Geometry value
 * @param {Set} visited Processed objects
 * @returns {Array|null} Numeric coordinates or null
 */
function getMapGeometryCoordinates(value, visited = new Set()) {
    if (typeof value === 'string')
        return getMapWktCoordinates(value);

    if (Array.isArray(value))
        return getMapNumericCoordinates(value);

    if (!value || typeof value !== 'object' || visited.has(value))
        return null;

    visited.add(value);
    let geometry = value.type === 'Feature' ? value.geometry : value;
    if (!geometry || typeof geometry !== 'object')
        return null;
    let coordinates = getMapNumericCoordinates(geometry.coordinates);
    if (coordinates)
        return coordinates;

    let longitude = geometry.longitude ?? geometry.lng ?? geometry.lon ?? geometry.x;
    let latitude = geometry.latitude ?? geometry.lat ?? geometry.y;
    let altitude = geometry.altitude ?? geometry.alt ?? geometry.z;
    coordinates = getMapNumericCoordinates(altitude === null || typeof altitude === 'undefined'
            ? [longitude, latitude] : [longitude, latitude, altitude]);
    if (coordinates)
        return coordinates;

    for (let property of ['value', 'geometry', 'position', 'pos']) {
        coordinates = getMapGeometryCoordinates(geometry[property], visited);
        if (coordinates)
            return coordinates;
    }
    return null;
}

/**
 * Validates one coordinate array.
 *
 * @param {*} coordinates Coordinate array
 * @returns {Array|null} Numeric coordinates or null
 */
function getMapNumericCoordinates(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 2 || coordinates.some(Array.isArray))
        return null;

    let numericCoordinates = coordinates.slice(0, 3).map(Number);
    if (!Number.isFinite(numericCoordinates[0]) || !Number.isFinite(numericCoordinates[1]))
        return null;

    if (!Number.isFinite(numericCoordinates[2]))
        numericCoordinates.splice(2);
    return numericCoordinates;
}

/**
 * Reads coordinates from one WKT point.
 *
 * @param {String} value WKT point value
 * @returns {Array|null} Numeric coordinates or null
 */
function getMapWktCoordinates(value) {
    let number = '[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?';
    let match = value.trim().match(new RegExp('^POINT\\s*(?:ZM|Z|M)?\\s*\\(\\s*('
            + number + ')\\s+(' + number + ')(?:\\s+(' + number + '))?\\s*\\)$', 'i'));
    if (!match)
        return null;
    return getMapNumericCoordinates(match.slice(1).filter(coordinate => typeof coordinate !== 'undefined'));
}

/**
 * Gets a stable route table sort value.
 *
 * @param {*} value Source value
 * @returns {String|Number} Sort value
 */
function getMapRouteSortValue(value) {
    if (value === null || typeof value === 'undefined')
        return '';
    let geometry = formatMapGeometryValue(value);
    if (geometry !== null)
        return geometry;
    let numeric = Number(value);
    if (Number.isFinite(numeric))
        return numeric;
    let time = Date.parse(value);
    return Number.isFinite(time) ? time : String(value).toLowerCase();
}

/**
 * Filters route point table rows by the column inputs.
 *
 * @param {HTMLTableElement} table Route point table
 * @returns {undefined}
 */
function filterMapRoutePoints(table) {
    let filters = [...table.querySelectorAll('.datamap-route-points-filter')]
            .map(input => ({
                index: Number(input.dataset.columnIndex),
                value: input.value.trim().toLowerCase()
            }))
            .filter(filter => filter.value !== '');
    for (let row of table.tBodies[0].rows) {
        row.hidden = !filters.every(filter => {
            let cell = row.cells[filter.index];
            return String(cell?.dataset.searchValue || '').includes(filter.value);
        });
    }
}

/**
 * Sorts route point table rows by one column.
 *
 * @param {HTMLTableElement} table Route point table
 * @param {HTMLTableCellElement} header Selected header
 * @returns {undefined}
 */
function sortMapRoutePoints(table, header) {
    let direction = header.dataset.sortDirection === 'asc' ? 'desc' : 'asc';
    for (let cell of table.tHead.rows[0].cells)
        cell.removeAttribute('data-sort-direction');
    header.dataset.sortDirection = direction;

    let index = header.cellIndex;
    let rows = [...table.tBodies[0].rows];
    rows.sort((rowA, rowB) => {
        let valueA = rowA.cells[index].dataset.sortValue;
        let valueB = rowB.cells[index].dataset.sortValue;
        let numberA = Number(valueA);
        let numberB = Number(valueB);
        let result = Number.isFinite(numberA) && Number.isFinite(numberB)
                ? numberA - numberB : String(valueA).localeCompare(String(valueB));
        return direction === 'asc' ? result : -result;
    });
    table.tBodies[0].replaceChildren(...rows);
}

window['datamap_options'] = {
    datadescription: '#datamap_datadescription',
    geoJSONAttr: 'pos',
    lonAttr: 'pos_lon',
    latAttr: 'pos_lat',
    clusterMarkers: true,
    warnOnMissingCoordinates: false,
    dataShowModalAllowDelete: false,
    guiFilter: true,
    guiAggregation: true,
    guiTableExport: true,
    plugins: new Map([
        ['Navigation', {
            id: 'navigation',
            active: true
        }],
        ['RouteAnalytics', {
            id: 'routeanalytics',
            active: false
        }],
        ['DataShowModal', {
            id: 'datashowmodal',
            active: true
        }],
        ['Timeline', {
            id: 'timeline',
            active: false
        }],
        ['InterfaceMagicMapper', {
            id: 'interfacemagicmapper',
            active: false
        }],
        ['SearchPlaces', {
            id: 'searchplaces',
            active: false
        }],
        ['FilterMeasurementPoints', {
            id: 'filtermeasurementpoints',
            active: false
        }],
        ['ToggleClickInteractionButton', {
            id: 'toggleclickinteractionbutton',
            active: false
        }],
        ['ToggleLatchOnLocation', {
            id: 'togglelatchonlocation',
            active: false
        }],
        ['Labels', {
            id: 'labels',
            active: false
        }],
        ['Help', {
            id: 'help',
            active: false
        }]
    ])
};

// Route lines are drawn by RouteAnalytics.
window['navigation_datamap_options'] = {
    createRouteFromData: false,
    connectWithLine: true
};

// Route options for mobile measurements.
window['routeanalytics_datamap_options'] = {
    summaryTarget: '#datamap_routes',
    routeAttr: 'measurement_name',
    routeKeyAttrs: ['measurement_process'],
    routeFallbackAttrs: [],
    groupBySourceWhenRouteAttrsMissing: false,
    selectedRoute: getMapRouteSelection(),
    onRouteSelect: openMapRouteDetail,
    onRouteRender: updateMapRouteDetail,
    exportTableSelector: '#datamap_route_points',
    tsAttr: 'ts',
    defaultAggregation: {
        amount: 0,
        unit: 'minutes'
    },
    altitudeAttr: 'pos_altitude',
    splitByTimeGapMinutes: 30,
    splitUnnamedRoutesByTimeGap: false,
    ignoreUnnamedRoutesWithoutKey: true,
    groupUnroutedPoints: true,
    healthAttr: 'pm2_5',
    healthAttrs: ['pm2_5', 'pm10_0'],
    healthThresholds: {
        good: 5,
        medium: 25
    },
    healthThresholdsByAttr: {
        pm2_5: {
            good: 5,
            medium: 25
        },
        pm10_0: {
            good: 15,
            medium: 45
        }
    },
    segmentColorAttr: 'pm10_0',
    segmentColorThresholds: {
        good: 15,
        medium: 45
    },
    segmentColorMode: 'max',
    valueAttrs: ['pm2_5', 'pm10_0', 'co2', 'temp1'],
    routeColors: [
        '#0072B2',
        '#D55E00',
        '#009E73',
        '#CC79A7',
        '#E69F00',
        '#56B4E9',
        '#7F7F7F'
    ]
};

// Marker popup options.
window['datashowmodal_datamap_options'] = {
    // activeOn: {
    //     fromName: 'tbl_systemconfiguration',
    //     fromWheres: {
    //         filter: 'ckey,eq,func_datamap_datashowmodal&filter=active,eq,true'
    //     }
    // },
    attributeOrder: ['measurement_name', 'measurement_process', 'id', 'ts', 'pm2_5', 'pm10_0', 'temp1'],
    attrsFormat: new Map([['ts', 'datetime']])
};

// Marker color and legend.
window['datamap_datadescription_options'] = {
    visuAttribute: 'pm10_0'
};

document.addEventListener('DOMContentLoaded', function () {
    let backButton = document.getElementById('datamap_route_detail_back');
    if (backButton)
        backButton.addEventListener('click', leaveMapRouteDetail);
});

// window['datamap_options'].plugins.set('Timeline', {
//     id: 'timeline',
//     active: true,
// });

window['timeline_datamap_options'] = {
    activeOn: {
        fromName: 'tbl_systemconfiguration',
        fromWheres: {
            filter: 'ckey,eq,func_datamap_timeline&filter=active,eq,true'
        }
    },
    tsAttr: 'ts',
    startTS: '',
    endTS: '',
    outOfTimeOpacity: 0.2,
    animationStepSize: 1800,
    animationTimeRange: 86400
};

// window['navigation_datamap_options'] = {
//     activeOn: {
//         fromName: 'tbl_systemconfiguration',
//         fromWheres: {
//             filter: 'ckey,eq,func_datamap_navigation&filter=active,eq,true'
//         }
//     }
// }

window['interfacemagicmapper_datamap_options'] = {
    activeOn: {
        fromName: 'tbl_systemconfiguration',
        fromWheres: {
            filter: 'ckey,eq,func_datamap_magicmapper&filter=active,eq,true'
        }
    }
};

window['searchplaces_datamap_options'] = {
    activeOn: {
        fromName: 'tbl_systemconfiguration',
        fromWheres: {
            filter: 'ckey,eq,func_datamap_search&filter=active,eq,true'
        }
    }
};

window['filtermeasurementpoints_datamap_options'] = {
    activeOn: {
        fromName: 'tbl_systemconfiguration',
        fromWheres: {
            filter: 'ckey,eq,func_datamap_filter&filter=active,eq,true'
        }
    }
};

window['toggleclickinteractionbutton_datamap_options'] = {
    activeOn: {
        fromName: 'tbl_systemconfiguration',
        fromWheres: {
            filter: 'ckey,eq,func_datamap_toggleclickinteraction&filter=active,eq,true'
        }
    }
};

window['togglelatchonlocation_datamap_options'] = {
    activeOn: {
        fromName: 'tbl_systemconfiguration',
        fromWheres: {
            filter: 'ckey,eq,func_datamap_togglelatchonlocation&filter=active,eq,true'
        }
    }
};

window['help_datamap_options'] = {
    activeOn: {
        fromName: 'tbl_systemconfiguration',
        fromWheres: {
            filter: 'ckey,eq,func_datamap_help&filter=active,eq,true'
        }
    }
};

window['labels_datamap_options'] = {
    activeOn: {
        fromName: 'tbl_systemconfiguration',
        fromWheres: {
            filter: 'ckey,eq,func_datamap_labels&filter=active,eq,true'
        }
    },
    datasets: true
};

/**
 * Collections with raster data (e.g. satellite data). Each dataset of such a
 * collection is the value for an area around its position (raster cell). For
 * these collections the datamap draws colored areas instead of markers.
 *
 * Options per collection:
 * - cellSize: Edge length of a raster cell in meters
 * - cellSizeDeg: Size of a raster cell in degrees [longitude, latitude], used
 *   instead of cellSize when the grid is in degrees (no gaps between cells)
 * - cellsPerTimestep: Number of cells of one complete raster. Exactly this
 *   number of the newest datasets is loaded, so only the newest point in time is shown.
 * - colorAttr: Attribute used for coloring at start
 * - attributes: Attributes the user can choose for coloring
 * - datadescription: Name of the variable with the description of the values
 * - startPointLat, startPointLon, zoom: Start view of the map
 */
window['datamap_rastercollections'] = {
    exampledata_rasterdata: {
        cellSize: 3000, // about 3 x 3 km
        cellSizeDeg: [0.039964, 0.026815], // exact grid of the satellite data
        cellsPerTimestep: 4489, // 67 x 67 cells
        colorAttr: 'IR_134', // Infrared shows clouds at day and night
        attributes: ['IR_134', 'VIS006', 'VIS008', 'HRV', 'IR_016', 'WV_062', 'WV_073'],
        datadescription: 'datadesc_raster',
        startPointLat: 47.86,
        startPointLon: 12.12,
        zoom: 8
    }
};

/**
 * Gets the raster configuration for the collection selected in the URL.
 *
 * @returns {Object|null} Raster configuration or null for normal (point) data
 */
function getDatamapRasterConfig() {
    let collection = new URLSearchParams(window.location.search).get('data_collection');
    if (!collection)
        return null;
    let config = window['datamap_rastercollections'][collection];
    return config ? config : null;
}

/**
 * Changes the datamap for raster data: areas instead of markers, one point
 * in time, coloring by the satellite channels.
 * Must run before SWAC starts (SWAC starts on DOMContentLoaded).
 */
(function applyDatamapRasterConfig() {
    let raster = getDatamapRasterConfig();
    if (!raster)
        return;

    // Map: draw raster cells, no markers and no clusters
    let mapOptions = window['datamap_options'];
    mapOptions.areaShape = 'rect';
    mapOptions.areaSize = raster.cellSize;
    mapOptions.areaSizeDeg = raster.cellSizeDeg ? raster.cellSizeDeg : null;
    mapOptions.areaOnly = true;
    mapOptions.areaStyle = {weight: 0, fillOpacity: 0.6};
    mapOptions.clusterMarkers = false;
    mapOptions.startPointLat = raster.startPointLat;
    mapOptions.startPointLon = raster.startPointLon;
    mapOptions.zoom = raster.zoom;
    // All coloring settings at one place, the colors come from the datadescription
    mapOptions.plugins.set('ColorSelect', {
        id: 'ColorSelect',
        active: true,
        colorAttr: raster.colorAttr,
        attributes: raster.attributes,
        startOpened: true
    });
    // Data window when clicking on a cell
    window['datashowmodal_datamap_options'].attributeOrder = ['ts'].concat(raster.attributes);
    window['datamap_datadescription_options'] = {
        visuAttribute: raster.colorAttr
    };

    document.addEventListener('DOMContentLoaded', function () {
        // Load exactly one complete raster (the newest point in time)
        let map = document.getElementById('datamap');
        map.setAttribute('swa', map.getAttribute('swa')
                .replace(/size=\d+/, 'size=' + raster.cellsPerTimestep));
        // Use the description of the raster values
        let datadesc = document.getElementById('datamap_datadescription');
        datadesc.setAttribute('swa', 'Datadescription FROM ' + raster.datadescription);

        // Show which point in time is displayed
        let info = document.createElement('p');
        info.id = 'datamap_raster_info';
        info.classList.add('uk-article-meta');
        map.parentElement.insertBefore(info, map);
        document.addEventListener('swac_datamap_complete', function () {
            showDatamapRasterTime(map, info);
        });
    });
})();

/**
 * Shows the point in time of the displayed raster data.
 *
 * @param {HTMLElement} map Datamap element
 * @param {HTMLElement} info Element to show the information in
 * @returns {undefined}
 */
function showDatamapRasterTime(map, info) {
    let comp = map.swac_comp;
    if (!comp || !comp.data)
        return;
    let times = new Set();
    let count = 0;
    for (let curSource in comp.data) {
        for (let curSet of comp.data[curSource].getSets()) {
            if (!curSet)
                continue;
            count++;
            if (curSet.ts)
                times.add(curSet.ts);
        }
    }
    if (times.size === 0)
        return;
    let shown = [...times].map(ts => new Date(ts).toLocaleString()).join(', ');
    info.textContent = 'Rasterdaten: ' + count + ' Zellen, Zeitpunkt ' + shown;
}
