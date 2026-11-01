import supabase from '../Config/db.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { sendEmail } from '../Services/emailService.js';
import { logActivite } from '../Services/journalService.js';

// ================= Multer =================
const storage = multer.memoryStorage();
export const uploadContestationFiles = multer({ storage }).array('files', 5);

const BUCKET = "preuves-paiement";

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

async function sendContestationDecisionEmail({ to, numero_facture, company_name, decision, note, recipientName }) {
  if (!to) return { status: 'missing_recipient' };

  const accepted = decision === 'accept';
  const subject = accepted
    ? `Facture ${numero_facture} à corriger après contestation`
    : `Décision concernant la contestation de la facture ${numero_facture}`;
  const message = accepted
    ? `La contestation de la facture ${numero_facture} a été acceptée. La facture est renvoyée à son créateur pour correction.${note ? ` Consignes : ${note}` : ''}`
    : `La contestation de la facture ${numero_facture} a été rejetée. La facture retrouve le statut Impayée.${note ? ` Motif : ${note}` : ''}`;
  const safeNote = escapeHtml(note).replace(/\n/g, '<br>');
  const html = accepted
    ? `<p>Bonjour ${escapeHtml(recipientName)},</p><p>La contestation de la facture <strong>${escapeHtml(numero_facture)}</strong> de <strong>${escapeHtml(company_name)}</strong> a été acceptée.</p><p>La facture est renvoyée à son créateur pour correction.</p>${safeNote ? `<p><strong>Consignes de correction :</strong><br>${safeNote}</p>` : ''}<p>Après correction, la facture devra être soumise de nouveau au DAF.</p><p>ASSA-AC</p>`
    : `<p>Bonjour ${escapeHtml(recipientName)},</p><p>La contestation de la facture <strong>${escapeHtml(numero_facture)}</strong> de <strong>${escapeHtml(company_name)}</strong> a été rejetée. La facture retrouve le statut <strong>Impayée</strong>.</p>${safeNote ? `<p><strong>Motif :</strong><br>${safeNote}</p>` : ''}<p>ASSA-AC</p>`;

  const info = await sendEmail({
    to,
    subject,
    text: `Bonjour ${recipientName || ''},\n\n${message}\n\nASSA-AC`,
    html
  });
  const acceptedRecipients = info.accepted || [];
  const recipientAccepted = acceptedRecipients.some(recipient => {
    const acceptedEmail = typeof recipient === 'string' ? recipient : recipient?.email;
    return String(acceptedEmail || '').trim().toLowerCase() === to.trim().toLowerCase();
  });
  if (!recipientAccepted) throw new Error(`Le fournisseur e-mail n'a pas accepté le destinataire ${to}`);

  return { status: 'sent', provider: info.provider, messageId: info.messageId };
}

// ================= EMAIL =================
const sendContestationEmail = async ({
  to,
  numero_facture,
  company_name,
  explication
}) => {
  try {
    if (!to || (Array.isArray(to) && to.length === 0)) {
      console.warn("⚠ Email admin manquant");
      return;
    }

    const safeNumero = escapeHtml(numero_facture);
    const safeCompanyName = escapeHtml(company_name);
    const safeExplication = escapeHtml(explication).replace(/\n/g, '<br>');
    const info = await sendEmail({
      to,
      subject: `Contestation de la facture ${numero_facture}`,
      text: `
Bonjour,

La facture ${numero_facture} a été contestée par la compagnie ${company_name}.

Motif de la contestation :
${explication}

Veuillez vous connecter à la plateforme pour plus de détails.

Cordialement,
ASSA-AC
      `,
      html: `
        <p>Bonjour,</p>

        <p>
          La facture <strong>${safeNumero}</strong> a été
          <strong style="color:#d9534f;">contestée</strong>
          par la compagnie <strong>${safeCompanyName}</strong>.
        </p>

        <p><strong>Motif de la contestation :</strong></p>

        <blockquote style="
          background:#f8f9fa;
          padding:10px;
          border-left:4px solid #d9534f;
        ">
          ${safeExplication}
        </blockquote>

        <p>
          Veuillez vous connecter à la plateforme pour consulter
          les détails de la contestation.
        </p>

        <p>
          Cordialement,<br>
          <strong>ASSA-AC</strong>
        </p>
      `
    });
    console.info("📧 E-mail de contestation accepté :", {
      provider: info.provider,
      messageId: info.messageId,
      to
    });

  } catch (error) {
    console.error("❌ ERREUR EMAIL CONTESTATION :", error);
  }
};


