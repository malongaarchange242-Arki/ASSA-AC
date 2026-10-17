import nodemailer from 'nodemailer';

const RESEND_API_URL = 'https://api.resend.com/emails';

function getSmtpConfiguration() {
  const port = Number(process.env.SMTP_PORT);
  if (!process.env.SMTP_HOST || !port || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return {
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  };
}

export function isEmailConfigured() {
  if (process.env.RESEND_API_KEY) {
    return Boolean(process.env.EMAIL_FROM);
  }
  return Boolean(getSmtpConfiguration());
}

export async function sendEmail({ to, subject, text, html, attachments = [], from }) {
  if (!to) throw new Error('Destinataire e-mail manquant');
  if (!subject) throw new Error('Objet de l’e-mail manquant');

  if (process.env.RESEND_API_KEY) {
    const sender = process.env.EMAIL_FROM || from;
    if (!sender) {
      throw new Error('EMAIL_FROM est requis pour envoyer des e-mails via Resend');
    }

    const payload = {
      from: sender,
      to: Array.isArray(to) ? to : [to],
      subject,
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
      ...(attachments.length ? {
        attachments: attachments.map((attachment) => {
          if (!attachment.content) {
            throw new Error(`Contenu manquant pour la pièce jointe ${attachment.filename || ''}`);
          }

          return {
            filename: attachment.filename,
            content: Buffer.isBuffer(attachment.content)
              ? attachment.content.toString('base64')
              : attachment.content,
            ...(attachment.contentType ? { content_type: attachment.contentType } : {})
          };
        })
      } : {})
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail = result.message || result.error || `HTTP ${response.status}`;
        throw new Error(`Resend a refusé l’envoi : ${detail}`);
      }
      if (!result.id) throw new Error('Resend n’a pas retourné d’identifiant de message');

      return {
        provider: 'resend',
        messageId: result.id,
        response: `Accepted by Resend (${result.id})`,
        accepted: Array.isArray(to) ? to : [to]
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Délai dépassé lors de la connexion à Resend');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  const smtp = getSmtpConfiguration();
  if (!smtp) {
    throw new Error('Configuration e-mail manquante : configurez RESEND_API_KEY et EMAIL_FROM ou les variables SMTP');
  }

  const sender = from || process.env.EMAIL_FROM || process.env.SMTP_USER;
  const transporter = nodemailer.createTransport(smtp);
  const info = await transporter.sendMail({
    from: sender,
    to,
    subject,
    text,
    html,
    attachments
  });

  return {
    ...info,
    provider: 'smtp'
  };
}
