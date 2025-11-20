// controllers/authCommonController.js
import supabase from '../config/db.js';

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
