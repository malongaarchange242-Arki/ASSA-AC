export const getAllArchives = async (req, res) => {
  try {
    const { mois, annee } = req.query;

    let query = supabase
      .from('archives')
      .select('*')
      .order('date_cloture', { ascending: false });

    if (mois && annee) {
      query = query
        .gte('date_cloture', `${annee}-${mois}-01`)
        .lte('date_cloture', `${annee}-${mois}-31`);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({ success: true, archives: data });
  } catch (err) {
    res.status(500).json({
      message: 'Erreur lors de la récupération des archives',
      error: err.message
    });
  }
};
