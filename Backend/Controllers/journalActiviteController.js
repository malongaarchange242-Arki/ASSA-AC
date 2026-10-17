// Exemple complet pour toutes les routes

import supabase from '../Config/db.js';

// Helper async pour enrichir les activités
const enrichActivites = async (activites) => {
  const companyIds = [...new Set(activites.map(activity => activity.id_companie).filter(Boolean).map(String))];
  const companiesById = new Map();
  if (companyIds.length) {
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, company_name')
      .in('id', companyIds);
    if (error) throw error;
    (companies || []).forEach(company => companiesById.set(String(company.id), company));
  }

  return await Promise.all(
    activites.map(async (act) => {
      const recordedName = typeof act.utilisateur_nom === 'string' ? act.utilisateur_nom.trim() : '';
      const usableRecordedName = !['admin', 'administrateur', 'opérateur', 'operateur', 'agent', '-']
        .includes(recordedName.toLocaleLowerCase('fr-FR')) ? recordedName : '';
      let utilisateur = recordedName || act.utilisateur_email || '-';
      let role = act.role || act.role_utilisateur || null;

      if (!act.id_admin && act.id_companie && act.categorie?.toLowerCase() === 'auth') {
        role = role || 'Compagnie';
      }

      if (act.id_admin) {
        const { data: admin, error } = await supabase
          .from('admins')
          .select('nom_complet, email')
          .eq('id', act.id_admin)
          .maybeSingle();

        if (error) throw error;
        if (admin) {
          utilisateur = admin.nom_complet || usableRecordedName || admin.email || act.utilisateur_email || '-';
          role = role || 'Administrateur';
        }
      }

      if (!act.id_admin && act.utilisateur_email) {
        const { data: operateur, error } = await supabase
          .from('operateurs')
          .select('nom, email')
          .ilike('email', act.utilisateur_email)
          .maybeSingle();

        if (error) throw error;
        if (operateur) {
          utilisateur = operateur.nom || usableRecordedName || operateur.email || '-';
          role = role || 'Opérateur';
        }
      }

      const action = String(act.type_activite || '').trim().toLowerCase();
      const isLogin = action === 'login' || String(act.module || '').toLowerCase().includes('login');
      const company = act.id_companie ? companiesById.get(String(act.id_companie)) : null;
      const cible = act.reference || act.numero_facture || company?.company_name ||
        (isLogin ? act.utilisateur_email || utilisateur : act.description || '-');

      return {
        ...act,
        utilisateur,
        role_utilisateur: role,
        cible,
        date_activite: act.date_activite ?? act.created_at ?? null
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
      .order('created_at', { ascending: false });
    if (error) throw error;

    const activites = await enrichActivites((data || []).map(item => ({
      ...item,
      date_activite: item.date_activite ?? item.created_at ?? null
    })));
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
      .order('created_at', { ascending: false });
    if (error) throw error;

    const activites = await enrichActivites((data || []).map(item => ({
      ...item,
      date_activite: item.date_activite ?? item.created_at ?? null
    })));
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
      .order('created_at', { ascending: false });
    if (error) throw error;

    const activites = await enrichActivites((data || []).map(item => ({
      ...item,
      date_activite: item.date_activite ?? item.created_at ?? null
    })));
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
      .not('type_activite', 'eq', 'system')      // ❌ Exclure les logs Système
      .not('description', 'ilike', '%consultée%') // ❌ Exclure "liste consultée"
      .order('created_at', { ascending: false })
      .limit(n);

    if (error) throw error;

    const activites = await enrichActivites((data || []).map(item => ({
      ...item,
      date_activite: item.date_activite ?? item.created_at ?? null
    })));
    res.status(200).json({ success: true, activites });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Erreur récupération dernières activités',
      error: err.message
    });
  }
};
