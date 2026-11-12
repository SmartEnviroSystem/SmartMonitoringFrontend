import ViewHandler from '/SWAC/swac/ViewHandler.js';

/** Mount into an empty, uniquely named container after swac_components_complete.
 * The source supplies job definitions; SmartDataJobs supplies their live state.
 */
export async function createJobList(container, {
    fromName = 'datajobs',
    fromWheres = {},
    relations,
    loadRelations = loadJobRelations,
    apiBase = '/SmartDataJobs/smartdatajobs/jobexecution/',
    smartdataurl = '/SmartData',
    storage = 'smartmonitoring',
    collection = 'datajobs',
    refreshInterval = 5000
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
    const message = container.querySelector('[data-joblist="message"]');
    list.id = container.id + '_list';
    history.id = container.id + '_history';
    modal.id = container.id + '_history_modal';
    const where = Object.entries(fromWheres).map(([key, value]) => key + '=' + value).join(' AND ');
    list.setAttribute('swa', 'Present FROM ' + fromName + (where ? ' WHERE ' + where : ''));

    const states = new Map();
    const busy = new Set();
    let edges = relations || [];
    let view;
    let refreshPromise;
    let stateError = '';
    let logError = '';
    let actionError = '';
    const text = key => window.swac.lang.getTranslationForId(key) || key;
    const parents = id => [...new Set(edges.filter(edge => String(edge.childId) === String(id))
        .map(edge => String(edge.parentId)))];
    const current = record => states.get(String(record.id));
    const active = state => state === 'running' || state === 'waiting';

    function rootId(id) {
        id = String(id);
        const seen = new Set();
        while (!seen.has(id)) {
            seen.add(id);
            const previous = parents(id);
            if (!previous.length) return id;
            if (previous.length !== 1) return null;
            id = previous[0];
        }
        return null;
    }
    function chainActive(record) {
        const root = rootId(record.id);
        return root === null || [...busy].some(id => rootId(id) === root)
            || [...states].some(([id, info]) => active(info.state) && rootId(id) === root);
    }
    function canStart(record) {
        return !!current(record)?.state && !parents(record.id).length && !chainActive(record);
    }
    function canReplay(record) {
        const previous = parents(record.id);
        const parent = previous.length === 1 ? states.get(previous[0]) : null;
        // "stopped" alone also means never started or normally completed.
        return !!current(record)?.state && !!parent?.state && !active(parent.state)
            && parent.logCurrent && ['stopped', 'aborted', 'cancelled'].includes(resultState(parent.log))
            && !chainActive(record);
    }
    function canStop(record) {
        return current(record)?.state === 'running' && current(record)?.stoppable === true;
    }

    window[history.id + '_options'] = {showWhenNoData: true};
    window[list.id + '_options'] = {
        customAfterAddSet: () => queueMicrotask(() => { if (view) render(); }),
        plugins: new Map([
            ['TableFilter', {id: 'TableFilter', active: true}],
            ['TableSort', {id: 'TableSort', active: true}],
            ['TableHierarchy', {
                id: 'TableHierarchy', active: true, linear: true,
                ...(relations === undefined ? {loadRelations: async component => {
                    edges = await loadRelations(component, {collection, storage});
                    return edges;
                }} : {relations}),
                expandWhen: record => current(record)?.state === 'running'
            }],
            ['TableActions', {
                id: 'TableActions', active: true,
                actions: [
                    {
                        id: container.id + '_show', icon: 'history',
                        get title() { return text('job_show_histoy'); },
                        onClick: show
                    },
                    {
                        id: container.id + '_play', icon: 'play',
                        get title() { return text('job_start'); },
                        visible: record => !parents(record.id).length,
                        disabled: record => busy.has(String(record.id)) || !canStart(record),
                        onClick: record => execute('start', record, canStart)
                    },
                    {
                        id: container.id + '_replay', icon: 'refresh',
                        get title() { return text('job_replay'); },
                        visible: canReplay,
                        disabled: record => busy.has(String(record.id)),
                        onClick: record => execute('start', record, canReplay)
                    },
                    {
                        id: container.id + '_stopJob', icon: 'ban',
                        get title() { return text('job_stop'); },
                        visible: canStop,
                        disabled: record => busy.has(String(record.id)),
                        onClick: record => execute('stop', record, canStop)
                    }
                ]
            }]
        ])
    };

    const handler = new ViewHandler();
    await handler.load(history);
    await handler.load(list);
    view = list.swac_comp;

    window.swac.lang.translateAll(container);
    render();
    await refresh();
    // Poll only while this instance is attached; no global lifecycle changes.
    function poll() {
        if (refreshInterval > 0 && container.isConnected)
            setTimeout(async () => {
                if (!container.isConnected) return;
                await refresh();
                poll();
            }, refreshInterval);
    }
    poll();
    view.refreshJobStatus = refresh;
    return view;

    async function request(action, id) {
        const base = new URL(apiBase.endsWith('/') ? apiBase : apiBase + '/', window.location.href);
        const url = new URL(action, base);
        for (const [key, value] of Object.entries({smartdataurl, storage, collection, ...(id == null ? {} : {id})}))
            url.searchParams.set(key, value);
        const response = await fetch(url, {credentials: 'same-origin', cache: 'no-store'});
        const body = await response.json();
        if (!response.ok || body.errors?.length)
            throw new Error(body.errors?.join('; ') || 'HTTP ' + response.status);
        return body;
    }
    async function latestLog(id, runtime) {
        const hint = runtime.lastlog?.[0];
        if (hint && Object.hasOwn(hint, 'result')) return hint;
        const source = await window.swac.Model.load({
            fromName: collection + '_log',
            fromWheres: {storage, filter: 'datajob_id,eq,' + id, order: 'ts,DESC', size: 1},
            fromHeaders: view.options.fromHeaders,
            reloadInterval: refreshInterval > 0 ? refreshInterval : 1000
        });
        // Model returns a cached sparse source, potentially containing older logs.
        return source.getSets().filter(Boolean).reduce((latest, log) => {
            if (!latest) return log;
            const delta = Date.parse(log.ts) - Date.parse(latest.ts);
            return delta > 0 || (delta === 0 && Number(log.id) > Number(latest.id)) ? log : latest;
        }, null);
    }
    function refresh() {
        if (!refreshPromise)
            refreshPromise = refreshState().finally(() => { refreshPromise = null; });
        return refreshPromise;
    }
    async function refreshState() {
        stateError = '';
        logError = '';
        try {
            const body = await request('states');
            if (!Array.isArray(body.jobs) || body.jobs.some(job => job.error && job.id == null))
                throw new Error('Invalid SmartDataJobs states response.');

            // BEGIN DEBUG RESPONSE: remove this block after testing.
            const debugJob = {
                id: -1,
                name: '[DEBUG] Running job',
                state: 'running',
                stoppable: false,
                lastlog: [{result: '{"state":"finished"}', iserror: false, wastimeout: false}]
            };
            body.jobs.push(debugJob);
            // Names and table rows normally come from the separate definition source.
            if (!rows().some(row => row.swac_dataset.id === debugJob.id))
                view.addData(view.options.fromName, [{id: debugJob.id, name: debugJob.name}]);
            // END DEBUG RESPONSE

            const runtime = new Map(body.jobs.map(job => [String(job.id), job]));
            const needed = new Set(rows().map(row => String(row.swac_dataset.id)));
            for (const id of [...needed]) for (const parent of parents(id)) needed.add(parent);
            const next = new Map([...runtime].map(([id, job]) => [id, {
                state: typeof job.state === 'string' ? job.state : null,
                stoppable: job.stoppable === true, log: null, logCurrent: false
            }]));
            await Promise.all([...needed].map(async id => {
                if (!runtime.has(id)) return;
                try {
                    const log = await latestLog(id, runtime.get(id));
                    const timestamp = runtime.get(id).lastlog?.[0]?.ts;
                    Object.assign(next.get(id), {log, logCurrent: !!log
                        && (!timestamp || Date.parse(timestamp) === Date.parse(log.ts))});
                } catch (error) {
                    logError = text('job_logs_unavailable');
                    console.error('Joblist: latest result could not be loaded.', error);
                }
            }));
            states.clear();
            for (const [id, info] of next) states.set(id, info);
        } catch (error) {
            states.clear();
            stateError = text('job_states_unavailable');
            console.error('Joblist: live states could not be loaded.', error);
        }
        render();
    }
    function rows() {
        return [...list.querySelectorAll('tr.swac_repeatedForSet')].filter(row => row.swac_dataset);
    }
    function render() {
        for (const th of list.querySelectorAll('th[data-job-column]')) {
            // Preserve TableFilter's input and its original attribute key.
            const node = th.firstChild;
            if (node?.nodeType === 3) node.nodeValue = text('job_column_' + th.getAttribute('data-job-column').replace(/^job_/, ''));
        }
        const actionHeader = list.querySelector('.swac_tableactions_header');
        if (actionHeader) actionHeader.textContent = text('job_column_actions');
        for (const row of rows()) {
            const info = current(row.swac_dataset);
            row.querySelector('[attrname="job_status"]').textContent = info?.state || '—';
            row.querySelector('[attrname="job_last_result"]').textContent = lastOutcome(info?.log);
            // The current API has no execution duration. Never derive it from log gaps.
            row.querySelector('[attrname="job_last_duration"]').textContent = '—';
            row.querySelector('[data-job-running]').hidden = info?.state !== 'running';
        }
        view.getPlugin('TableHierarchy').swac_comp.render();
        view.getPlugin('TableActions').swac_comp.refresh();
        message.textContent = [stateError, logError, actionError].filter(Boolean).join(' ');
        message.hidden = !message.textContent;
    }
    async function execute(action, record, allowed) {
        const id = String(record.id);
        if (busy.has(id) || !allowed(record)) return;
        busy.add(id);
        actionError = '';
        render();
        try {
            await request(action, id);
            if (refreshPromise) await refreshPromise;
            await refresh();
        } catch (error) {
            actionError = text('job_action_failed') + ' ' + error.message;
        } finally {
            busy.delete(id);
            render();
        }
    }
    function show(record) {
        history.swac_comp.removeAllData();
        const params = new URLSearchParams({storage, filter: 'datajob_id,eq,' + record.id, order: 'id,DESC'});
        history.swac_comp.addDataFromReference('ref://' + collection + '_log?' + params)
            .catch(error => { actionError = text('job_action_failed') + ' ' + error.message; render(); });
        UIkit.modal(modal).show();
    }
}

function resultState(log) {
    let result = log?.result;
    if (typeof result === 'string') {
        try { result = JSON.parse(result); } catch { return result.toLowerCase(); }
    }
    return typeof result?.state === 'string' ? result.state.toLowerCase() : null;
}

function lastOutcome(log) {
    if (!log) return '—';
    const yes = value => value === true || value === 'true' || value === 1;
    const no = value => value === false || value === 'false' || value === 0;
    if (yes(log.iserror) || yes(log.wastimeout)
            || ['failed', 'error', 'stopped', 'aborted', 'cancelled'].includes(resultState(log))) return 'failed';
    if (['finished', 'ok', 'success'].includes(resultState(log))
            || (no(log.iserror) && no(log.wastimeout))) return 'ok';
    return '—';
}

async function loadJobRelations(view, {collection, storage}) {
    const source = await window.swac.Model.load({
        fromName: collection + '_chain',
        fromWheres: {storage, filter: 'active,eq,true'},
        fromHeaders: view.options.fromHeaders
    });
    return source.getSets()
        .filter(link => link && (link.active === true || link.active === 'true' || link.active === 1))
        .map(link => ({parentId: link.pre_job_id, childId: link.post_job_id}));
}
