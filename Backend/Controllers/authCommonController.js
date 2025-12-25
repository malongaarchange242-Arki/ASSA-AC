// controllers/authCommonController.js
import supabase from '../Config/db.js';

/* ---------------------------------------------------------
   🔍 Vérifie le rôle d'un utilisateur via son email
   - Route publique
   - Aucun JWT / cookie
---------------------------------------------------------- */
export const checkUserRoleByEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email requis' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    /* =========================
       🔹 SUPERVISEUR
    ========================= */
    const { data: superviseur, error: supErr } = await supabase
      .from('superviseurs')
      .select('id, email, archived')
      .eq('email', normalizedEmail)
      .eq('archived', false)
      .maybeSingle();

    if (supErr) {
      console.error('Erreur superviseur:', supErr);
      return res.status(500).json({ message: 'Erreur serveur' });
    }

    if (superviseur) {
      return res.json({
        role: 'Superviseur',
        has_password: true
      });
    }

    /* =========================
       🔹 ADMIN
    ========================= */
    const { data: admin, error: adminErr } = await supabase
      .from('admins')
      .select('id, email, profile, archived')
      .eq('email', normalizedEmail)
      .eq('archived', false)
      .maybeSingle();

    if (adminErr) {
      console.error('Erreur admin:', adminErr);
      return res.status(500).json({ message: 'Erreur serveur' });
    }

    if (admin) {
      return res.json({
        role: admin.profile, // Administrateur | Super Admin
        has_password: true
      });
    }

    /* =========================
       🔹 COMPANY
    ========================= */
    const { data: company, error: compErr } = await supabase
      .from('companies')
      .select('id, email, status')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (compErr) {
      console.error('Erreur company:', compErr);
      return res.status(500).json({ message: 'Erreur serveur' });
    }

    if (company) {
      return res.json({
        role: 'Company',
        status: company.status || 'Inactif'
      });
    }

    /* =========================
       ❌ AUCUN COMPTE
    ========================= */
    return res.status(404).json({
      role: 'unknown',
      message: 'Aucun compte associé à cet email'
    });

  } catch (err) {
    console.error('checkUserRoleByEmail error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};
