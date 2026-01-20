/* aside.js - script autonome pour l'aside
   Place <div id="aside-overlay"></div> et <aside id="facture-aside"></aside> dans ta page.
   Inclure <link rel="stylesheet" href="aside.css"> et <script src="aside.js"></script>.
   Appelle window.openAside() pour ouvrir le panneau.
*/

(function () {
    const OVERLAY_ID = 'aside-overlay';
    const ASIDE_ID = 'facture-aside';
    const FRAGMENT_URL = 'aside.html';

    // Expose global pour appel depuis HTML
    window.openAside = openAside;
    window.closeAside = closeAside;

    // Ouvre l'aside : charge aside.html, injecte, initialise comportements
    async function openAside() {
        let overlay = document.getElementById(OVERLAY_ID);
        let aside = document.getElementById(ASIDE_ID);

        // créer overlay/aside si absent (pratique pour intégration rapide)
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = OVERLAY_ID;
            document.body.appendChild(overlay);
        }
        if (!aside) {
            aside = document.createElement('aside');
            aside.id = ASIDE_ID;
            document.body.appendChild(aside);
        }

        overlay.classList.add('active');
        aside.classList.add('open');
        overlay.style.display = 'flex';

        // Indicateur de chargement
        aside.innerHTML = '<div style="padding:16px;">Chargement…</div>';

        try {
            const res = await fetch(FRAGMENT_URL, { cache: 'no-store' });
            if (!res.ok) throw new Error('Erreur HTTP ' + res.status);
            const html = await res.text();

            // Parser et insérer le fragment (sans exécuter de scripts)
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            aside.innerHTML = '';
            Array.from(doc.body.childNodes).forEach(n => aside.appendChild(document.importNode(n, true)));

            // Attacher listeners de fermeture
            attachCloseHandlers(overlay, aside);

            // Initialiser logique formulaire (ajout lignes, totaux, preview)
            initAsideLogic(aside);

        } catch (err) {
            console.error('Erreur chargement aside:', err);
            aside.innerHTML = '<div style="padding:16px;color:#b00000;">Impossible de charger le formulaire.</div>';
            attachCloseHandlers(overlay, aside);
        }
    }

    function attachCloseHandlers(overlay, aside) {
        // clic overlay ferme
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeAside();
        }, { once: false });

        // bouton close
        const closeBtn = aside.querySelector('#closeAside');
        if (closeBtn) closeBtn.addEventListener('click', closeAside);

        // ESC ferme
        document.addEventListener('keydown', escHandler);
    }

    function escHandler(e) {
        if (e.key === 'Escape') closeAside();
    }

    function closeAside() {
        const overlay = document.getElementById(OVERLAY_ID);
        const aside = document.getElementById(ASIDE_ID);
        if (aside) aside.classList.remove('open');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.style.display = 'none';
        }
        // cleanup listeners
        document.removeEventListener('keydown', escHandler);
    }

    /* ---------- logique formulaire (ajout lignes, totaux, preview) ---------- */

    function initAsideLogic(aside) {
        // Générer n° facture si champ présent
        const invoiceInput = aside.querySelector('#aside-invoice-number') || aside.querySelector('[name="invoiceNumber"]');
        if (invoiceInput && !invoiceInput.value) invoiceInput.value = generateInvoiceNumber();

        // bouton ajouter ligne
        const addBtn = aside.querySelector('#aside-add-item');
        if (addBtn) addBtn.addEventListener('click', () => addItemRow(aside));

        // initialiser une ligne si aucune
        const itemsContainer = aside.querySelector('#aside-items');
        if (itemsContainer && itemsContainer.children.length === 0) addItemRow(aside);

        // form submit (exemple : envoi au backend)
        const form = aside.querySelector('#invoiceForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                // ici tu peux récupérer les données et appeler ton API
                // const data = serializeForm(aside);
                // fetch('/api/invoices', { method:'POST', body: JSON.stringify(data) })
                closeAside();
            });
        }

        // sauvegarde brouillon
        const saveDraft = aside.querySelector('#aside-save-draft');
        if (saveDraft) saveDraft.addEventListener('click', () => {
            const data = serializeForm(aside);
            try {
                localStorage.setItem('asideInvoiceDraft', JSON.stringify(data));
                saveDraft.textContent = 'Brouillon enregistré';
                setTimeout(() => saveDraft.textContent = 'Enregistrer brouillon', 1400);
            } catch (e) { console.error(e); }
        });

        // preview : expose global showPreview si tu veux l'appeler
        window.showAsidePreview = function () { showPreview(aside); };

        // charger brouillon si présent
        const draft = localStorage.getItem('asideInvoiceDraft');
        if (draft) populateFormFromData(aside, JSON.parse(draft));

        // calcul initial des totaux
        updateTotals(aside);
    }

    function generateInvoiceNumber() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `FAC-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    }

    // Ajoute une ligne dans l'aside (container trouvé dans aside)
    function addItemRow(aside) {
        const container = (aside || document).querySelector('#aside-items');
        if (!container) return;

        const idx = container.children.length + 1;
        const row = document.createElement('div');
        row.className = 'item-row';

        // index
        const idxEl = document.createElement('div');
        idxEl.className = 'index';
        idxEl.textContent = idx;
        row.appendChild(idxEl);

        // description
        const desc = document.createElement('input');
        desc.type = 'text';
        desc.name = 'description[]';
        desc.placeholder = 'Description';
        desc.addEventListener('input', () => updateTotals(aside));
        const descWrap = document.createElement('div');
        descWrap.appendChild(desc);
        row.appendChild(descWrap);

        // quantity
        const qty = document.createElement('input');
        qty.type = 'number';
        qty.name = 'quantity[]';
        qty.min = '0';
        qty.value = '1';
        qty.addEventListener('input', () => updateTotals(aside));
        row.appendChild(qty);

        // zone
        const zone = document.createElement('input');
        zone.type = 'text';
        zone.name = 'zone[]';
        zone.placeholder = 'Zone';
        row.appendChild(zone);

        // price
        const price = document.createElement('input');
        price.type = 'number';
        price.name = 'price[]';
        price.min = '0';
        price.step = '0.01';
        price.value = '0';
        price.addEventListener('input', () => updateTotals(aside));
        row.appendChild(price);

        // delete
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn-delete';
        del.textContent = 'Suppr.';
        del.addEventListener('click', () => {
            row.remove();
            refreshIndexes(container);
            updateTotals(aside);
        });
        row.appendChild(del);

        container.appendChild(row);
        desc.focus();
        updateTotals(aside);
    }

    function refreshIndexes(container) {
        Array.from(container.children).forEach((r, i) => {
            const idxEl = r.querySelector('.index');
            if (idxEl) idxEl.textContent = i + 1;
        });
    }

    function updateTotals(aside) {
        const container = (aside || document).querySelector('#aside-items');
        const totalEl = (aside || document).querySelector('#aside-grand-total');
        const wordsEl = (aside || document).querySelector('#aside-total-words');
        if (!container || !totalEl) return;

        let grand = 0;
        Array.from(container.children).forEach(r => {
            const q = Number(r.querySelector('input[name="quantity[]"]')?.value || 0);
            const p = Number(r.querySelector('input[name="price[]"]')?.value || 0);
            const line = Math.max(0, q * p);
            grand += line;
        });

        totalEl.textContent = formatCurrency(grand) + ' Frs CFA';
        if (wordsEl) wordsEl.textContent = numberToWords(Math.round(grand)) + ' francs CFA';
    }

    function formatCurrency(n) {
        return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
    }

    // simple conversion en texte (pour affichage seulement)
    function numberToWords(n) {
        if (n === 0) return 'zéro';
        if (n < 0) return 'moins ' + numberToWords(-n);
        const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
        function underHundred(num) {
            if (num < 17) return units[num];
            if (num < 20) return 'dix-' + units[num - 10];
            if (num < 70) {
                const ten = Math.floor(num / 10);
                const unit = num % 10;
                return (['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'][ten]) + (unit ? (unit === 1 ? '-et-un' : '-' + units[unit]) : '');
            }
            if (num < 80) return 'soixante-' + underHundred(num - 60);
            return 'quatre-vingt' + (num === 80 ? '' : '-' + underHundred(num - 80));
        }
        function underThousand(num) {
            if (num < 100) return underHundred(num);
            const h = Math.floor(num / 100);
            const rest = num % 100;
            return (h === 1 ? 'cent' : units[h] + ' cent') + (rest ? ' ' + underHundred(rest) : (h > 1 ? 's' : ''));
        }
        const parts = [];
        const millions = Math.floor(n / 1000000);
        if (millions) { parts.push((millions === 1 ? 'un million' : numberToWords(millions) + ' millions')); n = n % 1000000; }
        const thousands = Math.floor(n / 1000);
        if (thousands) { parts.push((thousands === 1 ? 'mille' : underThousand(thousands) + ' mille')); n = n % 1000; }
        if (n) parts.push(underThousand(n));
        return parts.join(' ').trim();
    }

    function serializeForm(aside) {
        const data = {};
        const form = aside.querySelector('#invoiceForm');
        if (!form) return data;
        data.invoiceNumber = form.querySelector('[name="invoiceNumber"]')?.value || '';
        data.date = form.querySelector('[name="date"]')?.value || '';
        data.client = form.querySelector('[name="client"]')?.value || '';
        data.items = Array.from(aside.querySelectorAll('.item-row')).map(r => ({
            description: r.querySelector('input[name="description[]"]')?.value || '',
            quantity: Number(r.querySelector('input[name="quantity[]"]')?.value || 0),
            zone: r.querySelector('input[name="zone[]"]')?.value || '',
            price: Number(r.querySelector('input[name="price[]"]')?.value || 0)
        }));
        return data;
    }

    function populateFormFromData(aside, data) {
        if (!data) return;
        const form = aside.querySelector('#invoiceForm');
        if (!form) return;
        form.querySelector('[name="invoiceNumber"]')?.value = data.invoiceNumber || '';
        form.querySelector('[name="date"]')?.value = data.date || '';
        form.querySelector('[name="client"]')?.value = data.client || '';
        const container = aside.querySelector('#aside-items');
        if (!container) return;
        container.innerHTML = '';
        (data.items || []).forEach(item => {
            addItemRow(aside);
            const last = container.lastElementChild;
            if (!last) return;
            last.querySelector('input[name="description[]"]').value = item.description || '';
            last.querySelector('input[name="quantity[]"]').value = item.quantity ?? 1;
            last.querySelector('input[name="zone[]"]').value = item.zone || '';
            last.querySelector('input[name="price[]"]').value = item.price ?? 0;
        });
        updateTotals(aside);
    }

    // Aperçu simple : ouvre une modal native (créée à la volée)
    function showPreview(aside) {
        aside = aside || document.getElementById(ASIDE_ID);
        if (!aside) return;
        const data = serializeForm(aside);

        // construire HTML
        const rows = data.items.map(it => `
      <tr>
        <td style="padding:6px;border:1px solid #ddd;">${escapeHtml(it.description)}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:center;">${it.quantity}</td>
        <td style="padding:6px;border:1px solid #ddd;">${escapeHtml(it.zone)}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right;">${formatCurrency(it.quantity * it.price)} Frs</td>
      </tr>`).join('');

        const html = `
      <div style="background:#fff;padding:18px;border-radius:8px;max-width:900px;margin:40px auto;">
        <h3>Facture ${escapeHtml(data.invoiceNumber)}</h3>
        <div style="margin-bottom:12px;">Client: ${escapeHtml(data.client)} — Date: ${escapeHtml(data.date)}</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
          <thead>
            <tr>
              <th style="padding:6px;border:1px solid #ddd;">Désignation</th>
              <th style="padding:6px;border:1px solid #ddd;">Quantité</th>
              <th style="padding:6px;border:1px solid #ddd;">Zone</th>
              <th style="padding:6px;border:1px solid #ddd;">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="text-align:right;font-weight:700;">TOTAL : ${formatCurrency(data.items.reduce((s, i) => s + (i.quantity * i.price), 0))} Frs</div>
        <div style="text-align:right;margin-top:12px;"><button id="aside-preview-close" class="btn">Fermer</button></div>
      </div>`;

        // créer modal
        let modal = document.getElementById('aside-preview-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'aside-preview-modal';
            modal.style.position = 'fixed';
            modal.style.inset = '0';
            modal.style.background = 'rgba(0,0,0,0.5)';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.zIndex = '10000';
            document.body.appendChild(modal);
        }
        modal.innerHTML = html;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hidePreviewModal();
        });
        const closeBtn = modal.querySelector('#aside-preview-close');
        if (closeBtn) closeBtn.addEventListener('click', hidePreviewModal);
    }

    function hidePreviewModal() {
        const modal = document.getElementById('aside-preview-modal');
        if (modal) modal.remove();
    }

    function escapeHtml(s) {
        if (!s) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

})();