// ================= Controller =================
export const uploadContestation = async (req, res) => {
  try {
    console.log("📥 Nouvelle contestation reçue");

    // ================= Auth =================
    const user = req.user;
    if (!user) {
      console.warn("❌ Aucun utilisateur dans req.user");
      return res.status(401).json({ message: "Token invalide" });
    }

    console.log("👤 Utilisateur :", {
      id: user.id,
      role: user.role,
      id_companie: user.id_companie
    });

    // ================= Données =================
    const { numero_facture, explication } = req.body;

    console.log("📄 Facture :", numero_facture);

    if (!numero_facture || !explication?.trim()) {
      console.warn("❌ Champs requis manquants");
      return res.status(400).json({
        message: "Le numéro de facture et l'explication sont obligatoires"
      });
    }

    // ================= Facture =================
    const { data: facture, error: factureErr } = await supabase
      .from("factures")
      .select("id, id_companie, id_admin, statut")
      .eq("numero_facture", numero_facture)
      .maybeSingle();

    if (factureErr || !facture) {
      console.error("❌ Facture introuvable :", factureErr);
      return res.status(404).json({ message: "Facture introuvable" });
    }

    console.log("✅ Facture trouvée :", facture);

    if (String(user.role).toLowerCase() !== "company" || !user.id_companie) {
      return res.status(403).json({ message: "Seule la compagnie propriétaire peut contester une facture." });
    }

    const authorizedCompanyId = user.id_companie;
    if (String(facture.id_companie) !== String(authorizedCompanyId)) {
      console.warn("⛔ Accès refusé à la facture");
      return res.status(403).json({ message: "Accès refusé" });
    }
    if (facture.statut !== "Impayée") {
      return res.status(409).json({ message: "Seules les factures impayées peuvent être contestées." });
    }

    const { data: pendingContestation, error: pendingContestationError } = await supabase
      .from("contestation")
      .select("id")
      .eq("numero_facture", numero_facture)
      .eq("status", "En attente")
      .limit(1)
      .maybeSingle();
    if (pendingContestationError) throw pendingContestationError;
    if (pendingContestation) {
      return res.status(409).json({ message: "Une contestation est déjà en attente pour cette facture." });
    }

    const [{ data: supervisors, error: supervisorsError }, { data: company, error: companyError }] = await Promise.all([
      supabase
        .from("superviseurs")
        .select("email")
        .eq("status", "Actif")
        .eq("archived", false),
      supabase
        .from("companies")
        .select("company_name")
        .eq("id", authorizedCompanyId)
        .maybeSingle()
    ]);
    if (supervisorsError) throw supervisorsError;
    if (companyError) throw companyError;

    let recipients = (supervisors || []).map(supervisor => supervisor.email).filter(Boolean);
    if (!recipients.length && facture.id_admin) {
      const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("email")
        .eq("id", facture.id_admin)
        .maybeSingle();
      if (adminError) throw adminError;
      if (admin?.email) recipients = [admin.email];
    }

    // ================= Upload fichiers =================
    const uploadedFiles = [];
    const uploadedPaths = [];

    console.log("📎 Nombre de fichiers :", req.files?.length || 0);

    for (const file of req.files || []) {
      const safeName = file.originalname
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9.-]/g, "_");

      const filename = `contestation/${uuidv4()}_${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(filename, file.buffer, { contentType: file.mimetype });

      if (uploadErr) {
        console.error("❌ Erreur upload fichier :", uploadErr);
        if (uploadedPaths.length) {
          const { error: cleanupErr } = await supabase.storage.from(BUCKET).remove(uploadedPaths);
          if (cleanupErr) console.error("❌ Erreur nettoyage fichiers de contestation :", cleanupErr);
        }
        return res.status(500).json({ message: "Erreur upload fichier" });
      }

      uploadedPaths.push(filename);
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);

      uploadedFiles.push({
        file_name: file.originalname,
        file_url: data.publicUrl
      });
    }

    console.log("✅ Fichiers uploadés :", uploadedFiles.length);

    // ================= Contestation =================
    const { data: contestation, error: contestErr } = await supabase
      .from("contestation")
      .insert([{
        numero_facture,
        id_companie: authorizedCompanyId,
        explication: explication.trim(),
        status: "En attente",
        admin_id: facture.id_admin,
        fichiers: uploadedFiles,
      }])
      .select()
      .single();

    if (contestErr) {
      console.error("❌ Erreur insertion contestation :", contestErr);
      if (uploadedPaths.length) {
        const { error: cleanupErr } = await supabase.storage.from(BUCKET).remove(uploadedPaths);
        if (cleanupErr) console.error("❌ Erreur nettoyage fichiers de contestation :", cleanupErr);
      }
      return res.status(500).json({ message: "Erreur enregistrement contestation" });
    }

    console.log("✅ Contestation enregistrée :", contestation.id);

    // ================= Mise à jour facture =================
    const { error: invoiceUpdateError } = await supabase
      .from("factures")
      .update({ statut: "Contestée" })
      .eq("id", facture.id);
    if (invoiceUpdateError) {
      const { error: contestationRollbackError } = await supabase
        .from("contestation")
        .delete()
        .eq("id", contestation.id);
      if (contestationRollbackError) console.error("Erreur restauration contestation:", contestationRollbackError);
      if (uploadedPaths.length) {
        const { error: cleanupErr } = await supabase.storage.from(BUCKET).remove(uploadedPaths);
        if (cleanupErr) console.error("Erreur nettoyage fichiers après échec contestation:", cleanupErr);
      }
      throw invoiceUpdateError;
    }

    console.log("🔄 Facture mise à jour → Contestée");

    try {
      await logActivite({
        module: 'Factures',
        type_activite: 'create',
        categorie: 'Contestation',
        reference: numero_facture,
        description: `Contestation envoyée pour la facture ${numero_facture}`,
        id_companie: authorizedCompanyId,
        utilisateur_nom: user.company_name || user.email || 'Compagnie',
        utilisateur_email: user.email || null
      });
    } catch (journalError) {
      console.error("Erreur journalisation de la contestation :", journalError);
    }

    console.log("🏢 Compagnie :", company?.company_name);

    // ================= EMAIL (non bloquant) =================
    sendContestationEmail({
      to: recipients,
      numero_facture,
      company_name: company?.company_name || "Compagnie",
      explication: explication.trim()
    }).catch(err =>
      console.error("❌ Erreur envoi email contestation :", err)
    );

    // ================= Réponse =================
    return res.status(201).json({
      success: true,
      message: "Contestation envoyée et email notifié",
      contestation
    });

  } catch (err) {
    console.error("🔥 ERREUR uploadContestation :", err);
    return res.status(500).json({
      message: "Erreur interne serveur",
      error: err.message
    });
  }
};

export const decideContestation = async (req, res) => {
  try {
    const numeroFacture = decodeURIComponent(req.params.numero_facture || '');
    const decision = String(req.body?.decision || '').trim().toLowerCase();
    const note = String(req.body?.note || '').trim();
    const actorRole = String(req.user?.role || '').trim().toLowerCase();

    if (!['superviseur', 'super_directeur'].includes(actorRole)) {
      return res.status(403).json({ message: 'Action réservée au DAF.' });
    }
    if (!numeroFacture || !['accept', 'reject'].includes(decision)) {
      return res.status(400).json({ message: 'La facture et une décision valide sont obligatoires.' });
    }
    if (decision === 'accept' && !note) {
      return res.status(400).json({ message: 'Les consignes de correction sont obligatoires pour accepter la contestation.' });
    }
    if (note.length > 2000) {
      return res.status(400).json({ message: 'Le commentaire ne peut pas dépasser 2 000 caractères.' });
    }

    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .select('id, numero_facture, id_companie, id_admin, created_by, statut, montant_total')
      .eq('numero_facture', numeroFacture)
      .eq('archived', false)
      .maybeSingle();
    if (factureError) throw factureError;
    if (!facture) return res.status(404).json({ message: 'Facture introuvable.' });
    if (facture.statut !== 'Contestée') {
      return res.status(409).json({ message: 'Cette facture n’est plus en attente de décision sur sa contestation.' });
    }

    const { data: contestation, error: contestationError } = await supabase
      .from('contestation')
      .select('id, status, explication')
      .eq('numero_facture', numeroFacture)
      .eq('status', 'En attente')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (contestationError) throw contestationError;
    if (!contestation) {
      return res.status(409).json({ message: 'Aucune contestation en attente pour cette facture.' });
    }

    const [companyResult, creatorResult] = await Promise.all([
      supabase.from('companies').select('company_name, email').eq('id', facture.id_companie).maybeSingle(),
      facture.created_by
        ? supabase.from('operateurs').select('nom, email').eq('id', facture.created_by).maybeSingle()
        : facture.id_admin
          ? supabase.from('admins').select('nom_complet, email').eq('id', facture.id_admin).maybeSingle()
          : Promise.resolve({ data: null, error: null })
    ]);
    if (companyResult.error) throw companyResult.error;
    if (creatorResult.error) throw creatorResult.error;
    const company = companyResult.data;
    const creator = creatorResult.data;

    const accepted = decision === 'accept';
    const contestationStatus = accepted ? 'Acceptée' : 'Rejetée';
    const invoiceStatus = accepted ? 'À corriger' : 'Impayée';
    const { data: updatedContestation, error: updateContestationError } = await supabase
      .from('contestation')
      .update({ status: contestationStatus, updated_at: new Date().toISOString() })
      .eq('id', contestation.id)
      .eq('status', 'En attente')
      .select('id')
      .maybeSingle();
    if (updateContestationError) throw updateContestationError;
    if (!updatedContestation) {
      return res.status(409).json({ message: 'La contestation a déjà été traitée.' });
    }

    let invoiceUpdate = supabase
      .from('factures')
      .update(accepted
        ? { statut: invoiceStatus, daf_status: 'not_submitted', submitted_to_daf_at: null }
        : { statut: invoiceStatus })
      .eq('id', facture.id)
      .eq('statut', 'Contestée')
      .select('id, numero_facture, statut, daf_status')
      .maybeSingle();
    const { data: updatedFacture, error: updateFactureError } = await invoiceUpdate;
    if (updateFactureError || !updatedFacture) {
      const { error: rollbackError } = await supabase
        .from('contestation')
        .update({ status: 'En attente', updated_at: new Date().toISOString() })
        .eq('id', contestation.id)
        .eq('status', contestationStatus);
      if (rollbackError) {
        throw new Error(`Échec mise à jour facture${updateFactureError ? ` : ${updateFactureError.message}` : ''}; restauration contestation impossible : ${rollbackError.message}`);
      }
      if (updateFactureError) throw updateFactureError;
      return res.status(409).json({ message: 'La facture a changé pendant le traitement. Rechargez la page.' });
    }

    const description = accepted
      ? `Contestation acceptée pour la facture ${numeroFacture}. Retour au créateur pour correction. Consignes : ${note}`
      : `Contestation rejetée pour la facture ${numeroFacture}. La facture redevient impayée.${note ? ` Motif : ${note}` : ''}`;
    let journalStatus = 'recorded';
    try {
      await logActivite({
        module: 'Factures',
        type_activite: accepted ? 'validate' : 'reject',
        categorie: 'Contestation',
        reference: numeroFacture,
        description,
        id_companie: facture.id_companie,
        utilisateur_nom: req.user?.nom_complet || req.user?.email || 'DAF',
        utilisateur_email: req.user?.email || null
      });
    } catch (journalError) {
      journalStatus = 'failed';
      console.error('Échec journalisation de la décision sur contestation :', journalError);
    }

    const creatorEmail = creator?.email || null;
    const companyEmail = company?.email || null;
    const notifications = {};
    const mailTargets = [
      ['creator', creatorEmail, creator?.nom_complet || creator?.nom || ''],
      ['company', companyEmail, company?.company_name || '']
    ];
    const notifiedEmails = new Set();
    for (const [recipientType, email, recipientName] of mailTargets) {
      if (!email) {
        notifications[recipientType] = 'missing_recipient';
        continue;
      }
      if (notifiedEmails.has(email.toLowerCase())) {
        notifications[recipientType] = 'same_recipient';
        continue;
      }
      notifiedEmails.add(email.toLowerCase());
      try {
        notifications[recipientType] = (await sendContestationDecisionEmail({
          to: email,
          numero_facture: numeroFacture,
          company_name: company?.company_name || 'Compagnie',
          decision,
          note,
          recipientName
        })).status;
      } catch (emailError) {
        notifications[recipientType] = 'failed';
        console.error(`Échec notification contestation (${recipientType}) :`, emailError);
      }
    }

    return res.status(200).json({
      success: true,
      message: accepted
        ? 'Contestation acceptée : la facture est renvoyée à son créateur pour correction.'
        : 'Contestation rejetée : la facture redevient impayée.',
      facture: updatedFacture,
      contestation: { id: contestation.id, status: contestationStatus },
      notifications,
      journal_status: journalStatus
    });
  } catch (error) {
    console.error('Erreur décision contestation :', error);
    return res.status(500).json({ message: 'Erreur lors du traitement de la contestation.', error: error.message });
  }
};
