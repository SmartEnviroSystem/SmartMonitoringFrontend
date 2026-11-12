//construct list view when swac_component_complete event triggers
document.addEventListener('swac_components_complete', async () => {
    try {
        const {createJobList} = await import('./joblist.js');
        await createJobList(document.getElementById('all_jobs'), {fromName: 'datajobs'});
    } catch (error) {
        console.error('Could not initialize the job list.', error);
    }
}, {once: true});
