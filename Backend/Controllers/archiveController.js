export const getAllArchives = async (req, res) => {
  try {
    const { mois, annee } = req.query;

    let query = supabase
      .from('archives')
      .select('*')
      .order('date_cloture', { ascending: false });

    // Filtre par mois + année
    if (mois && annee) {
      const moisPadded = mois.toString().padStart(2, '0');

      const dateDebut = `${annee}-${moisPadded}-01`;
      const dateFin = new Date(annee, mois, 0) // magique !
        .toISOString()
        .slice(0, 10); // YYYY-MM-DD

      query = query
        .gte('date_cloture', dateDebut)
        .lte('date_cloture', dateFin);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      archives: data
    });

  } catch (err) {
    res.status(500).json({
      message: 'Erreur lors de la récupération des archives',
      error: err.message
    });
  }
};


