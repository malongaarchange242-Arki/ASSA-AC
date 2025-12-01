// controllers/factureController.js
import supabase from '../Config/db.js';
import nodemailer from 'nodemailer';
import { archiveFactureService } from '../Services/archiveService.js';



// ===============================================================
// Helper : Générer un numéro de facture unique (VERSION OPTIMISÉE)
// ===============================================================
export const generateNumeroFacture = async () => {
  const today = new Date();
  const mois = String(today.getMonth() + 1).padStart(2, '0');
  const annee = String(today.getFullYear()).slice(-2);
  const entreprise = "ASSA-AC";
  const service = "DAF";

  let nextNumber = 1;

  // -----------------------------
  // 1️⃣ Récupération du dernier numéro
  // -----------------------------
  const { data: lastFacture, error } = await supabase
    .from('factures')
    .select('numero_facture')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Erreur récupération dernier numéro : ${error.message}`);

  if (lastFacture?.numero_facture) {
    const lastNum = parseInt(lastFacture.numero_facture.split('/')[0]);
    if (!isNaN(lastNum)) nextNumber = lastNum + 1;
  }

  // -----------------------------
  // 2️⃣ Génération du numéro
  // -----------------------------
  let numero = `
    ${String(nextNumber).padStart(3, '0')}/${mois}/${annee}/${entreprise}/${service}
  `.replace(/\s+/g, '');

  // -----------------------------
  // 3️⃣ Vérification d'un numéro dupliqué
  // -----------------------------
  while (true) {
    const { data: exists, error: checkError } = await supabase
      .from('factures')
      .select('numero_facture')
      .eq('numero_facture', numero)
      .maybeSingle();

    if (checkError) throw checkError;

    if (!exists) break;  // <-- Numéro disponible

    nextNumber++;
    numero = `
      ${String(nextNumber).padStart(3, '0')}/${mois}/${annee}/${entreprise}/${service}
    `.replace(/\s+/g, '');
  }

  return numero;
};



// ===============================================================
// Helper : Envoyer un email de facture
// ===============================================================
const sendInvoiceEmail = async (to, numero_facture, montant_total) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: false }
  });


  const mailOptions = {
    from: `"ASSA-AC" <${process.env.SMTP_USER}>`,
    to,
    subject: `Nouvelle facture : ${numero_facture}`,
    text: `Bonjour,\n\nUne nouvelle facture (${numero_facture}) a été générée pour un montant total de ${montant_total}.\n\nMerci.`,
    html: `<p>Bonjour,</p><p>Une nouvelle facture (<strong>${numero_facture}</strong>) a été générée pour un montant total de <strong>${montant_total}</strong>.</p><p>Merci.</p>`
  };

  await transporter.sendMail(mailOptions);
};

// ===============================================================
// ENDPOINT : Générer une référence de facture
// ===============================================================
export const generateRef = async (req, res) => {
  try {
    const role = req.user?.role;
    const id_companie = req.user?.id_companie;
    const isAdminRole = ['Admin','Administrateur','Superviseur','Super Admin','SuperAdmin'].includes(role);
    const isCompanyRole = String(role).toLowerCase() === 'company';
    if (!isAdminRole && !(isCompanyRole && id_companie)) {
      return res.status(401).json({ message: 'Utilisateur non autorisé' });
    }

    const numero_facture = await generateNumeroFacture();
    res.status(200).json({ numero_facture });
  } catch (err) {
    console.error('Erreur génération référence :', err);
    res.status(500).json({ message: 'Erreur génération référence', error: err.message });
  }
};

export const createFacture = async (req, res) => {
  const {
    nom_client,
    objet,
    periode,
    aeroport,
    date_emission,
    lieu_emission,
    montant_total,
    devise,
    montant_en_lettres,
    lignes,
    id_companie // <-- nouvelle possibilité : passer l'ID de la compagnie
  } = req.body;

  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // Vérification du rôle
    if (!['Administrateur', 'Superviseur', 'Company'].includes(userRole)) {
      return res.status(403).json({ message: 'Rôle non autorisé pour créer une facture.' });
    }

    // Déterminer l'ID de la compagnie : soit depuis le body, soit depuis l'utilisateur
    let compagnieId = id_companie || req.user?.id_companie;

    if (!compagnieId) {
      return res.status(401).json({ message: "Aucune compagnie spécifiée pour cette facture." });
    }

    if (['Admin','Administrateur','Superviseur','Super Admin','SuperAdmin'].includes(userRole)) {
      if (['Super Admin','SuperAdmin'].includes(userRole)) {
        // accès total
      } else {
        const { data: link } = await supabase
          .from('admin_companies')
          .select('company_id')
          .eq('admin_id', userId)
          .eq('company_id', compagnieId)
          .maybeSingle();
        if (!link) {
          return res.status(403).json({ message: "Vous n'avez pas l'autorisation de créer une facture pour cette compagnie." });
        }
      }
    } else if (String(userRole).toLowerCase() === 'company') {
      if (req.user?.id_companie !== compagnieId) {
        return res.status(403).json({ message: "Accès refusé pour cette compagnie." });
      }
    }

    // Génération du numéro de facture
    const numero_facture = await generateNumeroFacture();

    // 1️⃣ Création de la facture
    const { data: factureData, error: factureError } = await supabase
      .from('factures')
      .insert([{
        numero_facture,
        nom_client,
        objet,
        periode,
        aeroport,
        date_emission,
        lieu_emission,
        montant_total,
        devise: devise || 'Frs CFA',
        montant_en_lettres,
        id_admin: userId,
        id_companie: compagnieId,
        statut: 'Impayée',
        archived: false
      }])
      .select()
      .single();

    if (factureError) throw factureError;

    // 2️⃣ Journal d'activité
    await supabase.from('journal_activite').insert([{
      id_admin: userId,
      id_companie: compagnieId,
      type_activite: 'Création',
      categorie: 'Facture',
      reference: numero_facture,
      description: `Création facture ${numero_facture} pour ${nom_client}`
    }]);

    

    // 4️⃣ Insertion des lignes facture
    if (lignes?.length) {
      const lignesToInsert = lignes.map(l => ({
        numero_facture,
        numero_ligne: l.numero_ligne,
        designation: l.designation,
        destination: l.destination,
        nombre_passagers: l.nombre_passagers,
        cout_unitaire: l.cout_unitaire,
        cout_total: l.cout_total
      }));

      const { error: lignesError } = await supabase
        .from('lignes_facture')
        .insert(lignesToInsert);

      if (lignesError) throw lignesError;
    }

    // 5️⃣ Envoi email
    try {
      await sendInvoiceEmail(req.user.email, numero_facture, montant_total);
    } catch (err) {
      console.error('Erreur email:', err);
    }

    res.status(201).json({
      success: true,
      message: 'Facture créée avec succès',
      facture: factureData,
      numero_facture
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Erreur création facture',
      error: err.message
    });
  }
};

// READ : Factures de la compagnie connectée
export const getInvoicesByCompany = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const id_companie = req.user?.id_companie;

    let companyIds = [];
    if (String(userRole).toLowerCase() === 'company') {
      if (id_companie) companyIds = [id_companie];
    } else if (['Admin','Administrateur','Superviseur','Super Admin','SuperAdmin'].includes(userRole)) {
      // Essayer via table de liaison admin_companies
      const { data: links, error: linksError } = await supabase
        .from('admin_companies')
        .select('company_id')
        .eq('admin_id', userId);
      if (!linksError && Array.isArray(links) && links.length) {
        companyIds = links.map(l => l.company_id).filter(Boolean);
      }
      // Fallback: champ direct id_admin dans companies
      if (!companyIds.length) {
        const { data: ownedCompanies, error: ownedError } = await supabase
          .from('companies')
          .select('id')
          .eq('id_admin', userId);
        if (!ownedError && Array.isArray(ownedCompanies) && ownedCompanies.length) {
          companyIds = ownedCompanies.map(c => c.id).filter(Boolean);
        }
      }
      // Si toujours rien et un id_companie existe dans le JWT, l'ajouter
      if (!companyIds.length && id_companie) companyIds = [id_companie];
    }

    let query = supabase
      .from('factures')
      .select('*')
      .eq('archived', false);

    // Filtrage selon rôle
    if (['Super Admin','SuperAdmin'].includes(userRole)) {
      // Pas de filtre supplémentaire
    } else if (companyIds.length) {
      query = query.in('id_companie', companyIds);
    } else {
      // Aucun périmètre accessible
      return res.status(200).json([]);
    }

    // Récupération et tri par date d'émission décroissante
    const { data: invoices, error } = await query.order('date_emission', { ascending: false });

    if (error) throw error;

    // Vérification du résultat
    if (!invoices) return res.status(404).json({ message: 'Aucune facture trouvée' });

    // Formatage pour le frontend
    const result = invoices.map(f => ({
      id: f.numero_facture,
      date: f.date_emission || '',
      amount: Number(f.montant_total || 0),
      status: f.statut || 'Impayée',
      due_date: f.date_limite || '',
      client: f.nom_client
    }));

    console.log('Factures récupérées pour compagnie', id_companie, ':', invoices.map(f => f.id_companie));

    res.status(200).json(result);

  } catch (err) {
    console.error("Erreur getInvoicesByCompany:", err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};



// ===============================================================
// READ : Facture par numéro
// ===============================================================
export const getFactureByNumero = async (req, res) => {
  try {
    const { numero_facture } = req.params;
    const id_companie = req.user?.id_companie;

    const { data: facture, error } = await supabase
      .from('factures')
      .select('*')
      .eq('numero_facture', numero_facture)
      .eq('id_companie', id_companie)
      .eq('archived', false)
      .single();

    if (error || !facture) return res.status(404).json({ message: 'Facture non trouvée' });

    const { data: lignes, error: lignesError } = await supabase
      .from('lignes_facture')
      .select('*')
      .eq('numero_facture', numero_facture)
      .order('numero_ligne');

    if (lignesError) throw lignesError;

    res.status(200).json({ facture, lignes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur récupération facture', error: err.message });
  }
};

// ===============================================================
// UPDATE Facture
// ===============================================================
export const updateFacture = async (req, res) => {
  try {
    const { numero_facture } = req.params;
    const id_companie = req.user?.id_companie;

    const { nom_client, objet, periode, aeroport, date_emission,
            lieu_emission, montant_total, devise, montant_en_lettres, lignes } = req.body;

    const { data: factureData, error: factureError } = await supabase
      .from('factures')
      .select('*')
      .eq('numero_facture', numero_facture)
      .eq('id_companie', id_companie)
      .eq('archived', false)
      .single();

    if (factureError || !factureData) return res.status(404).json({ message: 'Facture non trouvée ou accès refusé' });

    const { data: updatedData, error: updateError } = await supabase
      .from('factures')
      .update({ nom_client, objet, periode, aeroport, date_emission, lieu_emission, montant_total, devise, montant_en_lettres })
      .eq('numero_facture', numero_facture)
      .select()
      .single();

    if (updateError) throw updateError;

    await supabase.from('lignes_facture').delete().eq('numero_facture', numero_facture);

    if (lignes?.length) {
      const lignesToInsert = lignes.map(l => ({
        numero_facture,
        numero_ligne: l.numero_ligne,
        designation: l.designation,
        destination: l.destination,
        nombre_passagers: l.nombre_passagers,
        cout_unitaire: l.cout_unitaire,
        cout_total: l.cout_total
      }));
      const { error: lignesError } = await supabase.from('lignes_facture').insert(lignesToInsert);
      if (lignesError) throw lignesError;
    }

    await supabase.from('journal_activite').insert([{
      id_admin: req.user?.id,
      id_companie,
      type_activite: 'Modification',
      categorie: 'Facture',
      reference: numero_facture,
      description: `Mise à jour de la facture ${numero_facture} pour ${nom_client}`
    }]);

    res.status(200).json({ message: 'Facture mise à jour', facture: updatedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur mise à jour facture', error: err.message });
  }
};

// ===============================================================
// SOFT DELETE : Archiver une facture
// ===============================================================
export const archiveFacture = async (req, res) => {
  try {
    const { numero_facture } = req.params;
    const id_companie = req.user?.id_companie;

    // Vérification facture existante et non archivée
    const { data: factureData, error } = await supabase
      .from('factures')
      .select('*')
      .eq('numero_facture', numero_facture)
      .eq('id_companie', id_companie)
      .eq('archived', false)
      .single();

    if (error || !factureData) {
      return res.status(404).json({ message: 'Facture non trouvée ou déjà archivée' });
    }

    // Mise à jour du statut et archivage dans factures
    await supabase
      .from('factures')
      .update({ archived: true, statut: 'Archivée' })
      .eq('numero_facture', numero_facture);

    // Journal d'activité
    await supabase.from('journal_activite').insert([{
      id_admin: req.user?.id,
      id_companie,
      type_activite: 'Archivage',
      categorie: 'Facture',
      reference: numero_facture,
      description: `Facture ${numero_facture} archivée`
    }]);

    // Création d’une entrée dans la table archives
    await createArchive({
      type: 'Archivage de facture',
      description: `L'administrateur ${req.user?.email} a archivé la facture ${numero_facture}.`,
      reference: numero_facture,
      fichier_url: null
    });

    res.status(200).json({ message: 'Facture archivée avec succès', facture: factureData });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur archivage facture', error: err.message });
  }
};

// ===============================================================
// UPDATE Statut facture
// ===============================================================
export const updateFactureStatut = async (req, res) => {
  try {
    const { numero_facture, statut } = req.body;
    const id_companie = req.user?.id_companie;

    const statutsAutorises = ['Impayée', 'Payée', 'Contestée', 'Archivée'];
    if (!statutsAutorises.includes(statut)) return res.status(400).json({ message: `Statut invalide. Valeurs possibles : ${statutsAutorises.join(', ')}` });

    const { data, error } = await supabase
      .from('factures')
      .update({ statut })
      .eq('numero_facture', numero_facture)
      .eq('id_companie', id_companie)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ message: 'Facture non trouvée ou accès refusé' });

    await supabase.from('journal_activite').insert([{
      id_admin: req.user?.id,
      id_companie,
      type_activite: 'Mise à jour statut',
      categorie: 'Facture',
      reference: numero_facture,
      description: `Le statut de la facture ${numero_facture} est passé à ${statut}`
    }]);

    res.status(200).json({ success: true, message: `Statut mis à jour en "${statut}"`, facture: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur mise à jour statut', error: err.message });
  }
};
