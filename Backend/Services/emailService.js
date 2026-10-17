import nodemailer from 'nodemailer';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function getBrevoSender(from) {
  const configuredSender = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM || from;
  if (!configuredSender) return null;

  const normalizedSender = String(configuredSender).replace(/^\s*SMTP_FROM\s*=\s*/i, '').trim();
  const formattedSender = normalizedSender.match(/^(.*?)\s*<([^<>]+)>$/);
  const email = (formattedSender ? formattedSender[2] : normalizedSender).trim();
  const name = process.env.BREVO_SENDER_NAME
    || (formattedSender?.[1].trim() || 'ASSA-AC');

  return { email, name };
}

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
  if (process.env.BREVO_API_KEY) {
    return Boolean(getBrevoSender());
  }
  return Boolean(getSmtpConfiguration());
}

export async function sendEmail({ to, subject, text, html, attachments = [], from }) {
  if (!to) throw new Error('Destinataire e-mail manquant');
  if (!subject) throw new Error('Objet de l’e-mail manquant');

  if (process.env.BREVO_API_KEY) {
    const sender = getBrevoSender(from);
    if (!sender) {
      throw new Error('SMTP_FROM (ou BREVO_SENDER_EMAIL) est requis pour envoyer des e-mails via Brevo');
    }

    const payload = {
      sender,
      to: (Array.isArray(to) ? to : [to]).map(recipient => (
        typeof recipient === 'string' ? { email: recipient } : recipient
      )),
      subject,
      ...(text ? { textContent: text } : {}),
      ...(html ? { htmlContent: html } : {}),
      ...(attachments.length ? {
        attachment: attachments.map((attachment) => {
          if (!attachment.content) {
            throw new Error(`Contenu manquant pour la pièce jointe ${attachment.filename || ''}`);
          }

          return {
            name: attachment.filename,
            content: Buffer.isBuffer(attachment.content)
              ? attachment.content.toString('base64')
              : attachment.content
          };
        })
      } : {})
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail = result.message || result.code || `HTTP ${response.status}`;
        throw new Error(`Brevo a refusé l’envoi : ${detail}`);
      }
      if (!result.messageId) throw new Error('Brevo n’a pas retourné d’identifiant de message');

      return {
        provider: 'brevo',
        messageId: result.messageId,
        response: `Accepted by Brevo (${result.messageId})`,
        accepted: Array.isArray(to) ? to.map(recipient => (
          typeof recipient === 'string' ? recipient : recipient.email
        )) : [to]
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Délai dépassé lors de la connexion à Brevo');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  const smtp = getSmtpConfiguration();
  if (!smtp) {
    throw new Error('Configuration e-mail manquante : configurez BREVO_API_KEY et SMTP_FROM (ou BREVO_SENDER_EMAIL), ou les variables SMTP');
  }

  const sender = from || process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER;
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
