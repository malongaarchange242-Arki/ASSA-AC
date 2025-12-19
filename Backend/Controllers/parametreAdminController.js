// controllers/parametreAdminController.js
import supabase from '../Config/db.js';

// ----------------- GET : récupérer tous les paramètres -----------------
export const getParametres = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('parametres')
      .select('*')
      .limit(1)
      .single();

    if (error) return res.status(500).json({ message: 'Erreur serveur', erreur: error.message });

    res.json({ parametres: data });
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

    // On ne met à jour que les champs fournis
    if (company_name) updates.company_name = company_name.trim();
    if (company_address) updates.company_address = company_address.trim();
    if (company_email) updates.company_email = company_email.trim();
    if (invoice_prefix) updates.invoice_prefix = invoice_prefix.trim();
    if (tax_rate !== undefined) updates.tax_rate = tax_rate;
    if (theme) updates.theme = theme;
    if (email_alerts !== undefined) updates.email_alerts = email_alerts;
    if (dashboard_alerts !== undefined) updates.dashboard_alerts = dashboard_alerts;
    if (two_factor_enabled !== undefined) updates.two_factor_enabled = two_factor_enabled;

    const { data, error } = await supabase
      .from('parametres')
      .update(updates)
      .eq('id', 1)
      .select()
      .single();

    if (error) return res.status(500).json({ message: 'Erreur mise à jour', erreur: error.message });

    res.json({ message: 'Paramètres mis à jour avec succès', parametres: data });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};
