// controllers/factureController.js
import supabase from '../Config/db.js';
import { createArchive } from '../Services/archiveService.js';
import { logActivite } from '../Services/journalService.js'; // ✅ AJOUT ICI
import { generateInvoicePdf } from '../Services/invoicePdfService.js';
import { sendEmail } from '../Services/emailService.js';




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
const sendInvoiceEmail = async (to, numero_facture, montant_total, invoicePdf) => {
  if (!Buffer.isBuffer(invoicePdf) || invoicePdf.length === 0) {
    throw new Error('Le PDF de la facture est vide ou invalide');
  }

  const info = await sendEmail({
    to,
    subject: `Nouvelle facture : ${numero_facture}`,
    text: `Bonjour,\n\nVeuillez trouver en pièce jointe la facture ${numero_facture}, d'un montant total de ${montant_total} XAF.\n\nCordialement,\nASSA-AC`,
    html: `
      <p>Bonjour,</p>
      <p>Une nouvelle facture <strong>${numero_facture}</strong> a été générée.</p>
      <p>Montant : <strong>${montant_total}</strong> XAF</p>
      <p>La facture est jointe à ce courriel au format PDF.</p>
      <br>
      <p>Cordialement,<br><strong>ASSA-AC</strong></p>
    `,
    attachments: [{
      filename: `facture-${String(numero_facture).replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`,
      content: invoicePdf,
      contentType: 'application/pdf'
    }]
  });
  const recipientAccepted = (info.accepted || []).some(
    recipient => String(recipient).toLowerCase() === to.trim().toLowerCase()
  );

  if (!recipientAccepted) {
    throw new Error(`Le fournisseur e-mail n'a pas accepté le destinataire ${to}`);
  }

  return info;
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
    let emailNotificationStatus = 'not_sent';
    try {
      if (company?.email) {
        const invoicePdf = await generateInvoicePdf(factureData, lignes || []);
        const emailInfo = await sendInvoiceEmail(company.email, numero_facture, montant_total, invoicePdf);
        emailNotificationStatus = 'accepted_by_provider';
        console.info('Fournisseur e-mail a accepté la notification de facture', {
          provider: emailInfo.provider,
          to: company.email,
          messageId: emailInfo.messageId,
          response: emailInfo.response
        });
      } else {
        console.warn("⚠ Aucune adresse email dans la compagnie :", compagnieId);
      }
    } catch (err) {
      emailNotificationStatus = 'failed';
      console.error("Échec de la notification de facture :", err);
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
      numero_facture,
      email_notification_status: emailNotificationStatus
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
    const role = String(req.user?.role || '').trim().toLowerCase();
    if (!['operateur', 'operator'].includes(role)) return res.status(403).json({ message: 'Action réservée aux opérateurs' });

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

    const submittedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('factures')
      .update({ daf_status: 'pending', submitted_to_daf_at: submittedAt })
      .eq('numero_facture', numero);

    if (updateError) throw updateError;

    // Journaliser la soumission
    await logActivite({
      module: 'Factures', type_activite: 'submit', categorie: 'Facture', reference: numero,
      description: `Soumission de la facture ${numero} au DAF pour validation`,
      id_companie: facture.id_companie,
      utilisateur_nom: req.user?.nom_complet || req.user?.name || 'Opérateur',
      utilisateur_email: req.user?.email || null
    });

    res.status(200).json({
      success: true,
      message: 'Facture soumise au DAF',
      daf_status: 'pending',
      submitted_to_daf_at: submittedAt
    });
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
    const role = String(req.user?.role || '').trim().toLowerCase();
    if (!['superviseur', 'daf', 'super_directeur'].includes(role)) return res.status(403).json({ message: 'Action réservée au DAF' });

    const numero = req.params.numero_facture;
    if (!numero) return res.status(400).json({ message: 'numero_facture requis' });

    // Update the DAF workflow status separately from the payment status.
    const { data, error } = await supabase
      .from('factures')
      .update({
        validated_by: req.user?.id,
        validated_at: new Date().toISOString(),
        daf_status: 'validated'
      })
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
    const role = String(req.user?.role || '').trim().toLowerCase();
    if (!['superviseur', 'daf', 'super_directeur'].includes(role)) return res.status(403).json({ message: 'Action réservée au DAF' });

    const numero = req.params.numero_facture;
    const { reason } = req.body;
    if (!numero) return res.status(400).json({ message: 'numero_facture requis' });

    const { data: facture, error: updateError } = await supabase
      .from('factures')
      .update({ daf_status: 'rejected' })
      .eq('numero_facture', numero)
      .select('id_companie')
      .maybeSingle();

    if (updateError) throw updateError;
    if (!facture) return res.status(404).json({ message: 'Facture introuvable' });

    // Journaliser le rejet
    await logActivite({
      module: 'Factures', type_activite: 'reject', categorie: 'Facture', reference: numero,
      description: `Rejet de la facture ${numero} par DAF. Motif: ${reason || 'non précisé'}`, id_admin: req.user?.id, id_companie: facture.id_companie
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

      if (['administrateur', 'admin'].includes(normalizedRole)) {
        if (companyIds.length) {
          query = query.or(`id_admin.eq.${userId},id_companie.in.(${companyIds.join(',')})`);
        } else if (userId) {
          query = query.eq('id_admin', userId);
        } else {
          return res.status(200).json([]);
        }
      } else if (!companyIds.length) {
        return res.status(200).json([]);
      } else {
        query = query.in("id_companie", companyIds);
      }
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
    const invoiceIdByNumber = new Map(invoices.map(f => [f.numero_facture, f.id]));
    contestations?.forEach(c => {
      const fichiers = Array.isArray(c.fichiers) ? c.fichiers : [];

      contestMap[c.numero_facture] = {
        facture_id: invoiceIdByNumber.get(c.numero_facture) || null,
        numero_facture: c.numero_facture,
        explication: c.explication,
        statut: c.status,
        date_contestation: c.created_at,
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
      id_companie: f.id_companie,
      numero_facture: f.numero_facture,
      date: f.date_emission || "",
      amount: Number(f.montant_total || 0),
      status: f.statut || "Impayée",
      daf_status: f.daf_status || 'not_submitted',
      submitted_to_daf_at: f.submitted_to_daf_at || null,
      validated_at: f.validated_at || null,
      due_date: f.date_limite || "",
      client: f.nom_client,
      preuve_paiement_url: proofMap[f.numero_facture] || null,
      contestation: contestMap[f.numero_facture] || null
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
async function getAuthorizedInvoice(numero_facture, user) {
  const numeroDecoded = decodeURIComponent(numero_facture);
  const { data: facture, error } = await supabase
    .from('factures')
    .select('*')
    .eq('numero_facture', numeroDecoded)
    .eq('archived', false)
    .maybeSingle();

  if (error) throw error;
  if (!facture) return { status: 404, message: 'Facture non trouvée' };

  const role = String(user?.role || '').toLowerCase().trim();
  const userId = user?.id;
  const fullAccessRoles = ['operateur', 'operator', 'superviseur', 'super_directeur', 'superadmin', 'super_admin', 'super admin'];
  let hasAccess = fullAccessRoles.includes(role);

  if (role === 'company' || role === 'compagnie') {
    hasAccess = String(user?.id_companie || '') === String(facture.id_companie || '');
  } else if (['administrateur', 'admin'].includes(role)) {
    hasAccess = String(facture.id_admin || '') === String(userId || '');

    const { data: link, error: linkError } = await supabase
      .from('admin_companies')
      .select('company_id')
      .eq('admin_id', userId)
      .eq('company_id', facture.id_companie)
      .maybeSingle();

    if (linkError) throw linkError;
    hasAccess = hasAccess || Boolean(link);

    if (!hasAccess) {
      const { data: ownedCompany, error: ownedCompanyError } = await supabase
        .from('companies')
        .select('id')
        .eq('id', facture.id_companie)
        .eq('id_admin', userId)
        .maybeSingle();

      if (ownedCompanyError) throw ownedCompanyError;
      hasAccess = Boolean(ownedCompany);
    }
  }

  if (!hasAccess) {
    return { status: 403, message: "Vous n'êtes pas autorisé à consulter cette facture." };
  }

  const { data: lignes, error: lignesError } = await supabase
    .from('lignes_facture')
    .select('*')
    .eq('numero_facture', numeroDecoded)
    .order('numero_ligne');

  if (lignesError) throw lignesError;
  return { facture, lignes };
}

export const getFactureByNumero = async (req, res) => {
  try {
    const result = await getAuthorizedInvoice(req.params.numero_facture, req.user);
    if (result.status) return res.status(result.status).json({ message: result.message });
    res.status(200).json({ facture: result.facture, lignes: result.lignes });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Erreur récupération facture',
      error: err.message
    });
  }
};

export const getFacturePdf = async (req, res) => {
  try {
    const result = await getAuthorizedInvoice(req.params.numero_facture, req.user);
    if (result.status) return res.status(result.status).json({ message: result.message });

    const pdf = await generateInvoicePdf(result.facture, result.lignes);
    const filename = `facture-${String(result.facture.numero_facture).replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': pdf.length,
      'Cache-Control': 'private, no-store'
    });
    res.status(200).send(pdf);
  } catch (err) {
    console.error('Erreur génération PDF facture :', err);
    res.status(500).json({
      message: 'Erreur génération PDF facture',
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
  const info = await sendEmail({
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
  });
  const recipientAccepted = (info.accepted || []).some(
    recipient => String(recipient).trim().toLowerCase() === to.trim().toLowerCase()
  );

  if (!recipientAccepted) {
    const rejection = (info.rejected || []).map(String).join(', ');
    throw new Error(`Le fournisseur e-mail n'a pas accepté le destinataire${rejection ? ` : ${rejection}` : ''}`);
  }

  return {
    provider: info.provider,
    messageId: info.messageId,
    response: info.response,
    accepted: info.accepted
  };
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
      .select("company_name, email, id_admin")
      .eq("id", facture.id_companie)
      .single();

    if (companyError) {
      console.warn("⚠ Erreur récupération compagnie :", companyError.message);
    }

    const { data: actorAdmin, error: actorAdminError } = await supabase
      .from("admins")
      .select("id")
      .eq("id", req.user?.id)
      .maybeSingle();

    if (actorAdminError) {
      console.warn("⚠ Erreur vérification de l'administrateur exécutant :", actorAdminError.message);
    }

    const auditAdminId = actorAdmin?.id || company?.id_admin || null;

    /* =======================================================
       5️⃣ JOURNAL D’ACTIVITÉ
    ======================================================== */
    await logActivite({
      module: "Factures",
      type_activite: "update",
      categorie: "Facture",
      reference: numero_facture,
      description: `Confirmation du paiement de la facture ${numero_facture}`,
      id_admin: auditAdminId,
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
      admin_id: auditAdminId,
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
    let emailStatus = "not_sent";
    let emailMessage = "Le paiement est confirmé, mais aucun e-mail de confirmation n'a été envoyé.";
    try {
      if (company?.email) {
        const mailInfo = await sendPaymentConfirmationEmail(
          company.email,
          numero_facture,
          facture.montant_total,
          company.company_name
        );
        emailStatus = "accepted_by_provider";
        emailMessage = "Le fournisseur e-mail a accepté le message. Sa livraison dans la boîte de réception n'est pas confirmée; vérifiez aussi les courriers indésirables.";
        console.info("📨 Confirmation de paiement acceptée par le fournisseur e-mail :", {
          provider: mailInfo.provider,
          destinataire: company.email,
          messageId: mailInfo.messageId,
          response: mailInfo.response
        });
      } else {
        emailStatus = "missing_recipient";
        emailMessage = "Le paiement est confirmé, mais la compagnie n'a pas d'adresse e-mail configurée.";
      }
    } catch (mailErr) {
      emailStatus = "failed";
      emailMessage = "Le paiement est confirmé, mais l'envoi de l'e-mail a échoué. Consultez les journaux du serveur.";
      console.error("❌ Erreur envoi email confirmation :", mailErr.message);
    }

    /* =======================================================
       8️⃣ RÉPONSE
    ======================================================== */
    return res.status(200).json({
      success: true,
      message: "Paiement confirmé.",
      email_status: emailStatus,
      email_message: emailMessage,
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
