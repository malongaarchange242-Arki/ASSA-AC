/**
 * Applique la logique de recherche en filtrant les lignes du tableau.
 * La recherche est non sensible à la casse et porte sur :
 * 1. N° Facture (colonne 0)
 * 2. Compagnie (colonne 1)
 * 3. Date d'Émission (colonne 2)
 */
function appliquerRecherche() {
    // Récupère la valeur de recherche et la convertit en majuscules
    const input = document.getElementById('searchInput');
    const filter = input.value.toUpperCase();
    
    // Récupère le corps du tableau et toutes ses lignes
    const tableBody = document.getElementById('factureTableBody');
    const rows = tableBody.getElementsByTagName('tr');

    // Boucle sur chaque ligne pour vérifier la correspondance
    for (let i = 0; i < rows.length; i++) {
        let row = rows[i];
        let cells = row.getElementsByTagName('td');
        let found = false;
        
        // Vérifier la correspondance dans les 3 premières colonnes 
        // Indices: 0=N° Facture, 1=Compagnie, 2=Date
        for (let j = 0; j < 3; j++) {
            if (cells[j]) {
                // Récupère le texte de la cellule et le met en majuscules pour la comparaison
                let cellText = cells[j].textContent || cells[j].innerText;
                if (cellText.toUpperCase().indexOf(filter) > -1) {
                    found = true;
                    break; // Une correspondance suffit pour afficher la ligne
                }
            }
        }

        // Affiche ou masque la ligne
        if (found) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    }
}


/**
 * Simule l'ouverture d'une modale ou la navigation pour voir la Facture.
 * @param {string} id - L'identifiant unique de la facture.
 */
function voirFacture(id) {
    alert("Ouverture de la Facture n°" + id + " en mode consultation.");
    // Logique réelle : ouvrir une modale ou rediriger
}

/**
 * Gère la logique de marquage d'une facture comme Payée (action Confirmer).
 * Remplace le bouton "Confirmer" par le badge "Confirmée".
 * @param {string} id - L'identifiant unique de la facture.
 */
function confirmerFacture(id) {
    const statutElement = document.getElementById('statut-' + id);
    const actionsContainer = document.getElementById('actions-' + id);
    const row = actionsContainer.closest('tr');

    if (confirm("Confirmer le paiement de la facture INV-2025-" + id + " ?")) {
        // 1. Mise à jour du statut à "Payée"
        if (statutElement) {
            statutElement.textContent = 'Payée';
            statutElement.className = 'status-badge payee';
        }
        
        // 2. Remplacement de l'action par le bouton "Confirmée" inactif
        if (actionsContainer) {
            actionsContainer.innerHTML = '<span class="action-btn-confirmed">Confirmée</span>';
        }
        
        // 3. Mise à jour de l'attribut de la ligne
        if (row) {
            row.setAttribute('data-statut', 'payee');
        }

        alert('Facture INV-2025-' + id + ' marquée comme Payée (confirmée).');
    }
}

/**
 * Gère la logique de suppression d'une facture (pour les factures contestées).
 * @param {string} id - L'identifiant unique de la facture.
 */
function supprimerFacture(id) {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette facture n°" + id + " ? Cette action est irréversible.")) {
        const actionsContainer = document.getElementById('actions-' + id);
        
        if (actionsContainer) {
            const row = actionsContainer.closest('tr');
            if (row) {
                row.remove(); // Supprime la ligne du tableau
                alert('La facture n°' + id + ' a été supprimée avec succès.');
            }
        }
    }
}