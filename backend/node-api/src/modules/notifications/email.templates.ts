
// modules/notifications/email.templates.ts

export interface EmailTemplateInput {
  prenom?: string;
  requestRef?: string;
  links?: Array<{ name: string; url: string }>;
}

/**
 * Escape HTML to prevent injection (even in emails)
 */
function escapeHtml(v?: string) {
  if (!v) return '';
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Localized greeting
 */
function greeting(lang: 'fr' | 'en', prenom?: string) {
  return lang === 'en'
    ? `Hi${prenom ? ' ' + escapeHtml(prenom) : ''}`
    : `Bonjour${prenom ? ' ' + escapeHtml(prenom) : ''}`;
}

/**
 * Branded email layout
 */
function brandedLayout(title: string, body: string) {
  const logo = process.env.BRAND_LOGO_URL || 'https://example.com/assets/logo.png';
  const primary = process.env.BRAND_PRIMARY_COLOR || '#0b5cff';

  return `
<div style="font-family:Arial,Helvetica,sans-serif;color:#222">
  <div style="display:flex;align-items:center;gap:12px">
    <img src="${logo}" alt="logo" style="height:48px" />
    <h2 style="color:${primary};margin:0">${escapeHtml(title)}</h2>
  </div>

  <div style="margin-top:12px">
    ${body}
  </div>

  <hr/>

  <p style="font-size:12px;color:#777">
    Plateforme FERI / AD – Ceci est un message automatique.
  </p>
</div>
`;
}

/**
 * Shared helper to render secure links
 */
function renderLinks(links?: Array<{ name: string; url: string }>) {
  if (!links || !links.length) return '';
  return `
<ul>
  ${links
    .map(
      l =>
        `<li><a href="${escapeHtml(l.url)}">${escapeHtml(l.name)}</a></li>`
    )
    .join('')}
</ul>
`;
}

export const EmailTemplates = {
  REQUEST_CREATED: (lang: 'fr' | 'en', input: EmailTemplateInput) =>
    brandedLayout(
      lang === 'en' ? 'Request created' : 'Demande créée',
      `
<p>${greeting(lang, input.prenom)},</p>
<p>
  ${
    lang === 'en'
      ? `Your request${input.requestRef ? ' (' + escapeHtml(input.requestRef) + ')' : ''} has been registered in our system.`
      : `Votre demande${input.requestRef ? ' (' + escapeHtml(input.requestRef) + ')' : ''} a été enregistrée dans notre système.`
  }
</p>

<p style="margin-top:8px;color:#555;font-size:14px">
  ${
    lang === 'en'
      ? 'What to do: upload the required documents listed in your request to begin verification.'
      : 'À faire : téléversez les documents requis indiqués dans votre demande afin de lancer la vérification.'
  }
</p>
`
    ),

  REQUEST_SUBMITTED: (lang: 'fr' | 'en', input: EmailTemplateInput) =>
    brandedLayout(
      lang === 'en' ? 'Request submitted' : 'Demande soumise',
      `
<p>${greeting(lang, input.prenom)},</p>
<p>
  ${
    lang === 'en'
      ? `Your request <strong>${escapeHtml(input.requestRef)}</strong> has been submitted to our operations team for document review.`
      : `La demande <strong>${escapeHtml(input.requestRef)}</strong> a été transmise à notre équipe opérationnelle pour vérification des documents.`
  }
</p>

<p style="margin-top:8px;color:#555;font-size:14px">
  ${
    lang === 'en'
      ? 'What happens next: our team will verify the submitted documents. We will contact you only if additional information is required.'
      : 'Étapes suivantes : notre équipe vérifiera les documents. Nous vous contacterons uniquement si des informations supplémentaires sont nécessaires.'
  }
</p>
`
    ),

  DRAFT_SENT: (lang: 'fr' | 'en', input: EmailTemplateInput) =>
    brandedLayout(
      lang === 'en' ? 'Draft sent' : 'Draft envoyé',
        `
  <p>${greeting(lang, input.prenom)},</p>

  ${
    input.prenom === 'Admin'
      ? (lang === 'en'
    ? `
  <p>The draft and proforma for client <strong>${escapeHtml((input as any).client_name || '—')}</strong> (${escapeHtml((input as any).client_email || '—')}) — reference <strong>${escapeHtml(input.requestRef || '—')}</strong> have been issued to the client.</p>
  <p>Action required: monitor payment reception in the administration dashboard and proceed with validation once payment is confirmed.</p>
  <p>Admin access: <strong>${escapeHtml((input as any).admin_dashboard_url || process.env.ADMIN_DASHBOARD_URL || '—')}</strong></p>
  <p>Kind regards,<br/><strong>Maritime Kargo Consulting</strong></p>
    `
    : `
  <p>Le draft et la proforma pour le client <strong>${escapeHtml((input as any).client_name || '—')}</strong> (${escapeHtml((input as any).client_email || '—')}) — référence <strong>${escapeHtml(input.requestRef || '—')}</strong> ont été générés et envoyés au client.</p>
  <p>Action requise : suivez la réception du paiement via l’interface d’administration et poursuivez la validation une fois le paiement confirmé.</p>
  <p>Accès administration : <strong>${escapeHtml((input as any).admin_dashboard_url || process.env.ADMIN_DASHBOARD_URL || '—')}</strong></p>
  <p>Cordialement,<br/><strong>Maritime Kargo Consulting</strong></p>
    `)
      : (lang === 'en'
    ? `
  <p>The draft FERI and the proforma invoice for request <strong>${escapeHtml(input.requestRef || '—')}</strong> are now available for download.</p>
  ${renderLinks(input.links)}
  <p>What to do: review the draft and the proforma. Payment is required to proceed to final issuance. Download links are temporary (usually valid 30–60 minutes).</p>
  <p>Kind regards,<br/><strong>Maritime Kargo Consulting</strong></p>
    `
    : `
  <p>Le draft FERI et la facture proforma pour la demande <strong>${escapeHtml(input.requestRef || '—')}</strong> sont disponibles au téléchargement.</p>
  ${renderLinks(input.links)}
  <p>À faire : vérifiez le draft et la proforma. Le paiement est requis pour l’émission finale. Les liens sont temporaires (généralement valables 30–60 minutes).</p>
  <p>Cordialement,<br/><strong>Maritime Kargo Consulting</strong></p>
    `)
  }
  `
    ),

  DRAFT_AVAILABLE: (lang: 'fr' | 'en', input: EmailTemplateInput) =>
    brandedLayout(
      lang === 'en' ? 'Draft available' : 'Draft et proforma disponibles',
      `
<p>${greeting(lang, input.prenom)},</p>
<p>
  ${
    lang === 'en'
      ? 'The draft FERI and the proforma invoice are available for review.'
      : 'Le draft FERI et la facture proforma sont disponibles pour consultation.'
  }
</p>

${renderLinks(input.links)}

<p style="margin-top:8px;color:#666;font-size:13px">
  ${
    lang === 'en'
      ? 'Please review the documents. Payment is required to proceed to final issuance. Download links are temporary (typically 30–60 minutes).'
      : 'Merci de vérifier les documents. Le paiement est requis pour poursuivre et obtenir le document final. Les liens de téléchargement sont temporaires (généralement 30–60 minutes).'
  }
</p>
`
    ),

  PAYMENT_CONFIRMED: (lang: 'fr' | 'en', input: EmailTemplateInput) =>
    brandedLayout(
      lang === 'en' ? 'Payment confirmed' : 'Paiement confirmé',
      `
<p>${greeting(lang, input.prenom)},</p>
<p>
  ${
    lang === 'en'
      ? 'We have received and recorded your payment.'
      : 'Nous avons reçu et enregistré votre paiement.'
  }
</p>

${renderLinks(input.links)}

<p style="margin-top:8px;color:#666;font-size:13px">
  ${
    lang === 'en'
      ? 'What happens next: we will generate the final document and notify you when it is ready for download. Provided links are temporary.'
      : 'Étape suivante : nous allons générer le document final et vous informer dès qu’il sera disponible au téléchargement. Les liens fournis sont temporaires.'
  }
</p>

<p style="color:#666;font-size:12px">
  ${lang === 'en' ? 'Reference' : 'Référence'} :
  <strong>${escapeHtml(input.requestRef)}</strong>
</p>
`
    ),

  REQUEST_COMPLETED: (lang: 'fr' | 'en', input: EmailTemplateInput) =>
    brandedLayout(
      lang === 'en' ? 'Request completed' : 'Demande traitée',
      (input.prenom === 'Admin'
          ? (lang === 'en'
              ? `
<p>${greeting(lang, input.prenom)},</p>
<p>The file for <strong>${escapeHtml((input as any).client_name || '—')}</strong> (${escapeHtml((input as any).client_email || '—')}) — reference <strong>${escapeHtml(input.requestRef || (input as any).entityId || '—')}</strong> is ready for administrative review.</p>
<p>Action required: verify the uploaded documents in the administration dashboard and confirm conformity to continue processing.</p>
<p>Admin access: <strong>${escapeHtml((input as any).admin_dashboard_url || process.env.ADMIN_DASHBOARD_URL || '—')}</strong></p>
<p>Kind regards,<br/><strong>Maritime Kargo Consulting</strong></p>
              `
              : `
<p>${greeting(lang, input.prenom)},</p>
<p>Le dossier de <strong>${escapeHtml((input as any).client_name || '—')}</strong> (${escapeHtml((input as any).client_email || '—')}) — référence <strong>${escapeHtml(input.requestRef || (input as any).entityId || '—')}</strong> est prêt pour vérification administrative.</p>
<p>Action requise : contrôlez les pièces dans l’interface d’administration et confirmez la conformité pour poursuivre le traitement.</p>
<p>Accès administration : <strong>${escapeHtml((input as any).admin_dashboard_url || process.env.ADMIN_DASHBOARD_URL || '—')}</strong></p>
<p>Cordialement,<br/><strong>Maritime Kargo Consulting</strong></p>
              `)
          : (lang === 'en'
              ? `
<p>${greeting(lang, input.prenom)},</p>
<p>We have received and validated the documents for your request <strong>${escapeHtml(input.requestRef)}</strong>.</p>
<p>The file is complete and is now being processed. No action is required from you at this time.</p>
<p>We will notify you as soon as the next step is completed.</p>
<p>Kind regards,<br/><strong>Maritime Kargo Consulting</strong></p>
              `
              : `
<p>${greeting(lang, input.prenom)},</p>
<p>Nous confirmons la réception et la validation des documents relatifs à votre dossier <strong>${escapeHtml(input.requestRef)}</strong>.</p>
<p>Le dossier est complet et est désormais en cours de traitement. Aucune action de votre part n’est requise pour l’instant.</p>
<p>Nous vous informerons dès la prochaine étape réalisée.</p>
<p>Cordialement,<br/><strong>Maritime Kargo Consulting</strong></p>
              `)
      )
    ),

  REQUEST_REJECTED: (lang: 'fr' | 'en', input: EmailTemplateInput) =>
    brandedLayout(
      lang === 'en' ? 'Request rejected' : 'Demande rejetée',
      `
<p>${greeting(lang, input.prenom)},</p>
<p>
  ${
    lang === 'en'
      ? 'What happened: one or more submitted documents are incomplete or do not meet our requirements.'
      : 'Ce qui s’est passé : un ou plusieurs documents fournis sont incomplets ou non conformes.'
  }
</p>

<p>
  ${
    lang === 'en'
      ? 'Action required: please review the issues in your account and upload the corrected documents. We will re-check once the corrected files are received.'
      : 'Action requise : consultez les éléments signalés dans votre espace et téléversez les documents corrigés. Nous relancerons la vérification dès réception.'
  }
</p>

<p style="margin-top:8px;color:#666;font-size:13px">
  ${lang === 'en' ? 'Reference' : 'Référence'} : <strong>${escapeHtml(input.requestRef)}</strong>
</p>
`
    )
};
