// Services/journalService.js
import supabase from '../Config/db.js';

export const logActivite = async ({
  type_activite,                 // create | update | delete | validate | reject | system
  categorie = 'Général',          // Facture | Company | Auth | Sécurité
  module = 'Système',             // Factures | Compagnies | Auth
  description,
  reference = null,

  id_admin = null,
  id_companie = null,

  utilisateur_nom = null,
  utilisateur_email = null
}) => {
  try {
    // ❌ On ne log PAS les archives dans le journal visible
    if (['archive', 'restore'].includes(type_activite)) {
      return { success: true, skipped: true };
    }

    const payload = {
      type_activite,
      categorie,
      module,
      reference,
      description,

      id_admin,
      id_companie,

      utilisateur_nom: utilisateur_nom || (id_admin ? 'Administrateur' : 'Système'),
      utilisateur_email: utilisateur_email || null,

      date_activite: new Date()
    };

    const { data, error } = await supabase
      .from('journal_activite')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    return { success: true, activity: data };

  } catch (err) {
    console.error('❌ Erreur journalService:', err.message);
    return { success: false, message: err.message };
  }
};

const TYPES_VISIBLES = ['create', 'update', 'delete', 'validate', 'reject', 'system'];

export const getRecentActivites = async (limit = 10) => {
  try {
    const { data, error } = await supabase
      .from('journal_activite')
      .select('*')
      .in('type_activite', TYPES_VISIBLES)
      .order('date_activite', { ascending: false })
      .limit(Number(limit) || 10);

    if (error) throw error;
    return data || [];

  } catch (err) {
    console.error('Erreur journalService:', err.message);
    return [];
  }
};

export const getActivitesByCompanie = async (id_companie) => {
  try {
    const { data, error } = await supabase
      .from('journal_activite')
      .select('*')
      .eq('id_companie', id_companie)
      .in('type_activite', TYPES_VISIBLES)
      .order('date_activite', { ascending: false });

    if (error) throw error;
    return data || [];

  } catch (err) {
    console.error('Erreur journalService:', err.message);
    return [];
  }
};
