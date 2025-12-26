// controllers/parametreAdminController.js
import supabase from '../Config/db.js';
import bcrypt from 'bcryptjs';

// ----------------- GET : récupérer tous les paramètres -----------------
export const getParametres = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('parametres')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found (Supabase)
      return res.status(500).json({ message: 'Erreur serveur', erreur: error.message });
    }

    res.json({ parametres: data || {} });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};

// ----------------- PUT : mettre à jour les paramètres -----------------
export const updateParametres = async (req, res) => {
  try {
    const {
      company_name,
      company_address,
      company_email,
      invoice_prefix,
      tax_rate,
      theme,
      email_alerts,
      dashboard_alerts,
      two_factor_enabled 
    } = req.body;

    const updates = {
      updated_at: new Date()
    };

    if (company_name) updates.company_name = company_name.toString().trim();
    if (company_address) updates.company_address = company_address.toString().trim();
    if (company_email) updates.company_email = company_email.toString().trim();
    if (invoice_prefix) updates.invoice_prefix = invoice_prefix.toString().trim();
    if (tax_rate !== undefined) updates.tax_rate = Number(tax_rate);
    if (theme) updates.theme = theme.toString().trim();
    if (email_alerts !== undefined) updates.email_alerts = Boolean(email_alerts);
    if (dashboard_alerts !== undefined) updates.dashboard_alerts = Boolean(dashboard_alerts);
    if (two_factor_enabled !== undefined) updates.two_factor_enabled = Boolean(two_factor_enabled);

    const { data, error } = await supabase
      .from('parametres')
      .update(updates)
      .eq('id', 1)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ message: 'Erreur lors de la mise à jour', erreur: error.message });
    }

    res.json({ message: 'Paramètres mis à jour avec succès', parametres: data });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};


// PUT /api/admins/update-password
export const updatePassword = async (req, res) => {
  try {
    const adminId = req.user.id; // venant du verifyToken
    const { currentPassword, newPassword } = req.body;

    // Récupérer l'admin
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('id', adminId)
      .single();

    if (error || !admin) return res.status(404).json({ message: 'Admin introuvable' });

    // Vérifier le mot de passe actuel
    const match = await bcrypt.compare(currentPassword, admin.password);
    if (!match) return res.status(400).json({ message: 'Mot de passe actuel incorrect' });

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Mettre à jour
    const { data, updateError } = await supabase
      .from('admins')
      .update({ password: hashedPassword })
      .eq('id', adminId)
      .select()
      .single();

    if (updateError) return res.status(500).json({ message: 'Erreur mise à jour', erreur: updateError.message });

    res.json({ message: 'Mot de passe mis à jour avec succès' });

  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};