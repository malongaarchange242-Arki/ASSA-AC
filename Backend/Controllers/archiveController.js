import supabase from '../Config/db.js';

/* ============================================================
   🔹 Récupérer toutes les archives
   ✅ Accessible uniquement aux admins/superviseurs
============================================================ */
export const getAllArchives = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('archives')
      .select('*')
      .order('date_cloture', { ascending: false });

    if (error) throw error;

    res.status(200).json({ success: true, archives: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la récupération des archives', error: err.message });
  }
};
