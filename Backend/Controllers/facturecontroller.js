// controllers/factureController.js
import supabase from '../Config/db.js';
import nodemailer from 'nodemailer';
import { createArchive } from '../Services/archiveService.js';
import { logActivite } from '../Services/journalService.js'; // ✅ AJOUT ICI




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
    await logActivite({
      module: "Factures",
      type_activite: "create",
      categorie: "Facture",
      reference: numero_facture,
      description: `Création de la facture ${numero_facture} pour ${nom_client}`,
      id_admin: userId,
      id_companie: compagnieId
    });
    
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

    // 🔹 ARCHIVAGE (AUDIT)
    await createArchive({
      type: "Création de facture",
      ref: numero_facture,
      compagnie_id: compagnieId,
      compagnie_nom: company?.company_name || null,
      montant: montant_total,
      statut: 'Impayée',

      // 👤 Auteur réel de l’action
      admin_id: userId,
      admin_nom: req.user.nom_complet || req.user.email || 'Administrateur'
    });



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
// READ : Factures accessibles à l'utilisateur connecté
export const getInvoicesByCompany = async (req, res) => {
  try {
    /* =======================================================
       0️⃣ USER CONTEXT (SOURCE UNIQUE)
    ======================================================== */
    const userRole = req.user?.role;           // admin | supervisor | company | superadmin
    const userId = req.user?.id;
    const id_companie = req.user?.id_companie;

    let companyIds = [];

    /* =======================================================
       1️⃣ DÉTERMINER LES COMPAGNIES ACCESSIBLES
    ======================================================== */
    if (userRole === "company") {
      if (!id_companie) {
        return res.status(403).json({ message: "Compagnie non autorisée" });
      }
      companyIds = [id_companie];
    }

    else if (["admin", "supervisor"].includes(userRole)) {

      // 1. Companies liées à l’admin
      const { data: links, error: linkError } = await supabase
        .from("admin_companies")
        .select("company_id")
        .eq("admin_id", userId);

      if (linkError) throw linkError;

      if (links?.length) {
        companyIds = links.map(l => l.company_id).filter(Boolean);
      }

      // 2. Companies possédées par l’admin
      if (!companyIds.length) {
        const { data: ownedCompanies, error: ownError } = await supabase
          .from("companies")
          .select("id")
          .eq("id_admin", userId);

        if (ownError) throw ownError;

        if (ownedCompanies?.length) {
          companyIds = ownedCompanies.map(c => c.id);
        }
      }

      // 3. Fallback id_companie
      if (!companyIds.length && id_companie) {
        companyIds = [id_companie];
      }
    }

    else if (userRole === "superadmin") {
      // SuperAdmin → accès global
      companyIds = null;
    }

    else {
      return res.status(403).json({ message: "Rôle non autorisé" });
    }

    /* =======================================================
       2️⃣ RÉCUPÉRATION FACTURES (NULL SAFE)
    ======================================================== */
    let query = supabase
      .from("factures")
      .select("*")
      .or("archived.is.null,archived.eq.false");

    if (companyIds && companyIds.length) {
      query = query.in("id_companie", companyIds);
    }

    const { data: invoices, error } = await query
      .order("date_emission", { ascending: false });

    if (error) throw error;

    if (!invoices?.length) {
      return res.status(200).json([]);
    }

    /* =======================================================
       3️⃣ PREUVES DE PAIEMENT
    ======================================================== */
    const { data: proofs } = await supabase
      .from("preuve_paiement")
      .select("numero_facture, fichier_url");

    const proofMap = {};
    proofs?.forEach(p => {
      proofMap[p.numero_facture] = p.fichier_url;
    });

    /* =======================================================
       4️⃣ CONTESTATIONS (JSONB SAFE)
    ======================================================== */
    const { data: contestations } = await supabase
      .from("contestation")
      .select("*");

    const contestMap = {};
    contestations?.forEach(c => {
      const fichiers = Array.isArray(c.fichiers) ? c.fichiers : [];
      contestMap[c.facture_id] = {
        explication: c.explication,
        statut: c.statut,
        date_contestation: c.date_contestation,
        fichiers,
        fichier_url: fichiers[0]?.file_url || null,
        file_name: fichiers[0]?.file_name || null
      };
    });

    /* =======================================================
       5️⃣ FORMAT FINAL POUR LE FRONT
    ======================================================== */
    const result = invoices.map(f => ({
      id: f.id,
      numero_facture: f.numero_facture,
      date: f.date_emission,
      due_date: f.date_limite,
      amount: Number(f.montant_total || 0),
      status: f.statut || "Impayée",
      client: f.nom_client,

      preuve_paiement_url: proofMap[f.numero_facture] || null,
      contestation: contestMap[f.id] || null
    }));

    return res.status(200).json(result);

  } catch (err) {
    console.error("❌ getInvoicesByCompany ERROR:", err);
    return res.status(500).json({
      message: "Erreur serveur",
      error: err.message
    });
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

    await logActivite({
      module: "Factures",
      type_activite: "update",
      categorie: "Facture",
      reference: numero_facture,
      description: `Mise à jour de la facture ${numero_facture} (${nom_client})`,
      id_admin: req.user.id,
      id_companie
    });
    
    

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
    await logActivite({
      module: "Factures",
      type_activite: "archive",
      categorie: "Facture",
      reference: numero_facture,
      description: `Facture ${numero_facture} archivée`,
      id_admin: req.user.id,
      id_companie
    });
    
    

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

    await logActivite({
      module: "Factures",
      type_activite: "update",
      categorie: "Facture",
      reference: numero_facture,
      description: `Statut de la facture mis à jour : ${statut}`,
      id_admin: req.user.id,
      id_companie
    });
    
    

    res.status(200).json({ success: true, message: `Statut mis à jour en "${statut}"`, facture: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur mise à jour statut', error: err.message });
  }
};

// ===============================================================
// 📧 EMAIL : Confirmation de paiement facture
// ===============================================================
const sendPaymentConfirmationEmail = async (
  to,
  numero_facture,
  montant_total,
  company_name
) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const mailOptions = {
    from: `"ASSA-AC" <${process.env.SMTP_USER}>`,
    to,
    subject: `Confirmation de paiement – Facture ${numero_facture}`,
    text: `
Bonjour,

Nous confirmons la réception du paiement de la facture ${numero_facture}.
Montant : ${montant_total} XAF

Merci pour votre confiance.

ASSA-AC
    `,
    html: `
      <p>Bonjour,</p>

      <p>Nous confirmons la réception du paiement de la facture suivante :</p>

      <ul>
        <li><strong>Facture :</strong> ${numero_facture}</li>
        <li><strong>Montant :</strong> ${montant_total} XAF</li>
        <li><strong>Compagnie :</strong> ${company_name || '-'}</li>
        <li><strong>Statut :</strong> <span style="color:green;">Payée</span></li>
      </ul>

      <p>Merci pour votre confiance.</p>

      <p>
        Cordialement,<br>
        <strong>ASSA-AC</strong>
      </p>
    `
  };

  return transporter.sendMail(mailOptions);
};


export const confirmerFacture = async (req, res) => {
  try {
    const numero_facture = decodeURIComponent(req.params.numero_facture);

    /* =======================================================
       1️⃣ RÉCUPÉRATION FACTURE
    ======================================================== */
    const { data: facture, error: factureError } = await supabase
      .from("factures")
      .select("*")
      .eq("numero_facture", numero_facture)
      .single();

    if (factureError || !facture) {
      return res.status(404).json({ message: "Facture introuvable." });
    }

    /* =======================================================
       2️⃣ DÉJÀ PAYÉE ?
    ======================================================== */
    if (facture.statut === "Payée") {
      return res.status(400).json({
        message: "Cette facture est déjà confirmée payée."
      });
    }

    /* =======================================================
       3️⃣ MISE À JOUR STATUT
    ======================================================== */
    const { data: updatedFacture, error: updateError } = await supabase
      .from("factures")
      .update({
        statut: "Payée",
        updated_at: new Date()
      })
      .eq("numero_facture", numero_facture)
      .select()
      .single();

    if (updateError) throw updateError;

    /* =======================================================
       4️⃣ RÉCUPÉRATION COMPAGNIE
    ======================================================== */
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("company_name, email")
      .eq("id", facture.id_companie)
      .single();

    if (companyError) {
      console.warn("⚠ Erreur récupération compagnie :", companyError.message);
    }

    /* =======================================================
       5️⃣ JOURNAL D’ACTIVITÉ
    ======================================================== */
    await logActivite({
      module: "Factures",
      type_activite: "update",
      categorie: "Facture",
      reference: numero_facture,
      description: `Confirmation du paiement de la facture ${numero_facture}`,
      id_admin: req.user.id,
      id_companie: facture.id_companie,
      utilisateur_nom:
        req.user.nom_complet ||
        req.user.email ||
        "Administrateur",
      utilisateur_email: req.user.email || null
    });

    /* =======================================================
       6️⃣ ARCHIVAGE (AUDIT)
    ======================================================== */
    await createArchive({
      type: "Confirmation de paiement",
      ref: numero_facture,
      compagnie_id: facture.id_companie,
      compagnie_nom: company?.company_name || null,
      montant: facture.montant_total,
      statut: "Payée",
      admin_id: req.user.id,
      admin_nom:
        req.user.nom_complet ||
        req.user.nom ||
        req.user.email ||
        "Administrateur"
    });

    /* =======================================================
       7️⃣ ENVOI EMAIL (NON BLOQUANT)
    ======================================================== */
    try {
      if (company?.email) {
        await sendPaymentConfirmationEmail(
          company.email,
          numero_facture,
          facture.montant_total,
          company.company_name
        );
        console.log("📧 Email confirmation paiement envoyé à", company.email);
      }
    } catch (mailErr) {
      console.error("❌ Erreur envoi email confirmation :", mailErr.message);
    }

    /* =======================================================
       8️⃣ RÉPONSE
    ======================================================== */
    return res.status(200).json({
      success: true,
      message: "Facture confirmée et notification envoyée",
      facture: updatedFacture
    });

  } catch (err) {
    console.error("❌ Erreur confirmerFacture :", err);
    return res.status(500).json({
      message: "Erreur confirmation facture",
      error: err.message
    });
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
