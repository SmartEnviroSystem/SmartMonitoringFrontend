var misschart_options = {
    viewSetAttributes: 'missingentries,availableentries',
    xAxisAttrName: 'name',
    yAxis1AttrName: 'value',
    datadescription: '#misschart_legend'
};
misschart_options.plugins = new Map();
misschart_options.plugins.set('Piechart', {
    id: 'Piechart',
    active: true
});

// Options defining WHAT is visualised
var misschart_legend_options = {
    visuAttribute: 'name',
    showLegend: false
};
// Data defining HOW is visualised
misschart_legend_data = {};
misschart_legend_data.name = {};
misschart_legend_data.name.txt_title = 'Data attribute name';
misschart_legend_data.name.txt_desc = 'The name of the data';
misschart_legend_data.name.txt_uknw = 'Unkown value';
misschart_legend_data.name.values = {};
misschart_legend_data.name.values['missingentries'] = {};
misschart_legend_data.name.values['missingentries'].txt = 'Fehlende';
misschart_legend_data.name.values['missingentries'].col = 'red';
misschart_legend_data.name.values['availableentries'] = {};
misschart_legend_data.name.values['availableentries'].txt = 'Vorhandene';
misschart_legend_data.name.values['availableentries'].col = 'green';

// Device and period, see SWAC component Dataselect
var missing_source_options = {
    showPeriod: true,
    showAttribute: false
};

// The list reads device and period from the URL, so the page is reloaded with them
document.addEventListener('submit', function (evt) {
    if (evt.target.id !== 'missing_form')
        return;
    evt.preventDefault();
    let comp = document.getElementById('missing_source').swac_comp;
    let selection = comp ? comp.getSelection() : null;
    if (!selection)
        return;
    window.location.search = new URLSearchParams({
        oo_id: selection.id,
        data_collection: selection.collection,
        measurerate: selection.set.measurerate,
        start: selection.from,
        end: selection.to
    }).toString();
});
