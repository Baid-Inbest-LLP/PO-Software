const { validationResult } = require('express-validator');
const User = require('../models/User');
const { sendTokenResponse } = require('../utils/helpers');
const { processSignatureUpload, signatureBase64ToDataUri } = require('../utils/processSignatureImage');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const HARDCODED_SUPERADMIN = {
  name: 'System Superadmin',
  email: normalizeEmail(process.env.SUPERADMIN_EMAIL || 'superadmin@inbestnow.com'),
  password: process.env.SUPERADMIN_PASSWORD || 'Superadmin@123',
  role: 'SUPERADMIN',
};

const USER_CREATABLE_ROLES = ['PO_ADMIN', 'PO_Assistant'];
const normalizeRole = (role) => (role === 'ADMIN' ? 'PO_ADMIN' : role);
const isPoAdminRole = (role) => {
  const r = normalizeRole(role);
  return r === 'PO_ADMIN';
};

const canManageUser = (actorRole, targetRole) => {
  const normalizedTargetRole = normalizeRole(targetRole);
  if (actorRole === 'SUPERADMIN') return normalizedTargetRole !== 'SUPERADMIN';
  if (actorRole === 'PO_ADMIN') return normalizedTargetRole === 'PO_Assistant';
  return false;
};

const toPublicUser = (user, { includeSignature = false } = {}) => {
  if (!user) return null;
  const doc = user.toObject ? user.toObject() : user;
  const out = {
    _id: doc._id,
    name: doc.name,
    email: doc.email,
    role: doc.role,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    hasSignature: Boolean(doc.signatureImage),
  };
  if (includeSignature && doc.signatureImage) {
    out.signaturePreview = signatureBase64ToDataUri(doc.signatureImage);
  }
  return out;
};

const ensureHardcodedSuperadmin = async () => {
  const existingSuperadmin = await User.findOne({ email: HARDCODED_SUPERADMIN.email });
  if (existingSuperadmin) return existingSuperadmin;
  const createdSuperadmin = await User.create(HARDCODED_SUPERADMIN);
  return createdSuperadmin;
};

const applySignatureToUser = (user, signatureImageInput, { required = false } = {}) => {
  if (signatureImageInput === undefined) {
    if (required && !user.signatureImage) {
      throw new Error('Signature image is required for PO Admin users');
    }
    return;
  }
  const processed = processSignatureUpload(signatureImageInput);
  if (processed === undefined) return;
  if (!processed && required) {
    throw new Error('Signature image is required for PO Admin users');
  }
  user.signatureImage = processed;
};

const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { name, email, password, role, signatureImage } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: 'Email already registered' });
  }

  const actorRole = normalizeRole(req.user?.role);
  const requestedRole = USER_CREATABLE_ROLES.includes(role) ? role : 'PO_Assistant';
  if (actorRole === 'PO_ADMIN' && requestedRole !== 'PO_Assistant') {
    return res.status(403).json({ message: 'PO Admin can only create PO Assistant users' });
  }

  const user = new User({
    name,
    email,
    password,
    role: requestedRole,
  });

  if (isPoAdminRole(requestedRole) && signatureImage) {
    try {
      applySignatureToUser(user, signatureImage, { required: false });
    } catch (err) {
      return res.status(400).json({ message: err.message || 'Invalid signature image' });
    }
  }

  await user.save();

  res.status(201).json({
    message: 'User created successfully',
    user: toPublicUser(user),
  });
};

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  await ensureHardcodedSuperadmin();

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  if (!user.isActive) {
    return res.status(403).json({
      message: 'This account has been deactivated. Please contact your administrator if you need access.',
    });
  }

  sendTokenResponse(user, 200, res);
};

const getMe = async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('_id name email role isActive company createdAt updatedAt')
    .lean();
  res.json(user);
};

