import supabase from '../Config/db.js';
import { v4 as uuidv4 } from 'uuid';

const ATTACH_BUCKET = 'Attachement_message';
const getRoomKey = (adminId, companyId) => `${adminId}:${companyId}`;
const getCompanyRoomKey = (companyId) => `company:${companyId}`;

// ---------------------------
// Utils
// ---------------------------
async function findAdminForCompany(companyId) {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('id_admin')
      .eq('id', companyId)
      .single();

    if (error) {
      console.warn('Erreur récupération admin depuis companies:', error.message);
      return null;
    }

    return data?.id_admin || null;
  } catch (err) {
    console.error('findAdminForCompany error:', err);
    return null;
  }
}


// ---------------------------
// Historique messages
// ---------------------------
export const getMessagesHistory = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Token invalide ou expiré' });

    const companyId = req.query.id_companie || user.id_companie || user.company_id;
    if (!companyId) return res.status(400).json({ message: 'id_companie requis' });

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id_companie', companyId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const messageIds = messages.map(m => m.id);
    let attachments = [];
    if (messageIds.length) {
      const { data: atts, error: attErr } = await supabase
        .from('attachments')
        .select('*')
        .in('message_id', messageIds);
      if (attErr) throw attErr;
      attachments = atts || [];
    }

    const byMessage = new Map();
    attachments.forEach(att => {
      if (!byMessage.has(att.message_id)) byMessage.set(att.message_id, []);
      byMessage.get(att.message_id).push(att);
    });

    const result = messages.map(m => ({ message: m, attachments: byMessage.get(m.id) || [] }));
    res.json(result);

  } catch (err) {
    console.error('getMessagesHistory error:', err);
    res.status(500).json({ message: 'Erreur historique', erreur: err.message });
  }
};

// ---------------------------
// Marquer messages comme lus
// ---------------------------
export const markMessagesAsRead = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Token invalide' });
    }

    const { companyId } = req.params;
    if (!companyId) {
      return res.status(400).json({ message: 'companyId requis' });
    }

    // ADMIN uniquement
    if (!['Admin', 'admin'].includes(user.role)) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('id_companie', companyId)
      .eq('admin_id', user.id)
      .eq('sender_role', 'company')
      .eq('is_read', false);

    if (error) throw error;

    res.json({ success: true });

  } catch (err) {
    console.error('markMessagesAsRead error:', err);
    res.status(500).json({ message: 'Erreur marquage messages' });
  }
};


/// ---------------------------
// Envoi message
// ---------------------------
export const postMessage = async (req, res, broadcastToRoom) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Token invalide ou expiré" });
    }

    // Vérification rôle
    const isCompany = ["Company", "Compagnie"].includes(user.role);

    // ID compagnie
    const companyId = req.body.id_companie || user.id_companie;
    if (!companyId) {
      return res.status(400).json({ message: "id_companie requis" });
    }

    // Contenu texte
    const content = req.body.content ? req.body.content.trim() : "";

    // Trouver l'admin si c’est une compagnie
    const adminId = isCompany ? await findAdminForCompany(companyId) : user.id;
    if (isCompany && !adminId) {
      return res.status(400).json({ message: "Aucun admin trouvé pour cette compagnie" });
    }

    // Message vide
    if (!content && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ message: "Message vide sans pièce jointe" });
    }

    // Insertion DB
    const insertObj = {
      id_companie: companyId,
      sender_role: isCompany ? "company" : "admin",
      content,
      admin_id: adminId,
      is_read: false // 🔥 IMPORTANT
    };

    const { data: msg, error } = await supabase
      .from("messages")
      .insert([insertObj])
      .select("*")
      .single();

    if (error) throw error;

    // -----------------------
    // GESTION DES FICHIERS
    // -----------------------
    const uploaded = [];

    if (req.files?.length) {
      for (const file of req.files) {
        const ext = file.originalname.split(".").pop() || "bin";
        const filename = `${uuidv4()}.${ext}`;
        const storagePath = `${isCompany ? "companies" : "admins"}/${companyId}/${msg.id}/${filename}`;

        // Upload storage
        const { error: upErr } = await supabase.storage
          .from(ATTACH_BUCKET)
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (upErr) throw upErr;

        const { data: pub } = supabase.storage
          .from(ATTACH_BUCKET)
          .getPublicUrl(storagePath);

        // Enregistrement BDD
        const { data: att, error: attErr } = await supabase
          .from("attachments")
          .insert([
            {
              message_id: msg.id,
              file_url: pub.publicUrl,
              file_name: file.originalname,
              uploaded_at: new Date(),
            },
          ])
          .select("*")
          .single();

        if (attErr) throw attErr;

        uploaded.push(att);
      }
    }

    // -----------------------
    // PAYLOAD FINAL
    // -----------------------

    const serverMsg = {
      ...msg,
      id_companie: companyId, // 🔥 OBLIGATOIRE pour le WebSocket
      attachments: uploaded,
      client_temp_id: req.body?.temp_id || req.body?.client_temp_id,
    };

    const payload = {
      type: "message",
      message: serverMsg,
      attachments: uploaded,
    };

    // -----------------------
    // BROADCAST WEBSOCKET
    // -----------------------

    if (broadcastToRoom) {
      const adminRoomId = adminId;

      // Room admin + compagnie
      broadcastToRoom(getRoomKey(adminRoomId, companyId), payload);
      broadcastToRoom(getCompanyRoomKey(companyId), payload);
    }


    res.status(201).json(payload);

  } catch (err) {
    console.error("postMessage error:", err);
    res.status(500).json({
      message: "Erreur envoi message",
      erreur: err.message,
    });
  }
};



