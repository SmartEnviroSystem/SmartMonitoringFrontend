window['all_jobs_options'] = {
    plugins: new Map()
};

window['all_jobs_options'].plugins.set('TableFilter', {
    id: 'TableFilter',
    active: true
});
window['all_jobs_options'].plugins.set('TableSort', {
    id: 'TableSort',
    active: true
});

// Load dependencies separately; Present still receives the original job records.
window['all_jobs_options'].plugins.set('TableHierarchy', {
    id: 'TableHierarchy',
    active: true,
    linear: true,
    loadRelations: loadJobRelations
});

async function loadJobRelations(view) {
    const source = await window.swac.Model.load({
        fromName: 'datajobs_chain',
        fromWheres: {filter: 'active,eq,true'},
        fromHeaders: view.options.fromHeaders
    });
    return source.getSets()
        .filter(link => link && (link.active === true || link.active === 'true' || link.active === 1))
        .map(link => ({parentId: link.pre_job_id, childId: link.post_job_id}));
}

window['all_jobs_options'].plugins.set('TableActions', {
            id: 'TableActions',
            active: true,
            actions: [
                {
                    id: 'show',
                    icon: 'history',
                    get title() {
                        return window.swac.lang.getTranslationForId('job_show_histoy');
                    },
                    onClick: show
                },
                {
                    id: 'play',
                    icon: 'play',
                    get title() {
                        return window.swac.lang.getTranslationForId('job_start');
                    },
                    onClick: start
                },
                {
                    id: 'replay',
                    icon: 'refresh',
                    get title() {
                        return window.swac.lang.getTranslationForId('job_replay');
                    },
                    onClick: replay
                },
                {
                    id: 'stopJob',
                    icon: 'ban',
                    get title() {
                        return window.swac.lang.getTranslationForId('job_stop');
                    },
                    onClick: stopJob
                },
            ]
        }
    );

function start(record) {
    console.log('start:', record.set_json);
}

function replay(record) {
    console.log('replay:', record.set_json);
}

function stopJob(record) {
    console.log('stop:', record.set_json);
}

window['jobhistory_options'] = {
    showWhenNoData: true
};

function show(record) {
    let job = record && record.set_json ? record.set_json : record;
    if (typeof job === 'string') job = JSON.parse(job);

    document.getElementById('jobhistory').swac_comp.addDataFromReference(
        'ref://datajobs_log?storage=smartmonitoring&filter=datajob_id,eq,' + job.id + '&order=id,DESC'
    );
    UIkit.modal('#jobhistory_modal').show();
}
