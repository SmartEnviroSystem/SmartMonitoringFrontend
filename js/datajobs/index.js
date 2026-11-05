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
                    title: 'Show Job History',
                    onClick: show
                },
                {
                    id: 'play',
                    icon: 'play',
                    title: 'Start Job',
                    onClick: start
                },
                {
                    id: 'replay',
                    icon: 'refresh',
                    title: 'Replay Job',
                    onClick: replay
                },
                {
                    id: 'stopJob',
                    icon: 'ban',
                    title: 'Stop Job',
                    onClick: stopJob
                },
            ]
        }
    );

function show(record) {
    console.log('show:', record.set_json);
}

function start(record) {
    console.log('start:', record.set_json);
}

function replay(record) {
    console.log('replay:', record.set_json);
}

function stopJob(record) {
    console.log('stop:', record.set_json);
}