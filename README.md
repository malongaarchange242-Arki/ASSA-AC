"# ASSA-AC" 
"# ASSA-AC-" 

## E-mail en production

En production, configurez `RESEND_API_KEY` et `EMAIL_FROM` dans les variables d’environnement du service. `EMAIL_FROM` doit être une adresse d’expédition autorisée par un domaine vérifié dans Resend (par exemple `ASSA-AC <notifications@votre-domaine.fr>`).

En local, si `RESEND_API_KEY` n’est pas défini, le service conserve l’envoi SMTP avec `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` et, si nécessaire, `SMTP_SECURE=true`.
