import supabase from '../Config/db.js';

/* -------------------------------------------------
   🔹 Fonction générique pour créer une archive
-------------------------------------------------*/
const createArchive = async ({ type, description, fichier_url = null, reference }) => {
  const { error } = await supabase
    .from('archives')
    .insert({
      type_archive: type,
      description,
      fichier_url,
      reference,
      date_cloture: new Date()
    });

  if (error) throw new Error(error.message);
};


/* -------------------------------------------------
   🔹 Archiver une compagnie
-------------------------------------------------*/
export const archiveCompanyService = async (company, adminId) => {

  // 1️⃣ Mise à jour
  const { error } = await supabase
    .from('companies')
    .update({ archived: true })
    .eq('id', company.id);

  if (error) throw new Error(error.message);

  // 2️⃣ Enregistrement dans les archives
  await createArchive({
    type: "Archivage de compagnie",
    description: `L'administrateur ${adminId} a archivé la compagnie ${company.nom}.`,
    reference: company.id
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
    description: `L'administrateur ${adminId} a restauré la compagnie ${company.nom}.`,
    reference: company.id
  });

  return true;
};

/* -------------------------------------------------
   🔹 Archiver un admin
-------------------------------------------------*/
export const archiveAdminService = async (admin) => {

  const { error } = await supabase
    .from('admins')
    .update({ archived: true })
    .eq('id', admin.id);

  if (error) throw new Error(error.message);

  await createArchive({
    type: "Archivage d'administrateur",
    description: `L'administrateur ${admin.email} a été archivé.`,
    reference: admin.id
  });

  return true;
};

/* -------------------------------------------------
   🔹 Restaurer un admin
-------------------------------------------------*/
export const restoreAdminService = async (admin) => {

  const { error } = await supabase
    .from('admins')
    .update({ archived: false })
    .eq('id', admin.id);

  if (error) throw new Error(error.message);

  await createArchive({
    type: "Restauration d'administrateur",
    description: `L'administrateur ${admin.email} a été restauré.`,
    reference: admin.id
  });

  return true;
};
