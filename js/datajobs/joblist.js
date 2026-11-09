import ViewHandler from '/SWAC/swac/ViewHandler.js';

/** Mount a job list into an empty container with its own unique id.
 * Call after SWAC has initialized the page (swac_components_complete).
 * fromName/fromWheres use the same sources and filters as a normal SWAC request.
 */
export async function createJobList(container, {
    fromName = 'datajobs',
    fromWheres = {},
    relations,
    loadRelations = loadJobRelations
} = {}) {
    if (!container || !container.id)
        throw new Error('Joblist requires a container with a unique id.');

    const response = await fetch(new URL('../../sites/datajobs/joblist.html', import.meta.url));
    if (!response.ok)
        throw new Error('Could not load joblist.html: ' + response.status);
    container.innerHTML = await response.text();

    const list = container.querySelector('[data-joblist="list"]');
    const history = container.querySelector('[data-joblist="history"]');
    const modal = container.querySelector('[data-joblist="history-modal"]');
    list.id = container.id + '_list';
    history.id = container.id + '_history';
    modal.id = container.id + '_history_modal';

    const where = Object.entries(fromWheres).map(([key, value]) => key + '=' + value).join(' AND ');
    list.setAttribute('swa', 'Present FROM ' + fromName
        + (where ? ' WHERE ' + where : '') + ' TEMPLATE table_for_all_datasets');

    window[history.id + '_options'] = {showWhenNoData: true};
    window[list.id + '_options'] = {
        plugins: new Map([
            ['TableFilter', {id: 'TableFilter', active: true}],
            ['TableSort', {id: 'TableSort', active: true}],
            ['TableHierarchy', {
                id: 'TableHierarchy',
                active: true,
                linear: true,
                ...(relations === undefined ? {loadRelations} : {relations})
            }],
            ['TableActions', {
                id: 'TableActions',
                active: true,
                actions: [
                    {
                        id: container.id + '_show',
                        icon: 'history',
                        get title() {
                            return window.swac.lang.getTranslationForId('job_show_histoy');
                        },
                        onClick: show
                    },
                    {
                        id: container.id + '_play',
                        icon: 'play',
                        get title() {
                            return window.swac.lang.getTranslationForId('job_start');
                        },
                        onClick: start
                    },
                    {
                        id: container.id + '_replay',
                        icon: 'refresh',
                        get title() {
                            return window.swac.lang.getTranslationForId('job_replay');
                        },
                        onClick: replay
                    },
                    {
                        id: container.id + '_stopJob',
                        icon: 'ban',
                        get title() {
                            return window.swac.lang.getTranslationForId('job_stop');
                        },
                        onClick: stopJob
                    }
                ]
            }]
        ])
    };

    // Initialize only this instance, leaving the rest of the page untouched.
    const handler = new ViewHandler();
    await handler.load(history);
    await handler.load(list);
    window.swac.lang.translateAll(container);
    return list.swac_comp;

    function show(record) {
        history.swac_comp.removeAllData();
        history.swac_comp.addDataFromReference(
            'ref://datajobs_log?storage=smartmonitoring&filter=datajob_id,eq,' + record.id + '&order=id,DESC'
        );
        UIkit.modal(modal).show();
    }
}

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

function start(record) {
    console.log('start:', record.set_json);
}

function replay(record) {
    console.log('replay:', record.set_json);
}

function stopJob(record) {
    console.log('stop:', record.set_json);
}
