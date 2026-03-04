// Simple operator-specific facture frontend script
const API_URL = "https://assa-ac-duzn.onrender.com";
const token = localStorage.getItem('jwtTokenOperateur');

const role = (localStorage.getItem('userRole') || localStorage.getItem('role') || '').toString().toLowerCase();
const operateurId = localStorage.getItem('operateurId');
if (!role || !['operateur','operator'].includes(role)) {
  alert('Accès réservé aux Opérateurs');
  window.location.href = 'Index.html';
}

let FACTURES = [];

document.addEventListener('DOMContentLoaded', () => {
  chargerFactures();
});

async function chargerFactures() {
  try {
    const res = await fetch(`${API_URL}/api/factures`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Operateur-Id': operateurId || '' }
    });
    if (!res.ok) throw new Error('Erreur chargement');
    const data = await res.json();
    FACTURES = Array.isArray(data) ? data : data.factures || [];
    remplirTableau(FACTURES);
  } catch (err) {
    console.error(err);
    alert('Impossible de charger les factures');
  }
}

function remplirTableau(factures) {
  const tbody = document.getElementById('factureTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  factures.forEach(f => {
    const numero = f.numero_facture;
    const compagnie = f.client || f.company_name || '';
    const date = f.date_emission || f.date || '';
    const montant = f.montant_total || f.amount || 0;
    const statut = f.statut || f.status || 'Impayée';

    const actionBtn = `
      <button class="action-btn-submit" onclick="soumettreFacture('${numero}')">Soumettre</button>
    `;

    tbody.innerHTML += `
      <tr data-facture-id="${numero}">
        <td>${numero}</td>
        <td>${compagnie}</td>
        <td>${date}</td>
        <td>${Number(montant).toLocaleString()} XAF</td>
        <td>${statut}</td>
        <td style="text-align:center;"><button class="action-btn-view" onclick="voirFacture('${numero}')"><i class="fas fa-eye"></i></button></td>
        <td style="text-align:right;">${actionBtn}</td>
      </tr>
    `;
  });
}

async function soumettreFacture(numero) {
  if (!confirm('Soumettre cette facture au DAF pour validation ?')) return;
  try {
    const res = await fetch(`${API_URL}/api/factures/submit/${encodeURIComponent(numero)}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Operateur-Id': operateurId || '' }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur soumission');
    alert('Facture soumise au DAF');
    chargerFactures();
  } catch (err) {
    console.error(err);
    alert('Erreur lors de la soumission');
  }
}

async function voirFacture(numero) {
  window.open(`${API_URL}/api/factures/${encodeURIComponent(numero)}`, '_blank');
}
