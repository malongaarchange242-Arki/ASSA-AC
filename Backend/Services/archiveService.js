// Services/archiveService.js
import supabase from '../Config/db.js';

/* -------------------------------------------------
   🔹 Archiver une compagnie
-------------------------------------------------*/
export const archiveCompanyService = async (company, adminId) => {
  const { error } = await supabase
    .from('companies')
    .update({ archived: true })
    .eq('id', company.id);

  if (error) throw new Error(error.message);
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
  return true;
};
