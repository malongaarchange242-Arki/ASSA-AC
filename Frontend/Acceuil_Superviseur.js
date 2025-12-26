document.addEventListener('DOMContentLoaded', () => {

    // 1. THEME TOGGLE
    const toggle = document.getElementById('toggleTheme');
    const themeIcon = toggle.querySelector('i');

    const updateThemeUI = (isDark) => {
        document.body.classList.toggle('dark-mode', isDark);
        themeIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    };

    if (localStorage.getItem('theme') === 'dark') updateThemeUI(true);

    toggle.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeUI(isDark);
    });

    // 2. ANIMATION DES COMPTEURS
    const counters = document.querySelectorAll('.stat-value');
    counters.forEach(counter => {
        const target = +counter.getAttribute('data-target');
        const duration = 1000;
        const increment = target / (duration / 16);
        let current = 0;

        const update = () => {
            current += increment;
            if (current < target) {
                counter.innerText = Math.ceil(current).toLocaleString();
                requestAnimationFrame(update);
            } else {
                counter.innerText = target.toLocaleString();
            }
        };
        update();
    });

    // 3. PANNEAU DE DÉTAILS
    const detailPanel = document.getElementById('detailPanel');
    const closeDetail = document.getElementById('closeDetail');
    const rows = document.querySelectorAll('.ops-table tbody tr');

    rows.forEach(row => {
        row.addEventListener('click', () => {
            const cells = row.querySelectorAll('td');
            document.getElementById('det-agent').innerText = cells[0].innerText;
            document.getElementById('det-action').innerText = cells[1].innerText;
            document.getElementById('det-id').innerText = cells[2].innerText;
            document.getElementById('det-date').innerText = cells[3].innerText;
            detailPanel.classList.add('open');
        });
    });

    closeDetail.addEventListener('click', () => {
        detailPanel.classList.remove('open');
    });
});
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname.split("/").pop();
    const navLinks = document.querySelectorAll('.nav a');

    navLinks.forEach(link => {
        // On retire la classe active partout
        link.parentElement.classList.remove('active');

        // Si le href du lien correspond au nom du fichier actuel
        if (link.getAttribute('href') === currentPath) {
            link.parentElement.classList.add('active');
        }
    });
});