/* F6.2: Layout placeholders only; no component loading or time synchronization. */
(() => {
    const panels = [
        {id: 'f6_map', title: '1. Karte', component: 'Worldmap2d', description: 'Hier wird die Karte mit den Messstandorten angezeigt.'},
        {id: 'f6_skyimages', title: '2. Wolkenbild-Viewer', component: 'Collage', description: 'Hier wird das Wolkenbild zum ausgewählten Zeitpunkt angezeigt.'},
        {id: 'f6_keogram', title: '3. Keogramm', component: 'Collage', description: 'Hier wird der zeitliche Verlauf der Wolkenbilder als Keogramm angezeigt.'},
        {id: 'f6_irradiance', title: '4. Einstrahlungsdiagramm', component: 'Charts', description: 'Hier wird der Verlauf der gemessenen Einstrahlung angezeigt.'}
    ];
    const container = document.getElementById('f6_evaluation_panels');
    for (const panel of panels) {
        const section = document.createElement('section');
        section.className = 'f6-panel uk-card uk-card-default uk-card-body';
        section.setAttribute('aria-labelledby', panel.id + '_heading');
        const heading = document.createElement('h2');
        heading.id = panel.id + '_heading';
        heading.className = 'uk-card-title';
        heading.textContent = panel.title;
        const placeholder = document.createElement('div');
        placeholder.id = panel.id;
        placeholder.className = 'f6-placeholder';
        const label = document.createElement('strong');
        label.textContent = 'Platzhalter: ' + panel.component;
        const description = document.createElement('p');
        description.textContent = panel.description;
        placeholder.append(label, description);
        section.append(heading, placeholder);
        container.appendChild(section);
    }
})();
