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
    host: process.env.SMTP_HOST,          // smtp.gmail.com
    port: Number(process.env.SMTP_PORT),  // 587
    secure: false,                        // IMPORTANT : STARTTLS = false ici
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS         // mot de passe d'application
    },
    tls: {
      rejectUnauthorized: false,
      ciphers: "SSLv3"                    // ajoute stabilité Gmail
    }
  });

  const mailOptions = {
    from: `"ASSA-AC" <${process.env.SMTP_USER}>`,
    to,
    subject: `Nouvelle facture : ${numero_facture}`,
    text: `Bonjour, une nouvelle facture ${numero_facture} a été générée pour un montant total de ${montant_total}.`,
    html: `
      <p>Bonjour,</p>
      <p>Une nouvelle facture <strong>${numero_facture}</strong> a été générée.</p>
      <p>Montant : <strong>${montant_total}</strong> XAF</p>
      <br>
      <p>Cordialement,<br><strong>ASSA-AC</strong></p>
    `
  };

  return transporter.sendMail(mailOptions);
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
    id_companie
  } = req.body;

  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (!['Administrateur', 'Superviseur', 'Company'].includes(userRole)) {
      return res.status(403).json({ message: 'Rôle non autorisé pour créer une facture.' });
    }

    // Déterminer la compagnie
    let compagnieId = id_companie || req.user?.id_companie;

    if (!compagnieId) {
      return res.status(401).json({ message: "Aucune compagnie spécifiée pour cette facture." });
    }

    // Vérifications d’accès
    if (['Admin','Administrateur','Superviseur','Super Admin','SuperAdmin'].includes(userRole)) {
      if (!['Super Admin','SuperAdmin'].includes(userRole)) {
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

    // Générer le numéro
    const numero_facture = await generateNumeroFacture();

    // 1️⃣ Création facture
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

    // 2️⃣ Journal
    await supabase.from('journal_activite').insert([{
      id_admin: userId,
      id_companie: compagnieId,
      type_activite: 'Création',
      categorie: 'Facture',
      reference: numero_facture,
      description: `Création de la facture ${numero_facture} pour ${nom_client}`,
      utilisateur_nom: req.user.nom || null,
      utilisateur_email: req.user.email || null
    }]);

    // 3️⃣ Lignes facture
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

    // 4️⃣ Récupération email compagnie
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('email, company_name')
      .eq('id', compagnieId)
      .single();

    if (companyError) {
      console.error("Erreur récupération compagnie:", companyError);
    }

    console.log("📧 Email compagnie trouvé :", company?.email);

    // 5️⃣ Envoi email à la compagnie
    try {
      if (company?.email) {
        console.log("👉 Envoi facture à :", company.email);
        await sendInvoiceEmail(company.email, numero_facture, montant_total);
        console.log("✅ Email envoyé !");
      } else {
        console.warn("⚠ Aucune adresse email dans la compagnie :", compagnieId);
      }
    } catch (err) {
      console.error("❌ Échec envoi email :", err);
    }

    // Réponse
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
// READ : Factures de la compagnie connectée
export const getInvoicesByCompany = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const id_companie = req.user?.id_companie;

    let companyIds = [];

    /* =======================================================
       1️⃣ RÉCUPÉRATION DES COMPAGNIES ACCESSIBLES
    ======================================================== */
    if (String(userRole).toLowerCase() === "company") {
      if (id_companie) companyIds = [id_companie];
    } 
    else if (["Admin", "Administrateur", "Superviseur", "Super Admin", "SuperAdmin"].includes(userRole)) {

      // --- Companies par table admin_companies
      const { data: links } = await supabase
        .from("admin_companies")
        .select("company_id")
        .eq("admin_id", userId);

      if (links?.length) {
        companyIds = links.map(l => l.company_id).filter(Boolean);
      }

      // --- Companies dont l’admin est propriétaire
      if (!companyIds.length) {
        const { data: ownedCompanies } = await supabase
          .from("companies")
          .select("id")
          .eq("id_admin", userId);

        if (ownedCompanies?.length) {
          companyIds = ownedCompanies.map(c => c.id).filter(Boolean);
        }
      }

      if (!companyIds.length && id_companie) companyIds = [id_companie];
    }


    /* =======================================================
       2️⃣ RÉCUPÉRATION FACTURES
    ======================================================== */
    let query = supabase
      .from("factures")
      .select("*")
      .eq("archived", false);

    // Admin sauf SuperAdmin : limiter aux companies autorisées
    if (!["Super Admin", "SuperAdmin"].includes(userRole)) {
      if (companyIds.length) query = query.in("id_companie", companyIds);
      else return res.status(200).json([]);
    }

    const { data: invoices, error } = await query.order("date_emission", { ascending: false });

    if (error) throw error;
    if (!invoices) return res.status(404).json({ message: "Aucune facture trouvée" });


    /* =======================================================
       3️⃣ RÉCUPÉRER PREUVES DE PAIEMENT
    ======================================================== */
    const { data: proofs } = await supabase
      .from("preuve_paiement")
      .select("numero_facture, fichier_url");

    const proofMap = {};
    proofs?.forEach(p => {
      proofMap[p.numero_facture] = p.fichier_url;
    });


    /* =======================================================
       4️⃣ RÉCUPÉRER CONTESTATIONS (JSONB correct)
    ======================================================== */
    const { data: contestations } = await supabase
      .from("contestation")
      .select("*");

    const contestMap = {};

    contestations?.forEach(c => {

      // fichiers est JSONB → déjà un array
      const fichiers = Array.isArray(c.fichiers) ? c.fichiers : [];

      contestMap[c.facture_id] = {
        explication: c.explication,
        statut: c.statut,
        date_contestation: c.date_contestation,
        fichiers: fichiers,
        fichier_url: fichiers.length ? fichiers[0].file_url : null,
        file_name: fichiers.length ? fichiers[0].file_name : null
      };
    });


    /* =======================================================
       5️⃣ CONSTRUIRE RÉSULTAT FINAL
    ======================================================== */
    const result = invoices.map(f => ({
      id: f.id,
      numero_facture: f.numero_facture,
      date: f.date_emission || "",
      amount: Number(f.montant_total || 0),
      status: f.statut || "Impayée",
      due_date: f.date_limite || "",
      client: f.nom_client,

      // Preuve de paiement
      preuve_paiement_url: proofMap[f.numero_facture] || null,

      // Contestation JSONB
      contestation: contestMap[f.id] || null
    }));


    return res.status(200).json(result);

  } catch (err) {
    console.error("❌ Erreur getInvoicesByCompany:", err);
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};


// ===============================================================
// READ : Facture par numéro
// ===============================================================
export const getFactureByNumero = async (req, res) => {
  try {
    const { numero_facture } = req.params;
    const id_companie = req.user?.id_companie;

    const numero_decoded = decodeURIComponent(numero_facture);

    console.log("🔍 Numéro reçu :", numero_facture);
    console.log("🔓 Numéro décodé :", numero_decoded);

    const { data: facture, error } = await supabase
      .from('factures')
      .select('*')
      .eq('numero_facture', numero_decoded)
      .eq('id_companie', id_companie)
      .eq('archived', false)
      .single();

    if (error || !facture)
      return res.status(404).json({ message: 'Facture non trouvée' });

    const { data: lignes, error: lignesError } = await supabase
      .from('lignes_facture')
      .select('*')
      .eq('numero_facture', numero_decoded)
      .order('numero_ligne');

    if (lignesError) throw lignesError;

    res.status(200).json({ facture, lignes });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Erreur récupération facture',
      error: err.message
    });
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
      id_admin: req.user.id,
      id_companie,
      type_activite: 'Modification',
      categorie: 'Facture',
      reference: numero_facture,
      description: `Mise à jour de la facture ${numero_facture} (${nom_client})`,
      utilisateur_nom: req.user.nom || null,
      utilisateur_email: req.user.email || null
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
      id_admin: req.user.id,
      id_companie,
      type_activite: 'Archivage',
      categorie: 'Facture',
      reference: numero_facture,
      description: `Facture ${numero_facture} archivée`,
      utilisateur_nom: req.user.nom || null,
      utilisateur_email: req.user.email || null
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
      id_admin: req.user.id,
      id_companie,
      type_activite: 'Statut',
      categorie: 'Facture',
      reference: numero_facture,
      description: `Statut mis à jour : ${statut} pour la facture ${numero_facture}`,
      utilisateur_nom: req.user.nom || null,
      utilisateur_email: req.user.email || null
    }]);
    

    res.status(200).json({ success: true, message: `Statut mis à jour en "${statut}"`, facture: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur mise à jour statut', error: err.message });
  }
};

