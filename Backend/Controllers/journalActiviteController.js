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

export const getActivitesByOperateurConnecte = async (req, res) => {
  const userId = req.user?.id;
  const userEmail = req.user?.email;
  if (!userId || !userEmail) {
    return res.status(401).json({ message: 'Identité opérateur incomplète' });
  }

  try {
    const [byIdResult, byEmailResult, operatorResult] = await Promise.all([
      supabase
        .from('journal_activite')
        .select('*')
        .eq('id_admin', userId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('journal_activite')
        .select('*')
        .eq('utilisateur_email', userEmail)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('operateurs')
        .select('nom, email')
        .eq('id', userId)
        .maybeSingle()
    ]);

    if (byIdResult.error) throw byIdResult.error;
    if (byEmailResult.error) throw byEmailResult.error;
    if (operatorResult.error) throw operatorResult.error;

    const uniqueActivities = new Map();
    [...(byIdResult.data || []), ...(byEmailResult.data || [])].forEach(activity => {
      const key = activity.id || `${activity.created_at}:${activity.type_activite}:${activity.description}`;
      uniqueActivities.set(String(key), activity);
    });

    const activites = [...uniqueActivities.values()]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 10)
      .map(activity => ({
        ...activity,
        utilisateur: operatorResult.data?.nom || userEmail,
        role_utilisateur: 'Opérateur',
        date_activite: activity.date_activite ?? activity.created_at ?? null
      }));

    return res.status(200).json({ success: true, activites });
  } catch (err) {
    console.error('Erreur récupération activités opérateur :', err);
    return res.status(500).json({
      message: 'Erreur récupération activités opérateur',
      error: err.message
    });
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
