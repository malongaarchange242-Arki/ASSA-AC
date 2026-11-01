// controllers/authCommonController.js
import supabase from '../Config/db.js';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { isEmailConfigured, sendEmail } from '../Services/emailService.js';

const RESET_OTP_LIFETIME_MS = 10 * 60 * 1000;
const RESET_OTP_MAX_ATTEMPTS = 5;
const GENERIC_RESET_MESSAGE = 'Si un compte correspond à cette adresse, un code de réinitialisation lui a été envoyé.';

const findResetAccount = async (email) => {
  const accounts = [
    { table: 'admins', type: 'admin', passwordColumn: 'password', select: 'id, email, nom_complet, password, archived', active: user => user.archived !== true },
    { table: 'superviseurs', type: 'superviseur', passwordColumn: 'password', select: 'id, email, nom_complet, password, archived', active: user => user.archived !== true },
    { table: 'operateurs', type: 'operateur', passwordColumn: 'password_hash', select: 'id, email, nom, password_hash, actif', active: user => user.actif !== false },
    { table: 'companies', type: 'company', passwordColumn: 'password_hash', select: 'id, email, company_name, password_hash, archived', active: user => user.archived !== true }
  ];

  for (const account of accounts) {
    const { data, error } = await supabase
      .from(account.table)
      .select(account.select)
      .ilike('email', email)
      .maybeSingle();

    if (error) throw error;
    if (data && account.active(data) && data[account.passwordColumn]) {
      return { ...account, user: data };
    }
  }

  return null;
};

export const requestPasswordResetOtp = async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Adresse e-mail invalide.' });
  }
  if (!isEmailConfigured()) {
    return res.status(503).json({ message: 'Le service d’envoi d’e-mails est indisponible. Réessayez plus tard.' });
  }

  try {
    const account = await findResetAccount(email);
    if (!account) return res.status(200).json({ message: GENERIC_RESET_MESSAGE });

    const otp = String(randomInt(100000, 1000000));
    const otp_hash = await bcrypt.hash(otp, 10);
    const expires_at = new Date(Date.now() + RESET_OTP_LIFETIME_MS).toISOString();

    const { error: clearError } = await supabase
      .from('password_reset_otps')
      .delete()
      .eq('email', email);
    if (clearError) throw clearError;

    const { error: insertError } = await supabase
      .from('password_reset_otps')
      .insert({
        email,
        account_type: account.type,
        account_id: account.user.id,
        otp_hash,
        expires_at,
        attempts: 0
      });
    if (insertError) throw insertError;

    try {
      await sendEmail({
        to: email,
        subject: 'Récupération du compte - ASSA-AC',
        text: `Bonjour,\n\nVotre code de réinitialisation ASSA-AC est : ${otp}\nIl est valable 10 minutes. Si vous n’avez pas demandé cette réinitialisation, ignorez cet e-mail.\n\nMerci.`
      });
    } catch (emailError) {
      const { error: cleanupError } = await supabase
        .from('password_reset_otps')
        .delete()
        .eq('email', email);
      if (cleanupError) console.error('Échec du nettoyage OTP après erreur e-mail :', cleanupError);
      throw emailError;
    }

    return res.status(200).json({ message: GENERIC_RESET_MESSAGE });
  } catch (error) {
    console.error('Erreur demande réinitialisation mot de passe :', error);
    return res.status(500).json({ message: 'Impossible d’envoyer le code de réinitialisation. Réessayez plus tard.' });
  }
};

