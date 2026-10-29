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

window['all_jobs_options'].plugins.set('TableActions', {
            id: 'TableActions',
            active: true,
            actions: [
                {
                    id: 'show',
                    icon: 'search',
                    title: 'Datensatz anzeigen',
                    onClick: show
                }
            ]
        }
    );

function show(id) {
    console.log('Datensatz:', id);
}