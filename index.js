/*
 * Script for login page
 */
var swac_login_options = {
    mode: 'form',
    loginURL: '/SmartUser/smartuser/user/performLogin',
    afterLoginLoc: '/sites/object/dashboard.html',
    afterLogoutLoc: '/index.html',
    loggedinRedirects: new Map(),
    activeOn: {
        fromName: 'tbl_systemconfiguration', // Name of the datatable
        fromWheres: {
            filter: 'ckey,eq,func_userlogin&filter=active,eq,true'
        }
    }
};
swac_login_options.loggedinRedirects.set('', '/sites/object/dashboard.html');
swac_login_options.loggedinRedirects.set('index.html', '/sites/object/dashboard.html');

var screenboard_options = {
    for : ['[name="swac_user_username"]', '[name="swac_user_password"]'],
    activeOn: {
        fromName: 'tbl_systemconfiguration', // Name of the datatable
        fromWheres: {
            filter: 'ckey,eq,func_userlogin&filter=active,eq,true'
        }
    }
};

/*
 * Redirect to device page
 */
document.addEventListener('swac_login_device_select',function(e) {
    if(e.detail.value && e.detail.value!=='') {
        window.location = '/sites/device/index.html?oo_id=' +e.detail.value;
    }
});

// Wait for swac reaction system to be ready
document.addEventListener('swac_ready', function () {
    // Register reaction to the compoenents "selectobject" and "chart"
    window.swac.reactions.addReaction(function (requestors) {
        let user = requestors['loginform'];
        let screenboard = requestors['screenboard'];
        screenboard.swac_comp.options.specialButtons[0] = {
            key: 'icon: sign-in',
            func: user.swac_comp.performLogin
        };
    }, "loginform", "screenboard");

    // Check if base tables are installed
    // Get the model
    let Model = window.swac.Model;
    Model.load({
        fromName: 'tbl_observedobject'
    }).then(function (data) {
        
    }).catch(function (err) {
        //window.location = 'sites/admin/setup.html';
    });
    
    // Register function to react on user clicking "device" button
    let devBtn = document.querySelector('.login_device');
    devBtn.addEventListener('click',function() {
        let devElem = document.querySelector('[name="login_device"]');
        window.location = '/sites/device/index.html?oo_id=' +devElem.value;
    });
    // Register function to react on user clicking "no device" button
    let noDevBtn = document.querySelector('.login_nodevice');
    noDevBtn.addEventListener('click',function() {
        window.location = '/sites/object/dashboard.html';
    });
});

document.addEventListener('swac_loginform_inactive', function () {
    // Redirect to dashboard
//    window.location.href = 'sites/object/dashboard.html';
});

document.addEventListener('swac_msg', function (evt) {
    if (evt.detail.level === 'error' && evt.detail.msg.includes('No datasource found for')) {
        let tableName = evt.detail.msg.replace('SWAC(model): No datasource found for >', '').replace('<', '');
        if (tableName === 'tbl_systemconfiguration') {
            UIkit.modal.alert(window.swac.lang.dict.core.loaderror).then(function () {
                window.location = window.location += '?clearstates=true';
            });
        }
    }
});