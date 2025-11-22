import supabase from '../Config/db.js';

/* -------------------------------------------------
   🔹 Récupérer toutes les archives
      Optionnel : filtrage par mois, année ou type
-------------------------------------------------*/
export const getAllArchives = async (req, res) => {
  try {
    const { mois, annee, type } = req.query;

    // 1️⃣ Construction de la requête de base
    let query = supabase
      .from('archives')
      .select('*')
      .order('date_cloture', { ascending: false });

    // 2️⃣ Filtrage par mois + année si fourni
    if (mois && annee) {
      const moisPadded = mois.toString().padStart(2, '0');
      const dateDebut = `${annee}-${moisPadded}-01`;

      // dernier jour du mois
      const dateFin = new Date(annee, mois, 0)  // retourne dernier jour du mois
        .toISOString()
        .slice(0, 10);

      query = query
        .gte('date_cloture', dateDebut)
        .lte('date_cloture', dateFin);
    }

    // 3️⃣ Filtrage par type si fourni
    if (type) {
      query = query.eq('type_archive', type);
    }

    // 4️⃣ Exécution de la requête
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
