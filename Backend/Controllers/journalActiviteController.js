// Exemple complet pour toutes les routes

import supabase from '../Config/db.js';

// Helper async pour enrichir les activités
const enrichActivites = async (activites) => {
  return await Promise.all(
    activites.map(async (act) => {
      let utilisateur = '-';
      if (act.id_admin) {
        const { data: adminData } = await supabase
          .from('admins')
          .select('email, nom, prenom')
          .eq('id', act.id_admin)
          .single();
        if (adminData) utilisateur = adminData.email || `${adminData.nom} ${adminData.prenom}`;
      } else if (act.id_companie) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('company_name, email')
          .eq('id', act.id_companie)
          .single();
        if (companyData) utilisateur = companyData.email || companyData.company_name;
      } else if (act.email) utilisateur = act.email;
      else if (act.nom_utilisateur) utilisateur = act.nom_utilisateur;

      let typeActivite = act.type_activite || 'Système';
      if (typeActivite.toLowerCase() === 'system') typeActivite = 'Système';

      return {
        ...act,
        utilisateur,
        type_activite: typeActivite
      };
    })
  );
};

// ==========================
// Toutes les activités
// ==========================
export const getAllActivites = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('journal_activite')
      .select('*')
      .order('date_activite', { ascending: false });
    if (error) throw error;

    const activites = await enrichActivites(data);
    res.status(200).json({ success: true, activites });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur récupération activités', error: err.message });
  }
};

// ==========================
// Activités par admin
// ==========================
export const getActivitesByAdmin = async (req, res) => {
  const { id_admin } = req.params;
  try {
    const { data, error } = await supabase
      .from('journal_activite')
      .select('*')
      .eq('id_admin', id_admin)
      .order('date_activite', { ascending: false });
    if (error) throw error;

    const activites = await enrichActivites(data);
    res.status(200).json({ success: true, activites });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur récupération activités admin', error: err.message });
  }
};

// ==========================
// Activités par compagnie
// ==========================
export const getActivitesByCompanie = async (req, res) => {
  const { id_companie } = req.params;
  const companyId = parseInt(id_companie);
  if (isNaN(companyId)) return res.status(400).json({ message: 'ID compagnie invalide' });

  try {
    if (req.user.role === 'Company' && req.user.id_companie !== companyId) {
      return res.status(403).json({ message: 'Accès refusé : consulter uniquement vos activités' });
    }

    const { data, error } = await supabase
      .from('journal_activite')
      .select('*')
      .eq('id_companie', companyId)
      .order('date_activite', { ascending: false });
    if (error) throw error;

    const activites = await enrichActivites(data);
    res.status(200).json({ success: true, activites });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur récupération activités compagnie', error: err.message });
  }
};

// ==========================
// N dernières activités
// ==========================
export const getRecentActivites = async (req, res) => {
  const n = parseInt(req.query.limit) || 10;
  try {
    const { data, error } = await supabase
      .from('journal_activite')
      .select('*')
      .order('date_activite', { ascending: false })
      .limit(n);
    if (error) throw error;

    const activites = await enrichActivites(data);
    res.status(200).json({ success: true, activites });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur récupération dernières activités', error: err.message });
  }
};
