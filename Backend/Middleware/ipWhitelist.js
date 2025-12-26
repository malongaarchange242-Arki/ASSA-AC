const ALLOWED_IPS = (process.env.SUPER_ADMIN_IPS || '')
  .split(',')
  .map(ip => ip.trim())
  .filter(Boolean);

export const superAdminIpWhitelist = (req, res, next) => {
  const clientIp =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket.remoteAddress;

  if (!ALLOWED_IPS.includes(clientIp)) {
    return res.status(403).json({
      message: 'Accès Super Admin interdit depuis cette IP'
    });
  }

  next();
};
