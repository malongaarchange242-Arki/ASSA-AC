// controllers/factureController.js
import supabase from '../Config/db.js';
import nodemailer from 'nodemailer';
import { createArchive } from '../Services/archiveService.js';
import { logActivite } from '../Services/journalService.js'; // ✅ AJOUT ICI




// ===============================================================
// Helper : Générer un numéro de facture unique (VERSION OPTIMISÉE)
// ===============================================================
export const generateNumeroFacture = async (compagnieId, dateStr) => {
  // Génération atomique d'un numéro de facture au format:
  // CODE_AEROPORT-XXX/MM/YYYY/ASSA-AC/DAF
  // - compteur spécifique par airport code
  // - réinitialisé chaque mois/année
  // - utilise une fonction PL/pgSQL `increment_invoice_counter` pour l'atomicité

  const entreprise = 'ASSA-AC';
  const service = 'DAF';

  const date = dateStr ? new Date(dateStr) : new Date();
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const anneeFull = date.getFullYear();

  if (!compagnieId) throw new Error('compagnieId requis pour générer la référence');

  // Récupérer le code aéroport de la compagnie
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('airport_code')
    .eq('id', compagnieId)
    .maybeSingle();

  if (companyError) throw new Error(`Erreur récupération compagnie : ${companyError.message}`);

  const airportCode = (company?.airport_code || 'UNK').toString().trim().toUpperCase();

  // Essayer d'utiliser la fonction SQL atomique `increment_invoice_counter`
  let counter = null;
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('increment_invoice_counter', {
      p_airport_code: airportCode,
      p_year: anneeFull,
      p_month: Number(mois)
    });

    if (rpcError) throw rpcError;

    // supabase.rpc peut retourner différentes formes selon la fonction;
    // gérer les cas usuels
    if (rpcData == null) {
      counter = null;
    } else if (typeof rpcData === 'number') {
      counter = rpcData;
    } else if (Array.isArray(rpcData) && rpcData.length && typeof rpcData[0] === 'number') {
      counter = rpcData[0];
    } else if (Array.isArray(rpcData) && rpcData.length && rpcData[0].increment_invoice_counter) {
      counter = rpcData[0].increment_invoice_counter;
    } else if (rpcData.increment_invoice_counter) {
      counter = rpcData.increment_invoice_counter;
    }
  } catch (rpcErr) {
    console.warn('RPC increment_invoice_counter failed, fallback:', rpcErr.message || rpcErr);
    counter = null;
  }

  // Fallback non-transactionnel (si la fonction SQL n'est pas installée)
  if (!counter) {
    // Rechercher la dernière facture pour ce code aéroport + mois/année
    const likePattern = `${airportCode}-%/${mois}/${anneeFull}/%`;
    const { data: lastFacture, error: lastError } = await supabase
      .from('factures')
      .select('numero_facture')
      .like('numero_facture', likePattern)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) throw new Error(`Erreur récupération dernier numéro fallback : ${lastError.message}`);

    let nextNumber = 1;
    if (lastFacture?.numero_facture) {
      try {
        const parts = lastFacture.numero_facture.split('-');
        const tail = parts[1] || '';
        const numStr = tail.split('/')[0];
        const lastNum = parseInt(numStr, 10);
        if (!isNaN(lastNum)) nextNumber = lastNum + 1;
      } catch {}
    }

    counter = nextNumber;
  }

  const counterStr = String(counter).padStart(3, '0');
  const numero = `${airportCode}-${counterStr}/${mois}/${anneeFull}/${entreprise}/${service}`;
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
    const rawRole = String(req.user?.role || '').toLowerCase();
    const id_companie = req.user?.id_companie;

    // Normalized allowed roles (compare lowercase normalized values)
    const adminRoles = ['administrateur', 'admin', 'superviseur', 'super_directeur', 'super_directeur', 'superadmin', 'super_admin', 'operateur'];
    const isAdminRole = adminRoles.includes(rawRole);
    const isCompanyRole = rawRole === 'company' || rawRole === 'compagnie';

    // Allow admin roles, or company users that have an associated company id
    if (!isAdminRole && !(isCompanyRole && id_companie)) {
      return res.status(401).json({ message: 'Utilisateur non autorisé' });
    }

    // Allow admins to pass a target company id via body/query; companies use their own id
    const requestedCompany = req.body?.id_companie || req.query?.id_companie || id_companie;

    // If admin requested another company, verify permission
    let targetCompanyId = requestedCompany;
    if (isAdminRole && requestedCompany && !['super_directeur','superadmin','super_admin','super admin'].includes(rawRole)) {
      const { data: link } = await supabase
        .from('admin_companies')
        .select('company_id')
        .eq('admin_id', req.user.id)
        .eq('company_id', requestedCompany)
        .maybeSingle();
      if (!link) return res.status(403).json({ message: "Vous n'avez pas l'autorisation pour cette compagnie." });
    }

    if (!targetCompanyId) return res.status(400).json({ message: 'id_companie requis pour générer la référence' });

    const numero_facture = await generateNumeroFacture(targetCompanyId);
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
    const userId = req.user?.id;
    const rawUserRole = String(req.user?.role || '').toLowerCase().trim();

    // Allowed roles (normalized): opérateurs, companies et administrateurs
    const allowedCreateRoles = ['operateur', 'operator', 'company', 'compagnie', 'administrateur', 'admin'];
    if (!allowedCreateRoles.includes(rawUserRole)) {
      return res.status(403).json({ message: 'Rôle non autorisé pour créer une facture.' });
    }

    // Déterminer la compagnie
    let compagnieId = id_companie || req.user?.id_companie;

    if (!compagnieId) {
      return res.status(401).json({ message: "Aucune compagnie spécifiée pour cette facture." });
    }

    // Vérifications d’accès
    const adminLike = ['admin', 'administrateur', 'superviseur', 'super_directeur', 'superadmin', 'super_admin', 'operateur'];
    const isAdminLike = adminLike.includes(rawUserRole);
    const isSuperAdmin = ['super_directeur', 'superadmin', 'super_admin', 'super admin'].includes(rawUserRole);

    if (isAdminLike) {
      if (!isSuperAdmin) {
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
    } else if (rawUserRole === 'company') {
      if (req.user?.id_companie !== compagnieId) {
        return res.status(403).json({ message: "Accès refusé pour cette compagnie." });
      }
    }

    // Générer le numéro (utilise le code aéroport de la compagnie)
    const numero_facture = await generateNumeroFacture(compagnieId, date_emission);

    // created_by: if the actor is an operateur, save their id for traceability
    const created_by = ['operateur', 'operator'].includes(rawUserRole) ? req.user?.id : null;

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
        statut: 'Impayée',
        id_admin: userId,
        id_companie: compagnieId,
        created_by,
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

// ===============================================================
// OPERATOR: soumettre une facture au DAF pour validation
// ===============================================================
export const submitFactureForValidation = async (req, res) => {
  try {
    const role = req.user?.role;
    if (!['Operateur', 'Operator'].includes(role)) return res.status(403).json({ message: 'Action réservée aux opérateurs' });

    const numero = req.params.numero_facture;
    if (!numero) return res.status(400).json({ message: 'numero_facture requis' });

    // Ensure invoice exists
    const { data: facture, error: fErr } = await supabase
      .from('factures')
      .select('*')
      .eq('numero_facture', numero)
      .maybeSingle();

    if (fErr) throw fErr;
    if (!facture) return res.status(404).json({ message: 'Facture introuvable' });

    // Journaliser la soumission
    await logActivite({
      module: 'Factures', type_activite: 'submit', categorie: 'Facture', reference: numero,
      description: `Soumission de la facture ${numero} au DAF pour validation`, id_admin: req.user?.id, id_companie: facture.id_companie
    });

    res.status(200).json({ success: true, message: 'Facture soumise au DAF' });
  } catch (err) {
    console.error('submitFactureForValidation error:', err);
    res.status(500).json({ message: 'Erreur soumission facture', error: err.message });
  }
};

// ===============================================================
// DAF: valider une facture
// ===============================================================
export const validateFacture = async (req, res) => {
  try {
    const role = req.user?.role;
    if (!['Superviseur', 'DAF'].includes(role)) return res.status(403).json({ message: 'Action réservée au DAF' });

    const numero = req.params.numero_facture;
    if (!numero) return res.status(400).json({ message: 'numero_facture requis' });

    // Update validated_by and validated_at
    const { data, error } = await supabase
      .from('factures')
      .update({ validated_by: req.user?.id, validated_at: new Date().toISOString() })
      .eq('numero_facture', numero)
      .select()
      .single();

    if (error) throw error;

    await logActivite({
      module: 'Factures', type_activite: 'validate', categorie: 'Facture', reference: numero,
      description: `Validation de la facture ${numero} par DAF`, id_admin: req.user?.id, id_companie: data.id_companie
    });

    res.status(200).json({ success: true, message: 'Facture validée', facture: data });
  } catch (err) {
    console.error('validateFacture error:', err);
    res.status(500).json({ message: 'Erreur validation facture', error: err.message });
  }
};

// ===============================================================
// DAF: rejeter une facture
// ===============================================================
export const rejectFacture = async (req, res) => {
  try {
    const role = req.user?.role;
    if (!['Superviseur', 'DAF'].includes(role)) return res.status(403).json({ message: 'Action réservée au DAF' });

    const numero = req.params.numero_facture;
    const { reason } = req.body;
    if (!numero) return res.status(400).json({ message: 'numero_facture requis' });

    // Journaliser le rejet
    await logActivite({
      module: 'Factures', type_activite: 'reject', categorie: 'Facture', reference: numero,
      description: `Rejet de la facture ${numero} par DAF. Motif: ${reason || 'non précisé'}`, id_admin: req.user?.id
    });

    res.status(200).json({ success: true, message: 'Facture rejetée' });
  } catch (err) {
    console.error('rejectFacture error:', err);
    res.status(500).json({ message: 'Erreur rejet facture', error: err.message });
  }
};


// READ : Factures de la compagnie connectée
// READ : Factures de la compagnie connectée
export const getInvoicesByCompany = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const id_companie = req.user?.id_companie;

    const normalizedRole = String(userRole || '').toLowerCase().trim();

    // 🎯 Rôles qui voient TOUTES les factures
    const fullAccessRoles = [
      'operateur',
      'superviseur',
      'super_directeur',
      'super_admin',
      'superadmin'
    ];

    let query = supabase
      .from("factures")
      .select("*")
      .eq("archived", false);

    /* =======================================================
       1️⃣ SI FULL ACCESS → PAS DE FILTRAGE
    ======================================================== */
    if (!fullAccessRoles.includes(normalizedRole)) {

      let companyIds = [];

      // Company → voit seulement sa compagnie
      if (normalizedRole === 'company' && id_companie) {
        companyIds = [id_companie];
      }

      // Admin classique → companies liées
      else if (['administrateur', 'admin'].includes(normalizedRole)) {

        const { data: links } = await supabase
          .from("admin_companies")
          .select("company_id")
          .eq("admin_id", userId);

        if (links?.length) {
          companyIds = links.map(l => l.company_id).filter(Boolean);
        }

        if (!companyIds.length) {
          const { data: ownedCompanies } = await supabase
            .from("companies")
            .select("id")
            .eq("id_admin", userId);

          if (ownedCompanies?.length) {
            companyIds = ownedCompanies.map(c => c.id).filter(Boolean);
          }
        }
      }

      if (!companyIds.length) {
        return res.status(200).json([]);
      }

      query = query.in("id_companie", companyIds);
    }

    /* =======================================================
       2️⃣ RÉCUPÉRATION FACTURES
    ======================================================== */
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
       4️⃣ CONTESTATIONS
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
        fichier_url: fichiers.length ? fichiers[0].file_url : null,
        file_name: fichiers.length ? fichiers[0].file_name : null
      };
    });

    /* =======================================================
       5️⃣ FORMAT FINAL
    ======================================================== */
    const result = invoices.map(f => ({
      id: f.id,
      numero_facture: f.numero_facture,
      date: f.date_emission || "",
      amount: Number(f.montant_total || 0),
      status: f.statut || "Impayée",
      due_date: f.date_limite || "",
      client: f.nom_client,
      preuve_paiement_url: proofMap[f.numero_facture] || null,
      contestation: contestMap[f.id] || null
    }));

    return res.status(200).json(result);

  } catch (err) {
    console.error("❌ Erreur getInvoicesByCompany:", err);
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
    // Autorisation : only OPERATOR (or the original creator) may update
    const role = req.user?.role;
    if (!['Operateur','Operator'].includes(role) && req.user?.id !== factureData.created_by) {
      return res.status(403).json({ message: 'Action réservée à l\'opérateur ayant créé la facture' });
    }

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
    }).catch(err => {
      console.error("⚠ Erreur log activité :", err.message);
      // Ne pas relancer l'erreur, laisser continuer
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
    }).catch(err => {
      console.error("⚠ Erreur archivage :", err.message);
      // Ne pas relancer l'erreur, laisser continuer
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
