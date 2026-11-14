/*
 * Description of satellite raster data (Meteosat SEVIRI channels) for the datamap.
 * Used when a raster collection is shown (see datamap_rastercollections in js/data/map.js).
 *
 * Visible and near infrared channels (VIS006, VIS008, HRV, IR_016) contain the
 * reflectance in percent: clouds are bright, ground is dark, at night all values are near 0.
 * Infrared and water vapour channels (IR_134, WV_062, WV_073) contain the brightness
 * temperature in Kelvin: high clouds and moist air are cold, ground is warm.
 * This works at day and night.
 */
var datadesc_raster = {
    VIS006: {
        txt_title: 'VIS006 - Sichtbar 0,6 µm (%)',
        txt_desc: 'Reflexion im sichtbaren Licht: {voc}. Wolken sind hell, nachts ist alles dunkel.',
        txt_uknw: 'unbekannt',
        col_uknw: '#808080',
        calcmode: 'gradient',
        values: {
            '0': {txt: 'Boden / Nacht', col: '#08306B'},
            '15': {txt: 'wenig Wolken', col: '#4292C6'},
            '30': {txt: 'Wolken', col: '#C6DBEF'},
            '50': {txt: 'dichte Wolken', col: '#FFFFFF'}
        }
    },
    VIS008: {
        txt_title: 'VIS008 - Nahes Infrarot 0,8 µm (%)',
        txt_desc: 'Reflexion im nahen Infrarot: {voc}. Wolken und Pflanzen sind hell.',
        txt_uknw: 'unbekannt',
        col_uknw: '#808080',
        calcmode: 'gradient',
        values: {
            '0': {txt: 'Boden / Nacht', col: '#08306B'},
            '20': {txt: 'Vegetation', col: '#4292C6'},
            '35': {txt: 'Wolken', col: '#C6DBEF'},
            '55': {txt: 'dichte Wolken', col: '#FFFFFF'}
        }
    },
    HRV: {
        txt_title: 'HRV - Sichtbar hochaufgelöst (%)',
        txt_desc: 'Reflexion im hochaufgelösten sichtbaren Kanal: {voc}.',
        txt_uknw: 'unbekannt',
        col_uknw: '#808080',
        calcmode: 'gradient',
        values: {
            '0': {txt: 'Boden / Nacht', col: '#08306B'},
            '15': {txt: 'wenig Wolken', col: '#4292C6'},
            '30': {txt: 'Wolken', col: '#C6DBEF'},
            '55': {txt: 'dichte Wolken', col: '#FFFFFF'}
        }
    },
    IR_016: {
        txt_title: 'IR_016 - Infrarot 1,6 µm (%)',
        txt_desc: 'Reflexion bei 1,6 µm: {voc}. Unterscheidet Wasser- und Eiswolken.',
        txt_uknw: 'unbekannt',
        col_uknw: '#808080',
        calcmode: 'gradient',
        values: {
            '0': {txt: 'Boden / Nacht', col: '#08306B'},
            '12': {txt: 'Eiswolken', col: '#4292C6'},
            '22': {txt: 'Wasserwolken', col: '#C6DBEF'},
            '35': {txt: 'dichte Wasserwolken', col: '#FFFFFF'}
        }
    },
    IR_134: {
        txt_title: 'IR_134 - Infrarot 13,4 µm (K)',
        txt_desc: 'Helligkeitstemperatur: {voc}. Kalt sind hohe Wolken, warm ist der Boden. Funktioniert auch nachts.',
        txt_uknw: 'unbekannt',
        col_uknw: '#808080',
        calcmode: 'gradient',
        values: {
            '225': {txt: 'sehr kalt, hohe Wolken', col: '#FFFFFF'},
            '240': {txt: 'kalt, Wolken', col: '#9ECAE1'},
            '252': {txt: 'mittel', col: '#3182BD'},
            '265': {txt: 'warm, wolkenfrei', col: '#08306B'}
        }
    },
    WV_062: {
        txt_title: 'WV_062 - Wasserdampf 6,2 µm (K)',
        txt_desc: 'Wasserdampf in der oberen Atmosphäre: {voc}. Kalt bedeutet feucht, warm bedeutet trocken.',
        txt_uknw: 'unbekannt',
        col_uknw: '#808080',
        calcmode: 'gradient',
        values: {
            '224': {txt: 'feucht', col: '#F7FBFF'},
            '230': {txt: 'mittel', col: '#6BAED6'},
            '238': {txt: 'trocken', col: '#8C510A'}
        }
    },
    WV_073: {
        txt_title: 'WV_073 - Wasserdampf 7,3 µm (K)',
        txt_desc: 'Wasserdampf in der mittleren Atmosphäre: {voc}. Kalt bedeutet feucht, warm bedeutet trocken.',
        txt_uknw: 'unbekannt',
        col_uknw: '#808080',
        calcmode: 'gradient',
        values: {
            '225': {txt: 'feucht', col: '#F7FBFF'},
            '242': {txt: 'mittel', col: '#6BAED6'},
            '256': {txt: 'trocken', col: '#8C510A'}
        }
    }
};
