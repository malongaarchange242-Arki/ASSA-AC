// Fichier: Frontend/auth.js

/**
 * Tente de récupérer les informations utilisateur à partir des cookies.
 * C'est la méthode à privilégier pour vérifier si un utilisateur est connecté.
 */
export async function getCurrentUser() {
  try {
    // Cet endpoint doit être protégé et ne répondre qu'avec les infos
    // de l'utilisateur si le cookie JWT est valide.
    const response = await fetch('/api/auth/me'); // À créer côté backend

    if (!response.ok) {
      // Si le statut est 401/403, l'utilisateur n'est pas connecté
      if (response.status === 401 || response.status === 403) {
        return null;
      }
      // Gérer d'autres erreurs serveur
      throw new Error('Erreur serveur lors de la récupération de l\'utilisateur');
    }

    const userData = await response.json();
    return userData;

  } catch (error) {
    console.error("Erreur dans getCurrentUser:", error);
    return null;
  }
}

/**
 * Gère la déconnexion de l'utilisateur.
 * Appelle l'endpoint backend qui supprime les cookies d'authentification.
 */
export async function logout() {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('La déconnexion a échoué.');
    }

    // Rediriger vers la page de connexion après la déconnexion
    window.location.href = '/Index.html';

  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    // Gérer l'erreur, par exemple, en affichant un message à l'utilisateur
  }
}

/**
 * Une fonction utilitaire pour effectuer des appels API authentifiés.
 * Elle configure automatiquement les headers nécessaires.
 * Note: Avec les cookies httpOnly, le navigateur enverra automatiquement
 * le cookie. Cette fonction reste utile pour la configuration de 'credentials: include'
 * et pour centraliser la logique de fetch.
 */
export async function fetchWithAuth(url, options = {}) {
  const defaultOptions = {
    ...options,
    credentials: 'include', // TRÈS IMPORTANT: pour envoyer les cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const response = await fetch(url, defaultOptions);

  if (!response.ok) {
    // Si le token est invalide/expiré, le serveur répondra 401
    if (response.status === 401) {
      // On pourrait tenter un refresh token ici, ou simplement déconnecter
      console.log('Session expirée ou invalide. Déconnexion...');
      await logout();
      // Lever une erreur pour que l'appelant sache que la requête a échoué
      throw new Error('Unauthorized');
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}