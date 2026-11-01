// Simple operator-specific facture frontend script
const API_URL = "https://assa-ac-api.onrender.com";
const token = localStorage.getItem('jwtTokenOperateur');

const role = (
  localStorage.getItem('userRole') ||
  localStorage.getItem('role') ||
  localStorage.getItem('userRoleOperateur') ||
  ''
).trim().toLocaleLowerCase('fr-FR');
const operateurId = localStorage.getItem('operateurId');
const highlightDisputedInvoices = new URLSearchParams(window.location.search).get('highlight') === 'disputed';
const operatorRoles = ['operateur', 'opérateur', 'operator'];
if (!token || (role && !operatorRoles.includes(role))) {
  alert('Accès réservé aux Opérateurs');
  window.location.href = 'Index.html';
}

let FACTURES = [];
let FACTURES_FILTREES = [];
const FACTURES_PAR_PAGE = 10;
let pageFactures = 1;

document.addEventListener('DOMContentLoaded', () => {
  initialiserMenuMobile();
  document.getElementById('filter-month')?.addEventListener('change', appliquerFiltres);
  document.getElementById('filter-company')?.addEventListener('change', appliquerFiltres);
  document.getElementById('filter-statut')?.addEventListener('change', appliquerFiltres);
  chargerFactures();
});

function initialiserMenuMobile() {
  const sidebar = document.getElementById('sidebar');
  const openButton = document.getElementById('open-sidebar-btn');
  const closeButton = document.getElementById('close-sidebar-btn');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar || !openButton || !closeButton || !backdrop) return;

  function setSidebarOpen(isOpen) {
    document.body.classList.toggle('sidebar-open', isOpen);
    openButton.setAttribute('aria-expanded', String(isOpen));
  }

  openButton.addEventListener('click', () => setSidebarOpen(true));
  closeButton.addEventListener('click', () => setSidebarOpen(false));
  backdrop.addEventListener('click', () => setSidebarOpen(false));
  sidebar.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => setSidebarOpen(false));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setSidebarOpen(false);
  });
  window.matchMedia('(min-width: 1024px)').addEventListener('change', event => {
    if (event.matches) setSidebarOpen(false);
  });
}

async function chargerFactures() {
  const tbody = document.getElementById('factureTableBody');
  if (!tbody) return;
  tbody.setAttribute('aria-busy', 'true');

  try {
    const res = await fetch(`${API_URL}/api/factures`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Operateur-Id': operateurId || '' }
    });
    if (!res.ok) throw new Error('Erreur chargement');
    const data = await res.json();
    FACTURES = Array.isArray(data) ? data : data.factures || [];
    remplirFiltres();
    pageFactures = 1;
    if (highlightDisputedInvoices) {
      document.getElementById('filter-statut').value = 'contestée';
    }
    appliquerFiltres();
    if (highlightDisputedInvoices) {
      document.querySelector('.invoice-disputed.animate-disputed')?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center'
      });
    }
  } catch (err) {
    console.error('Erreur de chargement des factures opérateur :', err);
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.className = 'table-message';
    cell.textContent = 'Impossible de charger les factures. ';
    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.textContent = 'Réessayer';
    retryButton.addEventListener('click', chargerFactures);
    cell.appendChild(retryButton);
    row.appendChild(cell);
    tbody.replaceChildren(row);
    document.getElementById('facture-pagination')?.replaceChildren();
  } finally {
    tbody.setAttribute('aria-busy', 'false');
  }
}

function normaliserValeurFacture(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('fr-FR');
}