// ---------------------------
// Upload preuve + message automatique
// ---------------------------
export const uploadAndSendProof = async (req, res, broadcastToRoom) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Token invalide ou expiré' });

    const companyId = req.body.id_companie || user.company_id;
    if (!companyId) return res.status(400).json({ message: 'id_companie requis' });

    const { numero_facture, paid_amount, payment_method, commentaire } = req.body;
    if (!numero_facture || !paid_amount || !payment_method || !req.files?.length) {
      return res.status(400).json({ message: 'Tous les champs et fichiers sont requis' });
    }

    const { data: preuve, error: preuveErr } = await supabase
      .from('preuves')
      .insert([{ numero_facture, paid_amount, payment_method, commentaire, id_companie: companyId }])
      .select('*')
      .single();
    if (preuveErr) throw preuveErr;

    const adminId = await findAdminForCompany(companyId);
    if (!adminId) return res.status(400).json({ message: 'Aucun admin trouvé pour cette compagnie' });

    const insertMsg = {
      id_companie: companyId,
      sender_role: 'company',
      content: `Nouvelle preuve de paiement pour la facture ${numero_facture}`,
      admin_id: adminId
    };

    const { data: msg, error: msgErr } = await supabase
      .from('messages')
      .insert([insertMsg])
      .select('*')
      .single();
    if (msgErr) throw msgErr;

    const uploaded = [];
    for (const file of req.files) {
      const ext = file.originalname.split('.').pop() || 'bin';
      const filename = `${uuidv4()}.${ext}`;
      const storagePath = `companies/${companyId}/messages/${msg.id}/${filename}`;

      const { error: upErr } = await supabase.storage.from(ATTACH_BUCKET)
        .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(ATTACH_BUCKET).getPublicUrl(storagePath);
      const { data: att, error: attErr } = await supabase
        .from('attachments')
        .insert([{ message_id: msg.id, file_url: pub.publicUrl, file_name: file.originalname, uploaded_at: new Date() }])
        .select('*')
        .single();

      if (attErr) throw attErr;
      uploaded.push(att);
    }

    const payload = { type: 'message', message: msg, attachments: uploaded };
    if (broadcastToRoom) {
      broadcastToRoom(getCompanyRoomKey(companyId), payload);
      broadcastToRoom(getRoomKey(adminId, companyId), payload);
    }

    res.status(201).json({
      message: 'Preuve enregistrée et envoyée à l’admin',
      preuve,
      messagePayload: payload
    });

  } catch (err) {
    console.error('uploadAndSendProof error:', err);
    res.status(500).json({ message: 'Erreur upload et envoi preuve', erreur: err.message });
  }
};

export const countUnreadMessagesAdmin = async (req, res) => {
  try {
    const adminId = req.user.id;

    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', adminId)
      .eq('sender_role', 'company')
      .eq('is_read', false);

    if (error) throw error;

    res.json({ unread: count || 0 });

  } catch (err) {
    res.status(500).json({ unread: 0 });
  }
};

export const countUnreadMessagesCompany = async (req, res) => {
  try {
    const companyId = req.user.id_companie;

    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('id_companie', companyId)
      .eq('sender_role', 'admin')
      .eq('is_read', false);

    if (error) throw error;

    res.json({ unread: count || 0 });

  } catch (err) {
    res.status(500).json({ unread: 0 });
  }
};