export const resetPasswordWithOtp = async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const otp = String(req.body?.otp || '').trim();
  const password = req.body?.password;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(otp) || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: 'Adresse e-mail, code à 6 chiffres et mot de passe de 8 caractères minimum requis.' });
  }

  try {
    const { data: reset, error: resetError } = await supabase
      .from('password_reset_otps')
      .select('id, account_type, account_id, otp_hash, expires_at, attempts')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (resetError) throw resetError;

    if (!reset || new Date(reset.expires_at) <= new Date() || reset.attempts >= RESET_OTP_MAX_ATTEMPTS) {
      return res.status(400).json({ message: 'Code invalide ou expiré. Demandez un nouveau code.' });
    }

    if (!await bcrypt.compare(otp, reset.otp_hash)) {
      const { error: attemptsError } = await supabase
        .from('password_reset_otps')
        .update({ attempts: reset.attempts + 1 })
        .eq('id', reset.id);
      if (attemptsError) throw attemptsError;
      return res.status(400).json({ message: 'Code invalide ou expiré. Demandez un nouveau code.' });
    }

    const accountTables = {
      admin: { table: 'admins', passwordColumn: 'password' },
      superviseur: { table: 'superviseurs', passwordColumn: 'password' },
      operateur: { table: 'operateurs', passwordColumn: 'password_hash' },
      company: { table: 'companies', passwordColumn: 'password_hash' }
    };
    const account = accountTables[reset.account_type];
    if (!account) throw new Error('Type de compte OTP inconnu');

    const passwordHash = await bcrypt.hash(password, 10);
    const { data: updatedUser, error: updateError } = await supabase
      .from(account.table)
      .update({ [account.passwordColumn]: passwordHash, updated_at: new Date().toISOString() })
      .eq('id', reset.account_id)
      .eq('email', email)
      .select('id')
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updatedUser) return res.status(400).json({ message: 'Compte introuvable. Demandez un nouveau code.' });

    const { error: deleteError } = await supabase
      .from('password_reset_otps')
      .delete()
      .eq('id', reset.id);
    if (deleteError) throw deleteError;

    return res.status(200).json({ message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' });
  } catch (error) {
    console.error('Erreur validation réinitialisation mot de passe :', error);
    return res.status(500).json({ message: 'Impossible de réinitialiser le mot de passe. Réessayez plus tard.' });
  }
};

/* ---------------------------------------------------------
   🔹 Vérifie le rôle d'un utilisateur via son email
----------------------------------------------------------*/
export const checkUserRole = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: 'Email requis' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const safeLookup = async (table, select, label) => {
      try {
        const { data, error } = await supabase
          .from(table)
          .select(select)
          .ilike('email', normalizedEmail)
          .maybeSingle();

        if (error) {
          if (error.code === 'PGRST116' || error.code === '42703') {
            return null;
          }
          throw error;
        }

        return data;
      } catch (error) {
        console.error(`Supabase error checking ${label}:`, error);
        throw error;
      }
    };

    let admin = null;
    let company = null;
    let operateur = null;
    let superviseur = null;

    try {
      admin = await safeLookup('admins', 'id, email, profile, password', 'admin');
    } catch (err) {
      return res.status(503).json({
        role: 'unknown',
        message: 'Service de données indisponible. Vérifiez la base de données Supabase.'
      });
    }

    if (admin) {
      return res.json({
        role: 'admin',
        has_password: !!admin.password,
        profile: admin.profile
      });
    }

    try {
      company = await safeLookup('companies', 'id, company_name, email, password_hash, status', 'company');
    } catch (err) {
      return res.status(503).json({
        role: 'unknown',
        message: 'Service de données indisponible. Vérifiez la base de données Supabase.'
      });
    }

    if (company) {
      return res.json({
        role: 'company',
        has_password: !!company.password_hash,
        status: company.status || 'Inactif',
        company_name: company.company_name,
        id: company.id
      });
    }

    try {
      operateur = await safeLookup('operateurs', 'id, email, password_hash', 'operateur');
    } catch (err) {
      return res.status(503).json({
        role: 'unknown',
        message: 'Service de données indisponible. Vérifiez la base de données Supabase.'
      });
    }

    if (operateur) {
      return res.json({
        role: 'operateur',
        has_password: !!operateur.password_hash,
        id: operateur.id
      });
    }

    try {
      superviseur = await safeLookup('superviseurs', 'id, email, password, profile', 'superviseur');
    } catch (err) {
      return res.status(503).json({
        role: 'unknown',
        message: 'Service de données indisponible. Vérifiez la base de données Supabase.'
      });
    }

    if (superviseur) {
      return res.json({
        role: 'superviseur',
        has_password: !!superviseur.password,
        profile: superviseur.profile,
        id: superviseur.id
      });
    }

    return res.status(404).json({
      role: 'unknown',
      message: 'Aucun compte associé à cet email'
    });

  } catch (err) {
    console.error('checkUserRole error:', err);
    return res.status(503).json({
      role: 'unknown',
      message: 'Service de données indisponible. Vérifiez la base de données Supabase.'
    });
  }
};
