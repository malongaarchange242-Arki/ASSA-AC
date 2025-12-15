import supabase from '../Config/db.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from "nodemailer";

// ================= Multer =================
const storage = multer.memoryStorage();
export const uploadContestationFiles = multer({ storage }).array('files', 5);

const BUCKET = "Attachement_message";

// ================= EMAIL =================
const sendContestationEmail = async ({
  to,
  numero_facture,
  company_name,
  explication
}) => {
  try {
    if (!to) {
      console.warn("⚠ Email admin manquant");
      return;
    }

    const port = Number(process.env.SMTP_PORT);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const mailOptions = {
      from: `"ASSA-AC" <${process.env.SMTP_USER}>`,
      to,
      subject: `⚠ Contestation de la facture ${numero_facture}`,
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
          La facture <strong>${numero_facture}</strong> a été
          <strong style="color:#d9534f;">contestée</strong>
          par la compagnie <strong>${company_name}</strong>.
        </p>

        <p><strong>Motif de la contestation :</strong></p>

        <blockquote style="
          background:#f8f9fa;
          padding:10px;
          border-left:4px solid #d9534f;
        ">
          ${explication}
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
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("📧 Email contestation envoyé :", info.messageId);

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
    const companyId = req.body.id_companie ?? user.id_companie;
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
      .select("id, id_companie, id_admin")
      .eq("numero_facture", numero_facture)
      .maybeSingle();

    if (factureErr || !facture) {
      console.error("❌ Facture introuvable :", factureErr);
      return res.status(404).json({ message: "Facture introuvable" });
    }

    console.log("✅ Facture trouvée :", facture);

    if (
      String(user.role).toLowerCase() === "company" &&
      String(facture.id_companie) !== String(companyId)
    ) {
      console.warn("⛔ Accès refusé à la facture");
      return res.status(403).json({ message: "Accès refusé" });
    }

    // ================= Upload fichiers =================
    const uploadedFiles = [];

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
        return res.status(500).json({ message: "Erreur upload fichier" });
      }

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
        facture_id: facture.id,
        id_companie: companyId,
        explication: explication.trim(),
        fichiers: uploadedFiles,
        date_contestation: new Date()
      }])
      .select()
      .single();

    if (contestErr) {
      console.error("❌ Erreur insertion contestation :", contestErr);
      return res.status(500).json({ message: "Erreur enregistrement contestation" });
    }

    console.log("✅ Contestation enregistrée :", contestation.id);

    // ================= Mise à jour facture =================
    await supabase
      .from("factures")
      .update({ statut: "Contestée" })
      .eq("id", facture.id);

    console.log("🔄 Facture mise à jour → Contestée");

    // ================= Admin =================
    const { data: admin } = await supabase
      .from("admins")
      .select("email")
      .eq("id", facture.id_admin)
      .maybeSingle();

    console.log("👨‍💼 Admin email :", admin?.email);

    // ================= Company =================
    const { data: company } = await supabase
      .from("companies")
      .select("company_name")
      .eq("id", companyId)
      .maybeSingle();

    console.log("🏢 Compagnie :", company?.company_name);

    // ================= EMAIL (non bloquant) =================
    sendContestationEmail({
      to: admin?.email,
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
