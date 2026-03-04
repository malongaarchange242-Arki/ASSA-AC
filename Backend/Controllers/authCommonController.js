// controllers/authCommonController.js
import supabase from '../Config/db.js';

/* ---------------------------------------------------------
   🔹 Vérifie le rôle d'un utilisateur via son email
----------------------------------------------------------*/
export const checkUserRole = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email requis' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // -----------------------------
    // Vérifier si l'utilisateur est un admin
    // -----------------------------
    if (process.env.DEBUG_AUTH === 'true') console.log('checkUserRole: looking for', normalizedEmail);
    const { data: admin, error: adminErr } = await supabase
      .from('admins')
      .select('id, email, profile, password')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (adminErr) {
      console.error('Supabase error checking admin:', adminErr);
      return res.status(500).json({ message: 'Erreur serveur', erreur: adminErr.message });
    }

    if (admin) {
      return res.json({
        role: 'admin',
        has_password: !!admin.password,
        profile: admin.profile
      });
    }

    // -----------------------------
    // Vérifier si l'utilisateur est une company
    // -----------------------------
    const { data: company, error: compErr } = await supabase
      .from('companies')
      .select('id, company_name, email, password_hash, status')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (compErr) {
      console.error('Supabase error checking company:', compErr);
      return res.status(500).json({ message: 'Erreur serveur', erreur: compErr.message });
    }

    if (company) {
      return res.json({
        role: 'company',
        has_password: !!company.password_hash,
        status: company.status || 'Inactif',
        company_name: company.company_name,
        id: company.id
      });
    }

    // -----------------------------
    // Vérifier si l'utilisateur est un opérateur
    // -----------------------------
    const { data: operateur, error: operateurErr } = await supabase
      .from('operateurs')
      .select('id, email, password_hash')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (process.env.DEBUG_AUTH === 'true') console.log('operateur lookup:', { operateur, operateurErr });

    if (operateurErr) {
      console.error('Supabase error checking operateur:', operateurErr);
      return res.status(500).json({ message: 'Erreur serveur', erreur: operateurErr.message });
    }

    if (operateur) {
      return res.json({
        role: 'operateur',
        has_password: !!operateur.password_hash,
        id: operateur.id
      });
    }

    // -----------------------------
    // Vérifier si l'utilisateur est un superviseur (DAF)
    // -----------------------------
    const { data: sup, error: supErr } = await supabase
      .from('superviseurs')
      .select('id, email, password_hash, profile')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (process.env.DEBUG_AUTH === 'true') console.log('superviseur lookup:', { sup, supErr });

    if (supErr) {
      console.error('Supabase error checking superviseur:', supErr);
      return res.status(500).json({ message: 'Erreur serveur', erreur: supErr.message });
    }

    if (sup) {
      return res.json({
        role: 'superviseur',
        has_password: !!sup.password_hash,
        profile: sup.profile,
        id: sup.id
      });
    }

    // -----------------------------
    // Aucun compte trouvé
    // -----------------------------
    return res.status(404).json({
      role: 'unknown',
      message: 'Aucun compte associé à cet email'
    });
    
  } catch (err) {
    console.error('checkUserRole error:', err);
    return res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};
