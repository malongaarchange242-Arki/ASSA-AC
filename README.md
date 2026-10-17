"# ASSA-AC" 
"# ASSA-AC-" 

## E-mail en production

En production, configurez `BREVO_API_KEY` et `SMTP_FROM` dans les variables d’environnement du service Render. `SMTP_FROM` doit contenir l’adresse validée dans Brevo, au format `Softura <adresse@domaine.fr>` (sans préfixer la valeur par `SMTP_FROM=`). Vous pouvez aussi utiliser `BREVO_SENDER_EMAIL` avec `BREVO_SENDER_NAME`. Les messages partent via l’API HTTPS de Brevo, avec les pièces jointes encodées en base64.

En local, si `BREVO_API_KEY` n’est pas défini, le service conserve l’envoi SMTP avec `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` et, si nécessaire, `SMTP_SECURE=true`. `SMTP_FROM` est également utilisé comme adresse d’expédition lorsqu’il est défini.
