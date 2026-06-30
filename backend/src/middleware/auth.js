const jwt = require('jsonwebtoken');
const User = require('../models/User');

const normalizeRole = (role) => (role === 'ADMIN' ? 'PO_ADMIN' : role);

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = await User.findById(decoded.id).select('-password');

  if (!req.user) {
    return res.status(401).json({ message: 'User not found' });
  }

  if (!req.user.isActive) {
    return res.status(403).json({
      message: 'This account has been deactivated. Please contact your administrator if you need access.',
    });
  }

  next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    const effectiveRole = normalizeRole(req.user.role);
    if (!roles.includes(effectiveRole)) {
      return res.status(403).json({
        message: `Role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
