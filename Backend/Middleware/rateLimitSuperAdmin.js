import rateLimit from 'express-rate-limit';

export const superAdminRateLimit = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 5,                   // 5 tentatives max
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Trop de tentatives. Réessayez dans 1 minute.'
  }
});
