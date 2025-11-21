// controllers/messagesController.js
import supabase from '../Config/db.js';
import { v4 as uuidv4 } from 'uuid';

const ATTACH_BUCKET = 'Attachement_message';
const getRoomKey = (adminId, id_companie) => `${adminId}:${id_companie}`;
const getCompanyRoomKey = (id_companie) => `company:${id_companie}`;

/**
 * Récupère un admin lié à une compagnie
 */
async function findAdminForCompany(id_companie) {
  try {
    const { data: admins, error } = await supabase
      .from('admins')
      .select('id')
      .eq('id_companie', id_companie)
      .limit(1);

    if (error) {
      console.warn('Erreur recherche admin pour company:', error.message);
      return null;
    }

    return admins?.length ? admins[0].id : null;
  } catch (err) {
    console.error('findAdminForCompany error:', err);
    return null;
  }
}

/**
 * Historique messages
 */
export const getMessagesHistory = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Token invalide ou expiré' });

    // ID de la compagnie à utiliser
    const id_companie = user.company_id || req.query.id_companie;
    if (!id_companie) return res.status(400).json({ message: 'id_companie requis' });

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id_companie', id_companie)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Récupération des pièces jointes
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

    // Map attachments par message
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

/**
 * Envoi message
 */
export const postMessage = async (req, res, broadcastToRoom) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Token invalide ou expiré' });

    const isCompany = user.profile === 'Company';
    const id_companie = user.company_id || req.body.id_companie;
    if (!id_companie) return res.status(400).json({ message: 'id_companie requis' });

    const adminId = isCompany ? await findAdminForCompany(id_companie) : user.id;
    const content = (req.body.content || '').trim();

    if (!content && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ message: 'Message vide sans pièce jointe' });
    }

    const insertObj = {
      id_companie,
      sender_role: isCompany ? 'company' : 'admin',
      content,
      admin_id: adminId || null
    };

    const { data: msg, error } = await supabase
      .from('messages')
      .insert([insertObj])
      .select('*')
      .single();
    if (error) throw error;

    // Upload des fichiers attachés
    const uploaded = [];
    if (req.files && req.files.length) {
      for (const file of req.files) {
        const ext = file.originalname.split('.').pop() || 'bin';
        const filename = `${uuidv4()}.${ext}`;
        const storagePath = `${adminId || 'company'}/${id_companie}/${msg.id}/${filename}`;

        const { error: upErr } = await supabase.storage
          .from(ATTACH_BUCKET)
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
    }

    const payload = { type: 'message', message: msg, attachments: uploaded };

    // Broadcast WebSocket
    if (broadcastToRoom) {
      if (adminId) broadcastToRoom(getRoomKey(adminId, id_companie), payload);
      broadcastToRoom(getCompanyRoomKey(id_companie), payload);
    }

    res.status(201).json(payload);

  } catch (err) {
    console.error('postMessage error:', err);
    res.status(500).json({ message: 'Erreur envoi message', erreur: err.message });
  }
};

/**
 * Upload preuve et envoi automatique
 */
export const uploadAndSendProof = async (req, res, broadcastToRoom) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Token invalide ou expiré' });

    const id_companie = user.company_id || req.body.id_companie;
    if (!id_companie) return res.status(400).json({ message: 'id_companie requis' });

    const { numero_facture, paid_amount, payment_method, commentaire } = req.body;
    if (!numero_facture || !paid_amount || !payment_method || !req.files || !req.files.length) {
      return res.status(400).json({ message: 'Tous les champs et fichiers sont requis' });
    }

    const { data: preuve, error: preuveErr } = await supabase
      .from('preuves')
      .insert([{ numero_facture, paid_amount, payment_method, commentaire, id_companie }])
      .select('*')
      .single();
    if (preuveErr) throw preuveErr;

    const adminId = await findAdminForCompany(id_companie);

    const insertMsg = {
      id_companie,
      sender_role: 'company',
      content: `Nouvelle preuve de paiement pour la facture ${numero_facture}`,
      admin_id: adminId || null
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
      const storagePath = `companies/${id_companie}/messages/${msg.id}/${filename}`;

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
      broadcastToRoom(getCompanyRoomKey(id_companie), payload);
      if (adminId) broadcastToRoom(getRoomKey(adminId, id_companie), payload);
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