const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

router.use(protect);

router.get('/company', authorize('SUPERADMIN', 'PO_ADMIN'), async (req, res) => {
  const user = await User.findById(req.user._id).select('company').lean();
  res.json(user.company);
});

router.put('/company', authorize('SUPERADMIN', 'PO_ADMIN'), async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { company: req.body },
    { new: true }
  );
  res.json(user.company);
});

module.exports = router;
