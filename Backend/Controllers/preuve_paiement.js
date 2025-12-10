import supabase from '../Config/db.js';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import nodemailer from 'nodemailer';

// ================= Multer =================
const storage = multer.memoryStorage();
export const uploadMiddleware = multer({ storage }).single('file');


// =============== SMTP Email ===============
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// =============== Upload Preuve Paiement ===============

export const uploadPreuvesPaiement = async (req, res) => {
    try {
        const { numero_facture, commentaire } = req.body;
        const file = req.file;

        console.log("📥 Reçu upload preuve :", { numero_facture, fichier: file?.originalname });

        if (!file) return res.status(400).json({ message: 'Aucun fichier envoyé' });
        if (!numero_facture) return res.status(400).json({ message: 'Numéro de facture manquant' });

        // ==========================
        // 1️⃣ RÉCUPÉRATION FACTURE
        // ==========================
        const { data: facture, error: factureErr } = await supabase
            .from("factures")
            .select("id, id_companie, id_admin, admin_id, statut")
            .eq("numero_facture", numero_facture)
            .single();

        console.log("🧾 FACTURE TROUVÉE :", facture);
        console.log("🟥 ERREUR FACTURE :", factureErr);

        if (factureErr) return res.status(500).json({ message: "Erreur récupération facture", error: factureErr.message });
        if (!facture) return res.status(404).json({ message: "Facture introuvable" });

        const facture_id = facture.id;
        const id_companie = facture.id_companie;

        console.log("📌 FACTURE ID UTILISÉ POUR UPDATE =", facture_id);

        // ==========================
        // 2️⃣ VÉRIFICATION ACCESS
        // ==========================
        if (String(req.user.role || "").toLowerCase() === "company") {
            console.log("🔐 Vérif accès company :", req.user.id_companie, "==", id_companie);
            if (req.user.id_companie !== id_companie) {
                return res.status(403).json({ message: "Accès refusé" });
            }
        }

        // ==========================
        // 3️⃣ UPLOAD STORAGE
        // ==========================
        const ext = file.originalname.split('.').pop();
        const safeName = file.originalname
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '_');

        const filename = `preuves/${uuidv4()}_${safeName}`;
        const bucketName = "preuves-paiement";

        console.log("📤 Upload fichier →", filename);

        let { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filename, file.buffer, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.mimetype
            });

        console.log("🟥 ERREUR UPLOAD :", uploadError);

        if (uploadError) throw uploadError;

        const { data: publicUrl } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filename);

        console.log("🌍 URL PUBLIQUE =", publicUrl.publicUrl);

        // ==========================
        // 4️⃣ INSERTION PREUVE
        // ==========================
        const { data: preuveData, error: preuveError } = await supabase
            .from("preuve_paiement")
            .insert([{
                facture_id,
                id_companie,
                fichier_nom: file.originalname,
                fichier_url: publicUrl.publicUrl,
                type_fichier: ext,
                commentaire,
                date_envoi: new Date()
            }])
            .select()
            .single();

        console.log("📥 INSERT PREUVE =", preuveData);
        console.log("🟥 ERREUR INSERT PREUVE =", preuveError);

        if (preuveError) throw preuveError;

        // ==========================
        // 5️⃣ UPDATE STATUT FACTURE
        // ==========================
        console.log("🔄 MISE A JOUR STATUT → 'En Attente'");

        const { data: updateData, error: updateError } = await supabase
            .from("factures")
            .update({ statut: "En Attente" })
            .eq("id", facture_id)
            .select();

        console.log("📌 UPDATE RESULT =", updateData);
        console.log("🟥 UPDATE ERROR =", updateError);

        // ==========================
        // 6️⃣ EMAIL ADMIN
        // ==========================
        const adminId = facture.id_admin || facture.admin_id;

        console.log("👤 ADMIN ID =", adminId);

        if (adminId) {
            const { data: adminData } = await supabase
                .from("admins")
                .select("email, nom")
                .eq("id", adminId)
                .single();

            console.log("📧 ADMIN:", adminData);

            if (adminData?.email) {
                await transporter.sendMail({
                    from: process.env.SMTP_USER,
                    to: adminData.email,
                    subject: "Nouvelle preuve de paiement reçue",
                    html: `
                        <p>Bonjour ${adminData.nom || ""},</p>
                        <p>Une nouvelle preuve de paiement a été téléversée pour la facture <b>${numero_facture}</b>.</p>
                        <p>Statut mis à jour : <b>En Attente</b></p>
                        <p>Veuillez vous connecter pour la valider.</p>
                    `
                });
                console.log("📨 Email envoyé !");
            }
        }

        // ==========================
        // 7️⃣ RÉPONSE API
        // ==========================
        res.status(201).json({
            success: true,
            message: "Preuve de paiement uploadée et statut mis à jour",
            preuve: preuveData
        });

    } catch (err) {
        console.error("⛔ ERREUR uploadPreuvesPaiement:", err);
        res.status(500).json({
            message: "Erreur lors de l'upload de la preuve",
            error: err.message
        });
    }
};

// ================= GET PREUVE BY ID =================
export const getPreuveById = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from("preuve_paiement")
            .select("*")
            .eq("id", id)
            .single();

        if (error) return res.status(500).json({ message: "Erreur serveur", erreur: error.message });
        if (!data) return res.status(404).json({ message: "Preuve introuvable" });

        if (String(req.user.role).toLowerCase() === "company" &&
            data.id_companie !== (req.user.id_companie || req.user.company_id)) {
            return res.status(403).json({ message: "Accès refusé à cette preuve" });
        }

        return res.json({ preuve: data });

    } catch (err) {
        console.error("Erreur getPreuveById:", err);
        return res.status(500).json({ message: "Erreur serveur", erreur: err.message });
    }
};
