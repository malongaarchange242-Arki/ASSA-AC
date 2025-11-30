import supabase from '../Config/db.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const ATTACH_BUCKET = 'Attachement_message';

const storage = multer.memoryStorage();
export const uploadContestationFiles = multer({ storage }).array('files', 5);

async function findAdminForCompany(companyId) {
  try {
    const { data: links, error: linksErr } = await supabase
      .from('admin_companies')
      .select('admin_id')
      .eq('company_id', companyId)
      .limit(1);
    if (!linksErr && links?.length && links[0]?.admin_id) return links[0].admin_id;

    const { data: company, error: compErr } = await supabase
      .from('companies')
      .select('id_admin')
      .eq('id', companyId)
      .maybeSingle();
    if (!compErr && company?.id_admin) return company.id_admin;

    const { data: admins, error: adminsErr } = await supabase
      .from('admins')
      .select('id')
      .eq('id_companie', companyId)
      .limit(1);
    if (!adminsErr && admins?.length) return admins[0].id;

    return null;
  } catch {
    return null;
  }
}

export const submitContestation = async (req, res, broadcastToRoom) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Token invalide ou expiré' });

    const companyId = req.body.id_companie || user.id_companie || user.company_id;
    if (!companyId) return res.status(400).json({ message: 'id_companie requis' });

    const numero_facture = req.body.numero_facture || req.body.invoice || req.body.invoiceId;
    const explication = (req.body.explication || req.body.explanation || '').trim();
    if (!numero_facture || !explication) {
      return res.status(400).json({ message: 'numero_facture et explication requis' });
    }

    let facture;
    try {
      const { data, error } = await supabase
        .from('factures')
        .select('id,id_companie')
        .eq('numero_facture', numero_facture)
        .maybeSingle();
      if (error) throw error;
      facture = data || null;
      if (!facture) return res.status(404).json({ message: 'Facture introuvable' });
      if (String(user.role || '').toLowerCase() === 'company' && facture.id_companie !== companyId) {
        return res.status(403).json({ message: 'Accès refusé à cette facture' });
      }
    } catch (e) {
      return res.status(500).json({ message: 'Erreur récupération facture', erreur: e.message });
    }

    const adminId = await findAdminForCompany(companyId);
    if (!adminId) return res.status(400).json({ message: 'Aucun admin attribué pour cette compagnie' });

    const { data: msg, error: msgErr } = await supabase
      .from('messages')
      .insert([{ id_companie: companyId, sender_role: 'company', content: `Contestation facture ${numero_facture}: ${explication}`, admin_id: adminId }])
      .select('*')
      .single();
    if (msgErr) throw msgErr;

    const uploaded = [];
    const files = req.files || [];
    for (const file of files) {
      const ext = file.originalname.split('.').pop() || 'bin';
      const filename = `${uuidv4()}.${ext}`;
      const storagePath = `companies/${companyId}/messages/${msg.id}/${filename}`;

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

    const payload = { type: 'message', message: msg, attachments: uploaded };
    if (broadcastToRoom) {
      const getRoomKey = (aId, cId) => `${aId}:${cId}`;
      const getCompanyRoomKey = (cId) => `company:${cId}`;
      broadcastToRoom(getCompanyRoomKey(companyId), payload);
      broadcastToRoom(getRoomKey(adminId, companyId), payload);
    }

    res.status(201).json({ message: 'Contestation soumise', payload });

  } catch (err) {
    res.status(500).json({ message: 'Erreur soumission contestation', erreur: err.message });
  }
};
