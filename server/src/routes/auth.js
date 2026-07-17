const express = require('express');
const { body } = require('express-validator');
const {
  register,
  login,
  getMe,
  getMyAvatar,
  updateProfile,
  changePassword,
  getUsers,
  getUserSignature,
  deleteUser,
  updateUser,
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
const PASSWORD_POLICY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[ !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]).{8,}$/;

router.post(
  '/register',
  protect,
  authorize('SUPERADMIN', 'PO_ADMIN'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('password')
      .matches(PASSWORD_POLICY)
      .withMessage('Password must be at least 8 characters and include uppercase, lowercase, number, and special character'),
    body('role').optional().isIn(['PO_ADMIN', 'PO_Assistant']).withMessage('Role must be PO_ADMIN or PO_Assistant'),
    body('signatureImage').optional().isString(),
  ],
  register
);

router.post(
  '/login',
  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

router.get('/me', protect, getMe);
router.get('/me/avatar', protect, getMyAvatar);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);

router.get('/users', protect, authorize('SUPERADMIN', 'PO_ADMIN'), getUsers);
router.get('/users/:id/signature', protect, authorize('SUPERADMIN'), getUserSignature);
router.put(
  '/users/:id',
  protect,
  authorize('SUPERADMIN', 'PO_ADMIN'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('isActive').isBoolean().withMessage('Status must be active or inactive'),
    body('signatureImage').optional().isString(),
    body('clearSignature').optional().isBoolean(),
  ],
  updateUser
);
router.delete('/users/:id', protect, authorize('SUPERADMIN', 'PO_ADMIN'), deleteUser);

module.exports = router;
