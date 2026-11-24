const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token tidak ada. Login dulu.' });
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: Number(p.sub), role: p.role, email: p.email };
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Token tidak valid atau sudah kedaluwarsa' });
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ error: `Hanya untuk peran: ${roles.join(', ')}` });

function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { auth, requireRole, signToken };