function obtenirMoisFacture(value) {
  const dateValue = String(value || '').trim();
  const isoMatch = dateValue.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

  const frenchMatch = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (frenchMatch) return `${frenchMatch[3]}-${frenchMatch[2].padStart(2, '0')}`;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function remplirFiltres() {
  const monthFilter = document.getElementById('filter-month');
  const companyFilter = document.getElementById('filter-company');
  if (!monthFilter || !companyFilter) return;

  const selectedMonth = monthFilter.value;
  const months = [...new Set(FACTURES
    .map(facture => obtenirMoisFacture(facture.date_emission || facture.date))
    .filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));
  monthFilter.replaceChildren(new Option('Par mois', ''));
  months.forEach(month => {
    const [year, monthNumber] = month.split('-').map(Number);
    const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
      .format(new Date(year, monthNumber - 1, 1));
    monthFilter.add(new Option(label, month));
  });
  if (months.includes(selectedMonth)) monthFilter.value = selectedMonth;

  const selectedCompany = companyFilter.value;
  const companies = [...new Set(FACTURES
    .map(facture => String(facture.client || facture.company_name || '').trim())
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'fr'));
  companyFilter.replaceChildren(new Option('Toutes compagnies', ''));
  companies.forEach(company => companyFilter.add(new Option(company, company)));
  if (companies.includes(selectedCompany)) companyFilter.value = selectedCompany;
}

function appliquerRecherche() {
  appliquerFiltres();
}

function appliquerFiltres() {
  const month = document.getElementById('filter-month')?.value || '';
  const company = document.getElementById('filter-company')?.value || '';
  const status = document.getElementById('filter-statut')?.value || '';
  const search = normaliserValeurFacture(document.getElementById('searchInput')?.value);
  const normalizedStatus = normaliserValeurFacture(status);
  const normalizedCompany = normaliserValeurFacture(company);

  FACTURES_FILTREES = FACTURES.filter(facture => {
    const invoiceDate = String(facture.date_emission || facture.date || '');
    const invoiceCompany = String(facture.client || facture.company_name || '');
    const invoiceStatus = String(facture.statut || facture.status || 'Impayée');
    const matchesSearch = [
      facture.numero_facture,
      invoiceCompany,
      invoiceDate,
      obtenirMoisFacture(invoiceDate)
    ].some(value => normaliserValeurFacture(value).includes(search));

    return (!month || obtenirMoisFacture(invoiceDate) === month) &&
      (!company || normaliserValeurFacture(invoiceCompany) === normalizedCompany) &&
      (!status || normaliserValeurFacture(invoiceStatus) === normalizedStatus) &&
      matchesSearch;
  });

  pageFactures = 1;
  remplirTableau(FACTURES_FILTREES);
}

function remplirTableau(factures) {
  const tbody = document.getElementById('factureTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const pagination = document.getElementById('facture-pagination');
  if (factures.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.className = 'table-message';
    cell.textContent = 'Aucune facture disponible.';
    row.appendChild(cell);
    tbody.appendChild(row);
    pagination?.replaceChildren();
    return;
  }

  const totalPages = Math.ceil(factures.length / FACTURES_PAR_PAGE);
  pageFactures = Math.min(Math.max(pageFactures, 1), totalPages);
  const pageStart = (pageFactures - 1) * FACTURES_PAR_PAGE;
  const pageFacturesAffichees = factures.slice(pageStart, pageStart + FACTURES_PAR_PAGE);

  pageFacturesAffichees.forEach(f => {
    const numero = String(f.numero_facture || '');
    const row = document.createElement('tr');
    row.dataset.factureId = numero;
    const status = String(f.statut || f.status || 'Impayée');
    const normalizedStatus = status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    if (normalizedStatus === 'contestee') {
      row.classList.add('invoice-disputed');
      if (highlightDisputedInvoices) row.classList.add('animate-disputed');
    }

    const dafStatus = f.daf_status || 'not_submitted';
    if (dafStatus === 'pending') row.classList.add('facture-submitted-daf');

    const addCell = (value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
      return cell;
    };

    addCell(numero);
    addCell(f.client || f.company_name || '');
    addCell(f.date_emission || f.date || '');
    addCell(`${Number(f.montant_total || f.amount || 0).toLocaleString()} XAF`);

    const statusCell = addCell('');
    const statusBadge = document.createElement('span');
    statusBadge.className = normalizedStatus === 'contestee' ? 'status-badge contested' : 'status-badge';
    statusBadge.textContent = status;
    statusCell.appendChild(statusBadge);
    if (dafStatus === 'pending' || dafStatus === 'validated' || dafStatus === 'rejected') {
      const badge = document.createElement('span');
      badge.className = `daf-status-badge daf-status-${dafStatus}`;
      const labels = {
        pending: 'Soumise au DAF',
        validated: 'Validée par le DAF',
        rejected: 'Rejetée par le DAF'
      };
      badge.innerHTML = `<i class="fas ${dafStatus === 'pending' ? 'fa-clock' : dafStatus === 'validated' ? 'fa-circle-check' : 'fa-circle-xmark'}" aria-hidden="true"></i>`;
      badge.append(` ${labels[dafStatus]}`);
      statusCell.appendChild(document.createElement('br'));
      statusCell.appendChild(badge);
    }

    const viewCell = addCell('');
    viewCell.style.textAlign = 'center';
    const viewButton = document.createElement('button');
    viewButton.type = 'button';
    viewButton.className = 'action-btn-view';
    viewButton.setAttribute('aria-label', `Consulter la facture ${numero}`);
    viewButton.title = 'Consulter la facture';
    viewButton.innerHTML = '<i class="fas fa-eye" aria-hidden="true"></i>';
    viewButton.addEventListener('click', () => voirFacture(numero));
    viewCell.appendChild(viewButton);

    const actionCell = addCell('');
    actionCell.style.textAlign = 'right';
    if (dafStatus === 'pending' || dafStatus === 'validated') {
      const submittedLabel = document.createElement('span');
      submittedLabel.className = `daf-status-badge daf-status-${dafStatus}`;
      submittedLabel.textContent = dafStatus === 'pending' ? 'En attente du DAF' : 'Traitée par le DAF';
      actionCell.appendChild(submittedLabel);
    } else {
      const submitButton = document.createElement('button');
      submitButton.type = 'button';
      submitButton.className = 'action-btn-submit';
      submitButton.innerHTML = '<i class="fas fa-paper-plane" aria-hidden="true"></i><span>Soumettre au DAF</span>';
      submitButton.addEventListener('click', () => soumettreFacture(numero, submitButton));
      actionCell.appendChild(submitButton);
    }

    tbody.appendChild(row);
  });

  afficherPagination(totalPages);
}

function afficherPagination(totalPages) {
  const pagination = document.getElementById('facture-pagination');
  if (!pagination) return;

  pagination.replaceChildren();
  if (totalPages <= 1) return;

  const creerBouton = (label, page, disabled, active = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = disabled;
    if (active) {
      button.classList.add('active');
      button.setAttribute('aria-current', 'page');
    }
    button.addEventListener('click', () => {
      pageFactures = page;
      remplirTableau(FACTURES_FILTREES);
    });
    return button;
  };

  pagination.appendChild(creerBouton('Précédent', pageFactures - 1, pageFactures === 1));
  const indicator = document.createElement('span');
  indicator.className = 'pagination-page-indicator';
  indicator.textContent = `Page ${pageFactures} sur ${totalPages}`;
  indicator.setAttribute('aria-live', 'polite');
  pagination.appendChild(indicator);
  pagination.appendChild(creerBouton('Suivant', pageFactures + 1, pageFactures === totalPages));
}

async function soumettreFacture(numero, button) {
  if (!confirm('Soumettre cette facture au DAF pour validation ?')) return;
  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  }
  try {
    const res = await fetch(`${API_URL}/api/factures/submit/${encodeURIComponent(numero)}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Operateur-Id': operateurId || '' }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur soumission');
    const submittedAt = data.submitted_to_daf_at || new Date().toISOString();
    const facture = FACTURES.find(item => item.numero_facture === numero);
    if (facture) {
      facture.daf_status = data.daf_status || 'pending';
      facture.submitted_to_daf_at = submittedAt;
    }
    remplirTableau(FACTURES_FILTREES);
    alert('Facture soumise au DAF');
  } catch (err) {
    console.error(err);
    alert(`Erreur lors de la soumission : ${err.message}`);
    if (button) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }
}

async function voirFacture(numero) {
  const previewWindow = window.open('about:blank', '_blank');
  if (!previewWindow) {
    alert('Autorisez les fenêtres contextuelles pour afficher la facture.');
    return;
  }

  try {
    const res = await fetch(
      `${API_URL}/api/factures/${encodeURIComponent(numero)}/pdf`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Operateur-Id': operateurId || ''
        }
      }
    );
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || `Erreur HTTP ${res.status}`);
    }

    const pdfUrl = URL.createObjectURL(await res.blob());
    previewWindow.location.replace(pdfUrl);
    previewWindow.addEventListener('pagehide', () => URL.revokeObjectURL(pdfUrl), { once: true });
  } catch (err) {
    console.error('Erreur ouverture facture :', err);
    previewWindow.close();
    alert(`Impossible d’afficher la facture : ${err.message}`);
  }
}
