import supabase from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';

// ================= Multer =================
const storage = multer.memoryStorage();
export const uploadMiddleware = multer({ storage }).single('file');

// ================= Upload Preuves Paiement =================
export const uploadPreuvesPaiement = async (req, res) => {
    try {
        const { numero_facture, company_id: bodyCompanyId, commentaire } = req.body;
        const file = req.file;

        if (!file) return res.status(400).json({ message: 'Aucun fichier envoyé' });

        // 🔹 Récupérer company_id depuis token si absent dans body
        let company_id = bodyCompanyId;
        if (!company_id && req.user?.profile === 'Company') company_id = req.user.company_id;
        if (!company_id) return res.status(400).json({ message: 'ID de la compagnie manquant' });

        // 🔹 Vérifier que la compagnie existe
        const { data: companyExists, error: companyError } = await supabase
            .from('companies')
            .select('id')
            .eq('id', company_id)
            .single();

        if (companyError || !companyExists) return res.status(400).json({ message: 'Compagnie introuvable' });

        // 🔹 Préparer le fichier pour upload
        const ext = file.originalname.split('.').pop();
        const safeName = file.originalname
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `preuves/${uuidv4()}_${safeName}`;

        // 🔹 Upload vers Supabase Storage
        const { error: uploadError } = await supabase
            .storage
            .from('preuves-paiement')
            .upload(filename, file.buffer, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.mimetype
            });

        if (uploadError) throw uploadError;

        // 🔹 Récupérer l'URL publique
        const { data: publicData } = supabase
            .storage
            .from('preuves-paiement')
            .getPublicUrl(filename);

        // 🔹 Insérer la preuve dans la table
        const { data: preuveData, error: preuveError } = await supabase
            .from('preuves_paiement')
            .insert([{
                numero_facture,
                id_companie: company_id,
                fichier_nom: file.originalname,
                fichier_url: publicData.publicUrl,
                type_fichier: ext,
                commentaire
            }])
            .select()
            .single();

        if (preuveError) throw preuveError;

        // 🔹 Log activité
        await supabase.from('journal_activite').insert([{
            id_admin: req.user?.profile !== 'Company' ? req.user?.id : null,
            id_companie: company_id,
            type_activite: 'Upload preuve',
            categorie: 'Facture',
            reference: numero_facture,
            description: `Preuve uploadée (${file.originalname})`
        }]);

        res.status(201).json({
            success: true,
            message: 'Preuve de paiement uploadée avec succès',
            preuve: preuveData
        });

    } catch (err) {
        console.error('Erreur uploadPreuvesPaiement:', err);
        res.status(500).json({
            message: 'Erreur lors de l\'upload de la preuve',
            error: err.message
        });
    }
};

// ================= Récupérer une preuve par ID =================
export const getPreuveById = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('preuves_paiement')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return res.status(500).json({ message: 'Erreur serveur', erreur: error.message });
        if (!data) return res.status(404).json({ message: 'Preuve introuvable' });

        // 🔹 Vérification accès Company
        if (req.user.profile === 'Company' && data.id_companie !== req.user.company_id) {
            return res.status(403).json({ message: 'Accès refusé à cette preuve' });
        }

        res.json({ preuve: data });

    } catch (err) {
        console.error('Erreur getPreuveById:', err);
        res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
    }
};
