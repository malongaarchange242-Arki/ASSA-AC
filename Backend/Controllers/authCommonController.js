// controllers/authCommonController.js
import supabase from '../Config/db.js';

/* ---------------------------------------------------------
   🔧 UTILITAIRE : normalisation des rôles
---------------------------------------------------------- */
const normalizeRole = (role) => {
  if (!role) return null;

  return role
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
};

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
       🔹 SUPERVISOR
    ========================= */
    const { data: supervisor, error: supErr } = await supabase
      .from('superviseurs')
      .select('id, email, archived')
      .eq('email', normalizedEmail)
      .eq('archived', false)
      .maybeSingle();

    if (supErr) {
      console.error('Erreur superviseur:', supErr);
      return res.status(500).json({ message: 'Erreur serveur' });
    }

    if (supervisor) {
      return res.json({
        exists: true,
        role: 'supervisor',
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
      const role = normalizeRole(admin.profile);

      return res.json({
        exists: true,
        role: 'admin', // 🔥 rôle machine unique
        admin_level: role === 'superadmin' ? 'superadmin' : 'admin',
        has_password: true
      });
    }

    /* =========================
       🔹 COMPANY
    ========================= */
    const { data: company, error: compErr } = await supabase
      .from('companies')
      .select('id, email, status, password_hash')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (compErr) {
      console.error('Erreur company:', compErr);
      return res.status(500).json({ message: 'Erreur serveur' });
    }

    if (company) {
      return res.json({
        exists: true,
        role: 'company',
        password_hash: company.password_hash,
        status: company.status ?? 'inactive'
      });
    }

    /* =========================
       ❌ AUCUN COMPTE
    ========================= */
    return res.status(404).json({
      exists: false,
      message: 'Aucun compte associé à cet email'
    });

  } catch (err) {
    console.error('checkUserRoleByEmail error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};
