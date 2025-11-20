// Services/journalService.js
import supabase from '../Config/db.js';

/* ============================================================
   🔹 Fonction pour loguer une activité
   ✅ id_admin : UUID de l’admin
   ✅ id_companie : UUID de la compagnie (optionnel)
   ✅ type_activite : 'create', 'update', 'delete', 'system'
   ✅ categorie : catégorie de l’activité (obligatoire)
   ✅ reference : référence liée à l’activité (optionnel)
   ✅ description : texte descriptif
============================================================ */
export const logActivite = async ({
  id_admin,
  id_companie = null,
  type_activite,
  categorie = 'Général', // valeur par défaut
  reference = null,
  description = '-'
}) => {
  try {
    const { data, error } = await supabase
      .from('journal_activite')
      .insert([{
        id_admin,
        id_companie,
        type_activite,
        categorie,
        reference,
        description,
        date_activite: new Date()
      }])
      .select();

    if (error) throw error;

    return { success: true, activity: data[0] };
  } catch (err) {
    console.error('Erreur journalService:', err.message);
    return { success: false, message: err.message };
  }
};

/* ============================================================
   🔹 Récupérer toutes les activités
============================================================ */
export const getAllActivites = async () => {
  try {
    const { data, error } = await supabase
      .from('journal_activite')
      .select('*')
      .order('date_activite', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (err) {
    console.error('Erreur journalService:', err.message);
    return [];
  }
};

/* ============================================================
   🔹 Récupérer les activités d’un admin spécifique
============================================================ */
export const getActivitesByAdmin = async (id_admin) => {
  try {
    const { data, error } = await supabase
      .from('journal_activite')
      .select('*')
      .eq('id_admin', id_admin)
      .order('date_activite', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (err) {
    console.error('Erreur journalService:', err.message);
    return [];
  }
};

/* ============================================================
   🔹 Récupérer les activités d’une compagnie spécifique
============================================================ */
export const getActivitesByCompanie = async (id_companie) => {
  try {
    const { data, error } = await supabase
      .from('journal_activite')
      .select('*')
      .eq('id_companie', id_companie)
      .order('date_activite', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (err) {
    console.error('Erreur journalService:', err.message);
    return [];
  }
};

/* ============================================================
   🔹 Récupérer les N dernières activités
============================================================ */
export const getRecentActivites = async (limit = 10) => {
  const n = parseInt(limit, 10) || 10;
  try {
    const { data, error } = await supabase
      .from('journal_activite')
      .select('*')
      .order('date_activite', { ascending: false })
      .limit(n);

    if (error) throw error;

    return data || [];
  } catch (err) {
    console.error('Erreur journalService:', err.message);
    return [];
  }
};
