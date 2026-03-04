import supabase from '../Config/db.js';

/* -------------------------------------------------
   🔹 Fonction générique pour créer une archive
   ✔️ Adaptée au schéma réel de la table `archives`
-------------------------------------------------*/
export const createArchive = async ({
  type,
  ref,
  compagnie_id = null,
  compagnie_nom = null,
  montant = null,
  objet = null,
  periode = null,
  statut = null,
  admin_id = null,
  admin_nom = null
}) => {
  const { error } = await supabase
    .from('archives')
    .insert({
      type,
      ref,
      compagnie_id,
      compagnie_nom,
      montant,
      objet,
      periode,
      statut,
      admin_id,
      admin_nom,
      date_cloture: new Date()
    });

  if (error) throw new Error(error.message);
};


/* -------------------------------------------------
   🔹 Archiver une compagnie
-------------------------------------------------*/
export const archiveCompanyService = async (company, adminId) => {
  const { error } = await supabase
    .from('companies')
    .update({ archived: true })
    .eq('id', company.id);

  if (error) throw new Error(error.message);

  await createArchive({
    type: "Archivage de compagnie",
    ref: company.id,
    compagnie_id: company.id,
    compagnie_nom: company.nom
  });

  return true;
};

/* -------------------------------------------------
   🔹 Restaurer une compagnie
-------------------------------------------------*/
export const restoreCompanyService = async (company, adminId) => {
  const { error } = await supabase
    .from('companies')
    .update({ archived: false })
    .eq('id', company.id);

  if (error) throw new Error(error.message);

  await createArchive({
    type: "Restauration de compagnie",
    ref: company.id,
    compagnie_id: company.id,
    compagnie_nom: company.nom
  });

  return true;
};

/* -------------------------------------------------
   🔹 Archiver un administrateur
-------------------------------------------------*/
export const archiveAdminService = async (admin, adminId = null) => {
  const { error } = await supabase
    .from('admins')
    .update({ archived: true })
    .eq('id', admin.id);

  if (error) throw new Error(error.message);

  await createArchive({
    type: "Archivage d'administrateur",
    ref: admin.id
  });

  return true;
};

/* -------------------------------------------------
   🔹 Restaurer un administrateur
-------------------------------------------------*/
export const restoreAdminService = async (admin, adminId = null) => {
  const { error } = await supabase
    .from('admins')
    .update({ archived: false })
    .eq('id', admin.id);

  if (error) throw new Error(error.message);

  await createArchive({
    type: "Restauration d'administrateur",
    ref: admin.id
  });

  return true;
};

/* -------------------------------------------------
   🔹 Archiver une facture
-------------------------------------------------*/
export const archiveFactureService = async (facture, adminId) => {
  const { error } = await supabase
    .from('factures')
    .update({ archived: true })
    .eq('id', facture.id);

  if (error) throw new Error(error.message);

  await createArchive({
    type: "Archivage de facture",
    ref: facture.id,
    compagnie_id: facture.id_companie,
    compagnie_nom: facture.nom_client,
    montant: facture.montant_total,
    objet: facture.objet,
    periode: facture.periode,
    statut: facture.statut
  });

  return true;
};

/* -------------------------------------------------
   🔹 Restaurer une facture
-------------------------------------------------*/
export const restoreFactureService = async (facture, adminId) => {
  const { error } = await supabase
    .from('factures')
    .update({ archived: false })
    .eq('id', facture.id);

  if (error) throw new Error(error.message);

  await createArchive({
    type: "Restauration de facture",
    ref: facture.id,
    compagnie_id: facture.id_companie,
    compagnie_nom: facture.nom_client,
    montant: facture.montant_total,
    objet: facture.objet,
    periode: facture.periode,
    statut: facture.statut
  });

  return true;
};