export const confirmerFacture = async (req, res) => {
  try {
    let numero_facture = decodeURIComponent(req.params.numero_facture);

    const { data: facture, error } = await supabase
      .from("factures")
      .select("*")
      .eq("numero_facture", numero_facture)
      .single();

    if (error || !facture) {
      return res.status(404).json({ message: "Facture introuvable." });
    }

    const { data: updated, error: updateError } = await supabase
      .from("factures")
      .update({ statut: "Payée", updated_at: new Date() })
      .eq("numero_facture", numero_facture)
      .select()
      .single();

      await supabase.from('journal_activite').insert([{
        id_admin: req.user.id,
        id_companie: facture.id_companie,
        type_activite: 'Confirmation',
        categorie: 'Facture',
        reference: numero_facture,
        description: `Confirmation du paiement de la facture ${numero_facture}`,
        utilisateur_nom: req.user.nom || null,
        utilisateur_email: req.user.email || null
      }]);
      
    res.json({
      success: true,
      message: "Facture confirmée",
      facture: updated
    });

  } catch (err) {
    res.status(500).json({ message: "Erreur confirmation facture" });
  }
};

// ===============================================================
// SUPPRESSION DÉFINITIVE d'une facture
// ===============================================================
export const deleteFacture = async (req, res) => {
  try {
    let numero_facture = decodeURIComponent(req.params.numero_facture);

    console.log("➡ Suppression FRONT ONLY :", numero_facture);

    // ❌ On NE SUPPRIME RIEN dans la base de données !
    return res.status(200).json({
      success: true,
      message: `Facture ${numero_facture} retirée du front uniquement.`
    });

  } catch (err) {
    console.error("Erreur suppression facture:", err);
    res.status(500).json({ message: "Erreur suppression facture", error: err.message });
  }
};