const updateProfile = async (req, res) => {
  const { name, company } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name, company },
    { new: true, runValidators: true }
  );

  res.json(user);
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (currentPassword === undefined || String(currentPassword).length === 0) {
    return res.status(400).json({ message: 'Current password is required' });
  }
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' });
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    return res.status(400).json({ message: 'Current password is incorrect' });
  }

  user.password = newPassword;
  await user.save();

  res.json({ message: 'Password updated successfully' });
};

const getUsers = async (req, res) => {
  const actorRole = normalizeRole(req.user?.role);
  const filter = {};
  if (actorRole === 'PO_ADMIN') {
    filter.role = { $in: ['PO_ADMIN', 'ADMIN', 'PO_Assistant'] };
  }

  const users = await User.find(filter)
    .select('_id name email role isActive createdAt +signatureImage')
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    users: users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
      hasSignature: Boolean(u.signatureImage),
    })),
  });
};

const getUserSignature = async (req, res) => {
  const { id } = req.params;
  const target = await User.findById(id).select('+signatureImage name role');
  if (!target) return res.status(404).json({ message: 'User not found' });

  const actorRole = normalizeRole(req.user?.role);
  if (actorRole !== 'SUPERADMIN' && !isPoAdminRole(target.role)) {
    return res.status(403).json({ message: 'Not allowed' });
  }
  if (!isPoAdminRole(target.role)) {
    return res.status(400).json({ message: 'This user does not use a PO Admin signature' });
  }

  res.json({
    hasSignature: Boolean(target.signatureImage),
    signaturePreview: target.signatureImage ? signatureBase64ToDataUri(target.signatureImage) : '',
  });
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  const target = await User.findById(id);
  if (!target) return res.status(404).json({ message: 'User not found' });
  const actorRole = normalizeRole(req.user?.role);

  if (target.email === HARDCODED_SUPERADMIN.email) {
    return res.status(403).json({ message: 'Cannot delete SUPERADMIN user' });
  }

  if (target.role === 'SUPERADMIN') {
    return res.status(403).json({ message: 'SUPERADMIN users cannot be deleted' });
  }

  if (!canManageUser(actorRole, target.role)) {
    return res.status(403).json({ message: 'You can only delete PO Assistant users' });
  }

  await User.findByIdAndDelete(id);
  res.json({ message: 'User deleted successfully' });
};

const updateUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { id } = req.params;
  const { name, email, isActive, signatureImage, clearSignature } = req.body;

  const target = await User.findById(id).select('+signatureImage');
  if (!target) return res.status(404).json({ message: 'User not found' });
  const actorRole = normalizeRole(req.user?.role);
  const targetRole = normalizeRole(target.role);

  if (target.role === 'SUPERADMIN') {
    return res.status(403).json({ message: 'SUPERADMIN accounts cannot be updated from user management' });
  }

  if (!canManageUser(actorRole, target.role)) {
    return res.status(403).json({ message: 'You can only edit PO Assistant users' });
  }

  const emailNorm = String(email).toLowerCase().trim();
  if (emailNorm !== target.email) {
    const taken = await User.findOne({ email: emailNorm, _id: { $ne: id } });
    if (taken) return res.status(400).json({ message: 'Email already in use' });
  }

  target.name = String(name).trim();
  target.email = emailNorm;
  target.isActive = Boolean(isActive);

  if (targetRole === 'PO_ADMIN') {
    if (actorRole !== 'SUPERADMIN') {
      return res.status(403).json({ message: 'Only Superadmin can edit PO Admin users' });
    }
    try {
      if (clearSignature) {
        target.signatureImage = '';
      } else {
        applySignatureToUser(target, signatureImage, { required: false });
      }
    } catch (err) {
      return res.status(400).json({ message: err.message || 'Invalid signature image' });
    }
  } else {
    target.signatureImage = '';
  }

  await target.save();

  res.json({
    message: 'User updated successfully',
    user: toPublicUser(target),
  });
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  getUsers,
  getUserSignature,
  deleteUser,
  updateUser,
};
