import supabase from '../Config/db.js';
import { resolveInvoiceReferences } from '../Services/invoiceReferenceService.js';

const getAllRows = async (buildQuery) => {
  const rows = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await buildQuery().range(offset, offset + pageSize - 1);
    if (error) throw error;

    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
};

/* -------------------------------------------------
   🔹 Récupérer toutes les archives
      Optionnel : filtrage par mois, année ou type
-------------------------------------------------*/
export const getAllArchives = async (req, res) => {
  try {
    const { mois, annee, type } = req.query;

    const rows = await getAllRows(() => {
      let query = supabase
        .from('archives')
        .select('*')
        .order('date_cloture', { ascending: false });

      if (mois && annee) {
        const moisPadded = mois.toString().padStart(2, '0');
        const dateDebut = `${annee}-${moisPadded}-01`;
        const dateFin = new Date(annee, mois, 0).toISOString().slice(0, 10);

        query = query
          .gte('date_cloture', dateDebut)
          .lte('date_cloture', dateFin);
      }

      if (type) {
        query = query.eq('type_archive', type);
      }

      return query;
    });
    const data = await resolveInvoiceReferences(rows, 'ref');

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



