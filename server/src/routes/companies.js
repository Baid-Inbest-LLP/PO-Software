const express = require('express');
const {
  getCompanies,
  getCompany,
  getCompanyStamp,
  createCompany,
  updateCompany,
  deleteCompany,
  addLocation,
  updateLocation,
  deleteLocation,
} = require('../controllers/companyController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/').get(getCompanies).post(createCompany);
router.get('/:id/stamp', getCompanyStamp);
router.route('/:id').get(getCompany).put(updateCompany).delete(authorize('PO_ADMIN', 'SUPERADMIN'), deleteCompany);
router.route('/:id/locations').post(addLocation);
router.route('/:id/locations/:locationId').put(updateLocation).delete(authorize('PO_ADMIN', 'SUPERADMIN'), deleteLocation);

module.exports = router;
