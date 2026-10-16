// controllers/authCommonController.js
import supabase from '../Config/db.js';

/* ---------------------------------------------------------
   🔹 Vérifie le rôle d'un utilisateur via son email
----------------------------------------------------------*/
export const checkUserRole = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: 'Email requis' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const safeLookup = async (table, select, label) => {
      try {
        const { data, error } = await supabase
          .from(table)
          .select(select)
          .ilike('email', normalizedEmail)
          .maybeSingle();

        if (error) {
          if (error.code === 'PGRST116' || error.code === '42703') {
            return null;
          }
          throw error;
        }

        return data;
      } catch (error) {
        console.error(`Supabase error checking ${label}:`, error);
        throw error;
      }
    };

    let admin = null;
    let company = null;
    let operateur = null;
    let superviseur = null;

    try {
      admin = await safeLookup('admins', 'id, email, profile, password', 'admin');
    } catch (err) {
      return res.status(503).json({
        role: 'unknown',
        message: 'Service de données indisponible. Vérifiez la base de données Supabase.'
      });
    }

    if (admin) {
      return res.json({
        role: 'admin',
        has_password: !!admin.password,
        profile: admin.profile
      });
    }

    try {
      company = await safeLookup('companies', 'id, company_name, email, password_hash, status', 'company');
    } catch (err) {
      return res.status(503).json({
        role: 'unknown',
        message: 'Service de données indisponible. Vérifiez la base de données Supabase.'
      });
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

    try {
      operateur = await safeLookup('operateurs', 'id, email, password_hash', 'operateur');
    } catch (err) {
      return res.status(503).json({
        role: 'unknown',
        message: 'Service de données indisponible. Vérifiez la base de données Supabase.'
      });
    }

    if (operateur) {
      return res.json({
        role: 'operateur',
        has_password: !!operateur.password_hash,
        id: operateur.id
      });
    }

    try {
      superviseur = await safeLookup('superviseurs', 'id, email, password_hash, profile', 'superviseur');
    } catch (err) {
      return res.status(503).json({
        role: 'unknown',
        message: 'Service de données indisponible. Vérifiez la base de données Supabase.'
      });
    }

    if (superviseur) {
      return res.json({
        role: 'superviseur',
        has_password: !!superviseur.password_hash,
        profile: superviseur.profile,
        id: superviseur.id
      });
    }

    return res.status(404).json({
      role: 'unknown',
      message: 'Aucun compte associé à cet email'
    });

  } catch (err) {
    console.error('checkUserRole error:', err);
    return res.status(503).json({
      role: 'unknown',
      message: 'Service de données indisponible. Vérifiez la base de données Supabase.'
    });
  }
};
