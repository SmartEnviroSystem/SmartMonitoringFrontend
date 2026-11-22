/*
 * Options for sites/datavisus/calendar.html (pattern: js/datavisus/charts.js).
 * All logic lives in the SWAC component Diagramcalendar (SWAC: components/Diagramcalendar).
 *
 * Works with every table that has a time column and every numeric attribute:
 * time column and attributes are detected by the component, nothing table specific here.
 *
 * URL parameters (read by the component, written back while navigating):
 *   data_collection  table of the selected device (set by oo_change)
 *   month            month to show, e.g. 2026-06 (default: month of the newest data)
 *   view, week       week view, e.g. view=week&week=2026-06-15
 *   attrs, interval, style   selected attributes, averaging interval, style=step for steps
 */

// Device selector as on the charts page. Period, view and selection are kept when the device changes;
// attributes that do not exist in the new table are ignored by the component.
window['oo_change_options'] = {
    selectedParam: 'data_collection',
    keepCurrentParams: ['month', 'week', 'view', 'attrs', 'interval', 'style'],
    paramsFromSet: ['data_collection'],
    fixedParams: {},
    setOoId: false
};

// Diagramcalendar: all options see README (section Diagrammkalender) or desc.opts of the component
window['calendar_options'] = {
    // Without ?data_collection= SWAC requests no data and would hide the component.
    // With true it is shown and selects the first device from tbl_observedobject itself.
    showWhenNoData: true,
    // Start with the month of the newest data, unless ?month= is given
    startMonth: 'latest'
};
