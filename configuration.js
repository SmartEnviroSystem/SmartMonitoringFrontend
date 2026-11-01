/* 
 * This is the main configuration file for SmartMonitoring Frontend.
 * 
 * You should only change values in these file for your setup. No need to
 * modify other files.
 */
var baseurl = window.location.protocol + "//" + window.location.host;
var SmartMonitoring = {
    version: '3.0 dev'
};

var SWAC_config = {
    lang: 'de',
    notifyDuration: 5000,
    debugmode: true,
    debug: '',
    globalparams: {
        baseurl: baseurl,
        smartdataurlnenc: baseurl + '/SmartData',
        smartdataurl: encodeURIComponent(baseurl) + '%2FSmartData',
        measurefreq: 10,
        data_collection: '[DATA_COLLECTION]'
    },
    globalattributeorder: null,
    startuptests: [
    ],
    datasources: [
        {
            url: "/SmartData/smartdata/[iface]/[fromName]?storage=smartmonitoring",
            interfaces: {
                get: ['GET', 'records'],
                list: ['GET', 'records'],
                defs: ['GET', 'collection'],
                cdefs: ['POST', 'collection'],
                create: ['POST', 'records'],
                update: ['PUT', 'records'],
                delete: ['DELETE', 'records']
            },
            exclude: ['getCollections']
        },
        {
            url: "/SmartMonitoringFrontend/data/[fromName]"
        }
        
// @deprecated Configuration for useing SmartMonitoringBackend
//            exclude: ['observedobject/create', 'listParents', 'listChilds', 'listForObservedObject']
//        },
//        {
//            url: "/SmartMonitoringBackend/smartmonitoring/[fromName]",
//            interfaces: {
//                get: ['GET', 'get'],
//                list: ['GET', 'list'],
//                defs: ["GET", 'definition'],
//                create: ['POST', 'create'],
//                update: ['UPDATE', 'update'],
//                delete: ['DELETE', 'delete']
//            }
//        }
    ],
    progressive: {
        active: false
    },
    onlinereactions: [
//    {
//      path: SWAC_config.swac_root + '/swac/components/Upload/UploadOnReact.js',
//      config: {}
//    }
    ]
};

/**
 * Options for swac_user component
 * Used on every page
 */
var userform_options = {
    loginURL: '/SmartUser/smartuser/user/performLogin',
    afterLogoutLoc: '/index.html',
    accountURL: '/sites/user/account.html',
    activeOn: {
        fromName: 'tbl_systemconfiguration', // Name of the datatable
        fromWheres: {
            filter: 'ckey,eq,func_userlogin&filter=active,eq,true'
        }
    }
};
//user_options.loggedinRedirects = new Map();
//user_options.loggedinRedirects.set('user_example3.html','../sites/user_example2.html');

// Links for footer navigation
var footerlinks = [
    {id: 1, rfrom: "*", rto: "about/privacy.html", name: "Datenschutzerklärung"},
    {id: 2, rfrom: "*", rto: "about/imprint.html", name: "Impressum"},
    {id: 3, rfrom: "*", rto: "about/system.html", name: "SmartMonitoring"}
];

// Options for favourites
window['favs_options'] = {
    showFavIcon: true,
    showFavList: false,
    showHistList: false,
    activeOn: {
        fromName: 'tbl_systemconfiguration', // Name of the datatable
        fromWheres: {
            filter: 'ckey,eq,func_userfavs&filter=active,eq,true'
        }
    }
};