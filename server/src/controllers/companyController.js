const Company = require('../models/Company');
const { normalizeCompany } = require('../utils/normalize');
const { processSignatureUpload, signatureBase64ToDataUri } = require('../utils/processSignatureImage');

const toPublicCompany = (company) => {
  const doc = company?.toObject ? company.toObject() : { ...company };
  const { stampImage, ...rest } = doc;
  return {
    ...rest,
    hasStamp: Boolean(stampImage),
  };
};

const applyStampToCompany = (company, stampImageInput, { clearStamp = false } = {}) => {
  if (clearStamp) {
    company.stampImage = '';
    return;
  }
  if (stampImageInput === undefined) return;
  const processed = processSignatureUpload(stampImageInput);
  if (processed !== undefined) company.stampImage = processed;
};

const pickCompanyBody = (body = {}) => {
  const { stampImage, clearStamp, ...rest } = body;
  return {
    normalized: normalizeCompany(rest),
    stampImage,
    clearStamp: Boolean(clearStamp),
  };
};

const getCompanies = async (req, res) => {
  const { search, isActive, page = 1, limit = 50 } = req.query;
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const filter = {};

  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { companyCode: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await Company.countDocuments(filter);
  const companies = await Company.find(filter)
    .select('+stampImage')
    .sort({ createdAt: -1 })
    .skip((parsedPage - 1) * parsedLimit)
    .limit(parsedLimit)
    .lean();

  res.json({
    companies: companies.map((c) => {
      const { stampImage, ...rest } = c;
      return { ...rest, hasStamp: Boolean(stampImage) };
    }),
    total,
    page: parsedPage,
    pages: Math.ceil(total / parsedLimit),
  });
};

const getCompany = async (req, res) => {
  const company = await Company.findOne({ _id: req.params.id }).select('+stampImage').lean();
  if (!company) return res.status(404).json({ message: 'Company not found' });
  const { stampImage, ...rest } = company;
  res.json({ ...rest, hasStamp: Boolean(stampImage) });
};

const getCompanyStamp = async (req, res) => {
  const company = await Company.findOne({ _id: req.params.id }).select('+stampImage companyCode name');
  if (!company) return res.status(404).json({ message: 'Company not found' });
  res.json({
    hasStamp: Boolean(company.stampImage),
    stampPreview: company.stampImage ? signatureBase64ToDataUri(company.stampImage) : '',
  });
};

const createCompany = async (req, res) => {
  const { normalized, stampImage } = pickCompanyBody(req.body);
  const company = new Company({ ...normalized, createdBy: req.user._id });

  if (stampImage) {
    try {
      applyStampToCompany(company, stampImage);
    } catch (err) {
      return res.status(400).json({ message: err.message || 'Invalid stamp image' });
    }
  }

  await company.save();
  res.status(201).json(toPublicCompany(company));
};

const updateCompany = async (req, res) => {
  const company = await Company.findOne({ _id: req.params.id }).select('+stampImage');
  if (!company) return res.status(404).json({ message: 'Company not found' });

  const { normalized, stampImage, clearStamp } = pickCompanyBody(req.body);
  Object.assign(company, normalized);

  try {
    applyStampToCompany(company, stampImage, { clearStamp });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Invalid stamp image' });
  }

  await company.save();
  res.json(toPublicCompany(company));
};

const deleteCompany = async (req, res) => {
  const company = await Company.findOneAndDelete({ _id: req.params.id });
  if (!company) return res.status(404).json({ message: 'Company not found' });
  res.json({ message: 'Company deleted successfully' });
};

const addLocation = async (req, res) => {
  const company = await Company.findOne({ _id: req.params.id }).select('+stampImage');
  if (!company) return res.status(404).json({ message: 'Company not found' });

  if (req.body.isDefault) {
    company.locations.forEach((l) => { l.isDefault = false; });
  }
  const normalized = normalizeCompany({ locations: [req.body] });
  company.locations.push(normalized.locations[0]);
  await company.save();
  res.json(toPublicCompany(company));
};

const updateLocation = async (req, res) => {
  const company = await Company.findOne({ _id: req.params.id }).select('+stampImage');
  if (!company) return res.status(404).json({ message: 'Company not found' });

  const loc = company.locations.id(req.params.locationId);
  if (!loc) return res.status(404).json({ message: 'Location not found' });

  if (req.body.isDefault) {
    company.locations.forEach((l) => { l.isDefault = false; });
  }
  const normalized = normalizeCompany({ locations: [{ ...loc.toObject(), ...req.body }] });
  Object.assign(loc, normalized.locations[0]);
  await company.save();
  res.json(toPublicCompany(company));
};

const deleteLocation = async (req, res) => {
  const company = await Company.findOne({ _id: req.params.id }).select('+stampImage');
  if (!company) return res.status(404).json({ message: 'Company not found' });

  if (company.locations.length <= 1) {
    return res.status(400).json({ message: 'Company must have at least one location' });
  }

  company.locations = company.locations.filter(
    (l) => l._id.toString() !== req.params.locationId
  );

  const hasDefault = company.locations.some((l) => l.isDefault);
  if (!hasDefault && company.locations.length > 0) {
    company.locations[0].isDefault = true;
  }

  await company.save();
  res.json(toPublicCompany(company));
};

module.exports = {
  getCompanies,
  getCompany,
  getCompanyStamp,
  createCompany,
  updateCompany,
  deleteCompany,
  addLocation,
  updateLocation,
  deleteLocation,
};
