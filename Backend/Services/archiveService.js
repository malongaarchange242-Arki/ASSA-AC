import supabase from '../Config/db.js';

/* -------------------------------------------------
   🔹 Fonction générique pour créer une archive
-------------------------------------------------*/
const createArchive = async ({
  type,
  reference,
  nom_compagnie = null,
  montant = null,
  objet = null,
  description,
  fichier_url = null
}) => {
  const { error } = await supabase
    .from('archives')
    .insert({
      type_archive: type,
      reference,
      nom_compagnie,
      montant,
      objet,
      description,
      fichier_url,
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
    reference: company.id,
    nom_compagnie: company.nom,
    description: `L'administrateur ${adminId} a archivé la compagnie ${company.nom}.`
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
    reference: company.id,
    nom_compagnie: company.nom,
    description: `L'administrateur ${adminId} a restauré la compagnie ${company.nom}.`
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
    reference: admin.id,
    description: adminId
      ? `L'administrateur ${adminId} a archivé l'administrateur ${admin.email}.`
      : `L'administrateur ${admin.email} a été archivé.`
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
    reference: admin.id,
    description: adminId
      ? `L'administrateur ${adminId} a restauré l'administrateur ${admin.email}.`
      : `L'administrateur ${admin.email} a été restauré.`
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
    reference: facture.id,
    nom_compagnie: facture.nom_client,
    montant: facture.montant,
    objet: facture.objet,
    description: `L'administrateur ${adminId} a archivé la facture ${facture.numero_facture}.`
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
    reference: facture.id,
    nom_compagnie: facture.nom_client,
    montant: facture.montant,
    objet: facture.objet,
    description: `L'administrateur ${adminId} a restauré la facture ${facture.numero_facture}.`
  });

  return true;
};
