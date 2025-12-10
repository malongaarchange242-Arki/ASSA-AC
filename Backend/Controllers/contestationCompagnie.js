import supabase from '../Config/db.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

// ================= Multer =================
const storage = multer.memoryStorage();
export const uploadContestationFiles = multer({ storage }).array('files', 5);

const BUCKET = "Attachement_message";

// ================= Controller Contestation =================
export const uploadContestation = async (req, res) => {
  try {
    console.log("📥 Reçu contestation :", req.body, "files:", req.files?.length);

    const user = req.user;
    if (!user) return res.status(401).json({ message: "Token invalide" });

    const companyId = req.body.id_companie || user.id_companie || user.company_id;
    if (!companyId) return res.status(400).json({ message: "id_companie requis" });

    const numero_facture = req.body.numero_facture;
    const explication = (req.body.explication || "").trim();

    if (!numero_facture || !explication) {
      return res.status(400).json({
        message: "numero_facture et explication requis"
      });
    }

    // ==========================
    // 1️⃣ Vérifier facture
    // ==========================
    const { data: facture, error: factureErr } = await supabase
      .from("factures")
      .select("id, id_companie")
      .eq("numero_facture", numero_facture)
      .maybeSingle();

    if (factureErr) return res.status(500).json({ message: "Erreur récupération facture", erreur: factureErr.message });
    if (!facture) return res.status(404).json({ message: "Facture introuvable" });

    if (String(user.role).toLowerCase() === "company" && facture.id_companie !== companyId) {
      return res.status(403).json({ message: "Accès refusé à cette facture" });
    }

    const facture_id = facture.id;

    // ==========================
    // 2️⃣ Upload fichiers
    // ==========================
    const uploadedFiles = [];
    const files = req.files || [];

    console.log("📎 Fichiers reçus :", files.length);

    for (const file of files) {
      const ext = file.originalname.split(".").pop();
      const safeName = file.originalname
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9.-]/g, "_");

      const filename = `contestation/${uuidv4()}_${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(filename, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (uploadErr) throw uploadErr;

      const { data: urlObj } = supabase.storage.from(BUCKET).getPublicUrl(filename);

      uploadedFiles.push({
        file_name: file.originalname,
        file_url: urlObj.publicUrl
      });
    }

    // ==========================
    // 3️⃣ Enregistrement DB
    // ==========================
    const { data: contestData, error: contestErr } = await supabase
      .from("contestation")
      .insert([{
        facture_id,
        id_companie: companyId,
        explication,
        fichiers: uploadedFiles,
        date_contestation: new Date()
      }])
      .select()
      .single();

    if (contestErr) throw contestErr;

    // ==========================
    // 4️⃣ Statut facture
    // ==========================
    console.log("🔄 Mise à jour facture → Contestée");

    await supabase
      .from("factures")
      .update({ statut: "Contestée" })
      .eq("id", facture_id);

    // ==========================
    // 5️⃣ Réponse
    // ==========================
    res.status(201).json({
      success: true,
      message: "Contestation enregistrée",
      contestation: contestData
    });

  } catch (err) {
    console.error("⛔ ERREUR uploadContestation :", err);
    return res.status(500).json({
      message: "Erreur soumission contestation",
      erreur: err.message
    });
  }
};
