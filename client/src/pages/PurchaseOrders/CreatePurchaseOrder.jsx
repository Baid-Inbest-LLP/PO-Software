import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchCompanies } from '../../features/companies/companiesSlice';
import { vendorsAPI, itemsAPI } from '../../services/api';
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  fetchPurchaseOrder,
  clearCurrentOrder,
} from '../../features/purchaseOrders/purchaseOrdersSlice';
import {
  UNITS,
  ITEM_DEPARTMENTS,
  DEPARTMENT_CATEGORIES,
  CATEGORY_COLOR_MAP,
  formatCurrency,
  formatDateInput,
  amountToWords,
  vendorLocationsList,
} from '../../utils/helpers';
import CustomSelect from '../../components/common/CustomSelect';
import toast from 'react-hot-toast';

const emptyLineItem = () => ({
  item: '',
  description: '',
  quantity: '',
  unit: 'pcs',
  unitPrice: 0,
  discount: '',
  gstRate: '',
  gstAmount: 0,
  totalPrice: 0,
});

const emptyForm = () => ({
  company: '',
  shippingLocationId: '',
  vendor: '',
  vendorLocationId: '',
  vendorAddress: {
    label: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
  },
  orderDate: new Date().toISOString().split('T')[0],
  expectedDeliveryDate: '',
  shippingAddress: {
    label: '',
    company: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
  },
  lineItems: [emptyLineItem()],
  taxRate: 0,
  shippingCost: '',
  discountAmount: 0,
  notes: '',
  terms: '',
  status: 'pending',
});

const titleCaseWords = (s) =>
  String(s)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

const shippingLocationOptionLabel = (loc) => {
  const name = (loc.label || '').trim().toUpperCase();
  const city = loc.city ? titleCaseWords(loc.city) : '';
  return [name, city].filter(Boolean).join(' - ');
};

const vendorLocationKey = (loc) => (loc._id != null && loc._id !== '' ? String(loc._id) : 'legacy');

const vendorAddressFromLocation = (loc) => ({
  label: loc?.label?.toUpperCase?.() || '',
  street: loc?.street || '',
  city: loc?.city || '',
  state: loc?.state || '',
  zipCode: loc?.zipCode || '',
  country: loc?.country || '',
});

// Discount first, then GST on discounted price
const calcDiscountAmt = (li) => {
  const base = (li.quantity || 0) * (li.unitPrice || 0);
  return parseFloat((base * ((li.discount || 0) / 100)).toFixed(2));
};

const calcGstAmt = (li) => {
  const base = (li.quantity || 0) * (li.unitPrice || 0);
  const discounted = base - calcDiscountAmt(li);
  return parseFloat((discounted * ((li.gstRate || 0) / 100)).toFixed(2));
};

const calcPreGstAmount = (li) => {
  const base = (li.quantity || 0) * (li.unitPrice || 0);
  return parseFloat((base - calcDiscountAmt(li)).toFixed(2));
};

const calcLineItem = (li) => {
  return parseFloat((calcPreGstAmount(li) + calcGstAmt(li)).toFixed(2));
};

const getItemDepartment = (item) => {
  if (!item) return '';
  if (item.department) return item.department;
  const category = item.category;
  if (!category) return '';
  const entry = Object.entries(DEPARTMENT_CATEGORIES).find(([, cats]) =>
    cats.includes(category)
  );
  return entry ? entry[0] : '';
};

const CreatePurchaseOrder = () => {
  const orderDateRef = useRef(null);
  const deliveryDateRef = useRef(null);

  const openNativeDatePicker = (ref) => {
    const el = ref.current;
    if (!el) return;
    // Chromium-based browsers support showPicker()
    if (typeof el.showPicker === 'function') {
      el.showPicker();
      return;
    }
    // Fallback: focus triggers the native picker in many browsers
    el.focus();
  };
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const { companies, loading: companiesLoading } = useSelector((state) => state.companies);
  const { currentOrder, loading } = useSelector((state) => state.purchaseOrders);

  const [form, setForm] = useState(emptyForm);

  const [submitting, setSubmitting] = useState(false);
  const [vendorOptions, setVendorOptions] = useState([]);
  const [itemOptions, setItemOptions] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');

  // Derived: selected company object and its locations
  const selectedCompany = companies.find((c) => c._id === form.company) || null;
  const locations = selectedCompany?.locations || [];
  const selectedVendor = vendorOptions.find((v) => v._id === form.vendor) || null;
  const vendorLocs = vendorLocationsList(selectedVendor);

  // Initial load: vendors, companies, existing PO (for edit)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vRes = await vendorsAPI.getAll({ limit: 500, isActive: true });
        if (!cancelled) {
          setVendorOptions(vRes.data.vendors || []);
        }
      } catch {
        if (!cancelled) {
          setVendorOptions([]);
        }
      }
    })();
    dispatch(fetchCompanies({ limit: 100, isActive: true }));
    if (isEdit) dispatch(fetchPurchaseOrder(id));
    return () => {
      cancelled = true;
      dispatch(clearCurrentOrder());
    };
  }, [dispatch, id, isEdit]);

  // Load all active items on mount using pagination to handle any backend limit
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let allItems = [];
        let page = 1;
        const pageSize = 100;
        while (true) {
          const res = await itemsAPI.getAll({ limit: pageSize, isActive: true, page });
          if (cancelled) return;
          const items = res.data.items || [];
          allItems = [...allItems, ...items];
          // Stop if this page was not full (no more items) or safety cap of 10 pages
          if (items.length < pageSize || page >= 10) break;
          page++;
        }
        if (!cancelled) setItemOptions(allItems);
      } catch {
        if (!cancelled) setItemOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Populate form when editing
  useEffect(() => {
    if (isEdit && currentOrder) {
      if (currentOrder.department) {
        setSelectedDepartment(currentOrder.department);
      }
      const populatedVendor = currentOrder.vendor;
      const vLocs = vendorLocationsList(populatedVendor);
      const savedLocId = currentOrder.vendorLocationId
        ? String(currentOrder.vendorLocationId)
        : '';
      const hasSnap =
        currentOrder.vendorAddress &&
        (String(currentOrder.vendorAddress.street || '').trim() ||
          String(currentOrder.vendorAddress.city || '').trim());

      let vendorAddress = hasSnap
        ? { ...currentOrder.vendorAddress }
        : null;
      let vendorLocationId = savedLocId;

      if (!vendorAddress && vLocs.length > 0) {
        const match = savedLocId
          ? vLocs.find((l) => String(l._id) === savedLocId)
          : null;
        const pick = match || vLocs.find((l) => l.isDefault) || vLocs[0];
        vendorAddress = vendorAddressFromLocation(pick);
        if (!vendorLocationId) {
          vendorLocationId = vendorLocationKey(pick);
        }
      } else if (!vendorAddress) {
        vendorAddress = {
          label: '',
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: '',
        };
      }

      setForm({
        company: currentOrder.company?._id || currentOrder.company || '',
        shippingLocationId: currentOrder.shippingLocationId || '',
        vendor: currentOrder.vendor?._id || '',
        vendorLocationId,
        vendorAddress,
        orderDate: formatDateInput(currentOrder.orderDate),
        expectedDeliveryDate: formatDateInput(currentOrder.expectedDeliveryDate),
        shippingAddress: currentOrder.shippingAddress || {},
        lineItems: currentOrder.lineItems?.map((li) => ({
          item: li.item?._id || li.item || '',
          description: li.description,
          quantity: li.quantity ?? '',
          unit: li.unit,
          unitPrice: li.unitPrice,
          discount: li.discount || '',
          gstRate: li.gstRate || '',
          gstAmount: li.gstAmount || 0,
          totalPrice: li.totalPrice,
        })) || [emptyLineItem()],
        taxRate: currentOrder.taxRate || 0,
        shippingCost: currentOrder.shippingCost || '',
        discountAmount: currentOrder.discountAmount || 0,
        notes: currentOrder.notes || '',
        terms: currentOrder.terms || '',
        status: currentOrder.status || 'pending',
      });
    }
  }, [currentOrder, isEdit]);

  // When company changes, auto-select default location
  const handleCompanyChange = (companyId) => {
    const comp = companies.find((c) => c._id === companyId);
    const defaultLoc = comp?.locations?.find((l) => l.isDefault) || comp?.locations?.[0] || null;

    setForm((p) => ({
      ...p,
      company: companyId,
      shippingLocationId: defaultLoc?._id || '',
      shippingAddress: defaultLoc
        ? {
            label: defaultLoc.label?.toUpperCase?.() || '',
            company: comp.name,
            street: defaultLoc.street,
            city: defaultLoc.city,
            state: defaultLoc.state,
            zipCode: defaultLoc.zipCode,
            country: defaultLoc.country,
          }
        : { label: '', company: '', street: '', city: '', state: '', zipCode: '', country: '' },
    }));
  };

  // When location changes, fill the shipping address
  const handleLocationChange = (locationId) => {
    const loc = locations.find((l) => l._id === locationId) || null;
    setForm((p) => ({
      ...p,
      shippingLocationId: locationId,
      shippingAddress: loc
        ? {
            label: loc.label?.toUpperCase?.() || '',
            company: selectedCompany?.name || '',
            street: loc.street,
            city: loc.city,
            state: loc.state,
            zipCode: loc.zipCode,
            country: loc.country,
          }
        : p.shippingAddress,
    }));
  };

  const handleVendorChange = (vendorId) => {
    const v = vendorOptions.find((x) => x._id === vendorId);
    const locs = vendorLocationsList(v);
    const defaultLoc = locs.find((l) => l.isDefault) || locs[0] || null;
    setForm((p) => ({
      ...p,
      vendor: vendorId,
      vendorLocationId: defaultLoc ? vendorLocationKey(defaultLoc) : '',
      vendorAddress: defaultLoc ? vendorAddressFromLocation(defaultLoc) : {
        label: '',
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: '',
      },
    }));
  };

  const handleVendorLocationChange = (key) => {
    const loc = vendorLocs.find((l) => vendorLocationKey(l) === key) || null;
    if (!loc) return;
    setForm((p) => ({
      ...p,
      vendorLocationId: key,
      vendorAddress: vendorAddressFromLocation(loc),
    }));
  };

  const subtotal = form.lineItems.reduce((sum, li) => sum + calcLineItem(li), 0);
  const total = parseFloat((subtotal + Number(form.shippingCost || 0)).toFixed(2));

  // Group items by category in the order defined by DEPARTMENT_CATEGORIES
  const groupedItemOptions = useMemo(() => {
    if (itemOptions.length === 0) return [];
    const ALL_CATEGORIES_ORDERED = Object.values(DEPARTMENT_CATEGORIES).flat();
    const sorted = [...itemOptions].sort((a, b) => {
      const catA = a.category || 'Uncategorized';
      const catB = b.category || 'Uncategorized';
      if (catA !== catB) {
        const posA = ALL_CATEGORIES_ORDERED.indexOf(catA);
        const posB = ALL_CATEGORIES_ORDERED.indexOf(catB);
        return (posA === -1 ? 999 : posA) - (posB === -1 ? 999 : posB);
      }
      return a.name.localeCompare(b.name);
    });
    const groups = new Map();
    sorted.forEach((item) => {
      const cat = item.category || 'Uncategorized';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(item);
    });
    const result = [];
    groups.forEach((items, category) => {
      result.push({ value: `__header__${category}`, label: category, isGroupHeader: true });
      items.forEach((item) =>
        result.push({
          value: item._id,
          label: item.name,
          badge: item.category || 'Uncategorized',
          badgeClass: CATEGORY_COLOR_MAP[item.category] || 'bg-gray-100 text-gray-700 border-gray-200',
        })
      );
    });
    return result;
  }, [itemOptions]);

  const handleLineItemChange = useCallback((idx, field, value) => {
    setForm((prev) => {
      const lineItems = [...prev.lineItems];
      lineItems[idx] = { ...lineItems[idx], [field]: value };
      lineItems[idx].totalPrice = calcLineItem(lineItems[idx]);
      return { ...prev, lineItems };
    });
  }, []);

  const handleSelectItem = useCallback((idx, itemId) => {
    const found = itemOptions.find((i) => i._id === itemId);
    if (found) {
      setForm((prev) => {
        const lineItems = [...prev.lineItems];
        lineItems[idx] = {
          ...lineItems[idx],
          item: found._id,
          description: found.name,
          unit: found.unit,
          unitPrice: found.unitPrice,
        };
        lineItems[idx].totalPrice = calcLineItem(lineItems[idx]);
        return { ...prev, lineItems };
      });
    }
  }, [itemOptions]);

  const addLineItem = () => setForm((p) => ({ ...p, lineItems: [...p.lineItems, emptyLineItem()] }));

  const removeLineItem = (idx) => {
    if (form.lineItems.length === 1) return;
    setForm((p) => ({ ...p, lineItems: p.lineItems.filter((_, i) => i !== idx) }));
  };

  const handleReset = () => {
    setForm(emptyForm());
    setSelectedDepartment('');
    toast.success('Form cleared');
  };

  const handleSubmit = async () => {
    if (!form.company) return toast.error('Please select a company');
    if (!form.shippingLocationId) return toast.error('Please select a shipping location');
    if (!form.vendor) return toast.error('Please select a vendor');
    if (!String(form.vendorAddress?.street || '').trim()) {
      return toast.error('Please select a vendor location');
    }
    if (form.lineItems.some((li) => !li.item)) return toast.error('Please select an item for all order rows');

    setSubmitting(true);
    const statusToSave = isEdit ? form.status : 'pending';
    const vendorLocationIdForApi =
      form.vendorLocationId && form.vendorLocationId !== 'legacy'
        ? form.vendorLocationId
        : null;
    const payload = {
      ...form,
      department: selectedDepartment || '',
      vendorLocationId: vendorLocationIdForApi,
      status: statusToSave,
      lineItems: form.lineItems.map((li) => ({
        ...li,
        gstAmount: calcGstAmt(li),
        totalPrice: calcLineItem(li),
      })),
    };

    const action = isEdit
      ? updatePurchaseOrder({ id, data: payload })
      : createPurchaseOrder(payload);

    const result = await dispatch(action);
    setSubmitting(false);

    if ((isEdit ? updatePurchaseOrder : createPurchaseOrder).fulfilled.match(result)) {
      toast.success(isEdit ? 'Purchase order updated' : 'Purchase order created');
      navigate(`/purchase-orders/${result.payload._id}`);
    } else {
      toast.error(result.payload);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="page-header">
        <h1 className="page-title">{isEdit ? 'Edit Purchase Order' : 'New Purchase Order'}</h1>
        <button onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
      </div>

      {/* Step 1 — Company & Location */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary-700 text-white text-xs font-bold flex items-center justify-center">1</span>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Select Company & Shipping Location</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Company selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
            <CustomSelect
              placeholder="Select company..."
              value={form.company}
              onChange={(val) => handleCompanyChange(val)}
              loading={companiesLoading}
              options={companies.map((c) => ({ value: c._id, label: c.name }))}
            />
            {!companiesLoading && companies.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No companies found. <a href="/control-center/companies" className="underline font-medium">Add a company first.</a>
              </p>
            )}
          </div>

          {/* Location selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Location *</label>
            <CustomSelect
              placeholder={
                !form.company
                  ? 'Select company first'
                  : locations.length === 0
                    ? 'No locations on file'
                    : 'Select location...'
              }
              value={form.shippingLocationId}
              onChange={(val) => handleLocationChange(val)}
              disabled={!form.company || locations.length <= 1}
              options={locations.map((loc) => ({
                value: loc._id,
                label: shippingLocationOptionLabel(loc),
              }))}
            />
          </div>
        </div>

        {/* Location preview */}
        {form.shippingLocationId && form.shippingAddress?.street && (
          <div className="mt-4 p-4 bg-primary-50 border border-primary-200 rounded-lg flex items-start gap-3">
            <svg className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div className="text-sm">
              <p className="font-semibold text-primary-800">
                {form.shippingAddress.label?.toUpperCase?.() || ''} - {form.shippingAddress.company}
              </p>
              <p className="text-primary-700">{form.shippingAddress.street}</p>
              <p className="text-primary-700">
                {form.shippingAddress.city}{form.shippingAddress.state ? `, ${form.shippingAddress.state}` : ''} {form.shippingAddress.zipCode}
              </p>
              {form.shippingAddress.country && <p className="text-primary-600">{form.shippingAddress.country}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Step 2 — Order Details */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary-700 text-white text-xs font-bold flex items-center justify-center">2</span>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Order Details</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
            <CustomSelect
              placeholder="Select vendor..."
              value={form.vendor}
              onChange={(val) => handleVendorChange(val)}
              options={vendorOptions.map((v) => ({ value: v._id, label: v.name }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor location *</label>
            <CustomSelect
              placeholder={
                !form.vendor
                  ? 'Select vendor first'
                  : vendorLocs.length === 0
                    ? 'No locations on file'
                    : 'Select location...'
              }
              value={form.vendorLocationId}
              onChange={(val) => handleVendorLocationChange(val)}
              disabled={!form.vendor || vendorLocs.length <= 1}
              options={vendorLocs.map((loc) => ({
                value: vendorLocationKey(loc),
                label: shippingLocationOptionLabel(loc),
              }))}
            />
          </div>
        </div>

        {/* Vendor location preview */}
        {form.vendor && form.vendorAddress?.street && (
          <div className="mt-4 p-4 bg-primary-50 border border-primary-200 rounded-lg flex items-start gap-3">
            <svg className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div className="text-sm">
              <p className="font-semibold text-primary-800">
                {form.vendorAddress.label?.toUpperCase?.() || ''} - {selectedVendor?.name || ''}
              </p>
              <p className="text-primary-700">{form.vendorAddress.street}</p>
              <p className="text-primary-700">
                {form.vendorAddress.city}
                {form.vendorAddress.state ? `, ${form.vendorAddress.state}` : ''}{' '}
                {form.vendorAddress.zipCode}
              </p>
              {form.vendorAddress.country && (
                <p className="text-primary-600">{form.vendorAddress.country}</p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Order Date</label>
            <div className="group relative">
              <input
                ref={orderDateRef}
                type="date"
                className="po-date-input focus:border-primary-500 focus:ring-4 focus:ring-primary-100 hover:border-gray-400"
                value={form.orderDate}
                onChange={(e) => setForm((p) => ({ ...p, orderDate: e.target.value }))}
                onClick={() => openNativeDatePicker(orderDateRef)}
              />
              <button
                type="button"
                onClick={() => openNativeDatePicker(orderDateRef)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg hover:bg-primary-50 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                title="Pick order date"
              >
                <svg
                  className="w-4 h-4 text-primary-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Delivery Date</label>
            <div className="group relative">
              <input
                ref={deliveryDateRef}
                type="date"
                className="po-date-input focus:border-primary-500 focus:ring-4 focus:ring-primary-100 hover:border-gray-400"
                value={form.expectedDeliveryDate}
                onChange={(e) => setForm((p) => ({ ...p, expectedDeliveryDate: e.target.value }))}
                onClick={() => openNativeDatePicker(deliveryDateRef)}
              />
              <button
                type="button"
                onClick={() => openNativeDatePicker(deliveryDateRef)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg hover:bg-purple-50 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                title="Pick delivery date"
              >
                <svg
                  className="w-4 h-4 text-purple-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3 — Order Items */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary-700 text-white text-xs font-bold flex items-center justify-center">3</span>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Order Items</h2>
          </div>
          <button onClick={addLineItem} className="btn-secondary text-xs py-1.5 px-3">
            + Add Item
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <CustomSelect
            placeholder="Select department..."
            value={selectedDepartment}
            onChange={(val) => setSelectedDepartment(val)}
            options={[
              { value: '', label: 'All Departments' },
              ...ITEM_DEPARTMENTS.map((d) => ({ value: d, label: d })),
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                <th className="px-3 py-2 text-left font-semibold">Item</th>
                <th className="px-3 py-2 text-center font-semibold w-20">Qty</th>
                <th className="px-3 py-2 text-center font-semibold w-24">Unit</th>
                <th className="px-3 py-2 text-center font-semibold w-28">Unit Price</th>
                <th className="px-3 py-2 text-center font-semibold w-24">Disc %</th>
                <th className="px-3 py-2 text-center font-semibold w-24">GST %</th>
                <th className="px-3 py-2 text-right font-semibold w-32">Total Amount</th>
                <th className="px-3 py-2 text-right font-semibold w-36">Total Cost</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {form.lineItems.map((li, idx) => {
                const discAmt = calcDiscountAmt(li);
                const gstAmt  = calcGstAmt(li);
                return (
                  <tr key={idx} className="align-top">
                    {/* Item */}
                    <td className="px-3 pt-3 pb-2">
                      <CustomSelect
                        size="lg"
                        placeholder="Select item"
                        value={li.item || ''}
                        onChange={(val) => handleSelectItem(idx, val)}
                        options={groupedItemOptions}
                      />
                    </td>

                    {/* Qty */}
                    <td className="px-3 pt-3 pb-2">
                      <input
                        type="number" min="0"
                        className="input-field !text-base text-right"
                        value={li.quantity}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleLineItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                    </td>

                    {/* Unit */}
                    <td className="px-3 pt-3 pb-2">
                      <CustomSelect
                        size="lg"
                        value={li.unit}
                        onChange={(val) => handleLineItemChange(idx, 'unit', val)}
                        options={UNITS.map((u) => ({ value: u, label: u }))}
                      />
                    </td>

                    {/* Unit Price */}
                    <td className="px-3 pt-3 pb-2">
                      <input
                        type="number" min="0" step="0.01"
                        className="input-field !text-base text-right"
                        value={li.unitPrice}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleLineItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                      />
                    </td>

                    {/* Disc % */}
                    <td className="px-3 pt-3 pb-2">
                      <input
                        type="number" min="0" max="100" step="0.1"
                        className="input-field !text-base text-right"
                        value={li.discount}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleLineItemChange(idx, 'discount', parseFloat(e.target.value) || 0)}
                      />
                    </td>

                    {/* GST % */}
                    <td className="px-3 pt-3 pb-2">
                      <input
                        type="number" min="0" max="100" step="0.1"
                        className="input-field !text-base text-right"
                        value={li.gstRate}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleLineItemChange(idx, 'gstRate', parseFloat(e.target.value) || 0)}
                      />
                    </td>

                    {/* Amount (after discount, before GST) */}
                    <td className="px-3 pt-3 pb-2 text-right !text-base text-gray-700">
                      {formatCurrency(calcPreGstAmount(li))}
                      {discAmt > 0 && (
                        <p className="text-xs text-red-500 text-right mt-0.5">
                          disc: -{formatCurrency(discAmt)}
                        </p>
                      )}
                      {discAmt === 0 && <p className="text-xs mt-0.5 invisible">_</p>}
                    </td>

                    {/* Total with GST */}
                    <td className="px-3 pt-3 pb-2 text-right font-semibold !text-base text-primary-700">
                      {formatCurrency(calcLineItem(li))}
                      {gstAmt > 0 && (
                        <p className="text-xs text-green-600 text-right mt-0.5">
                          GST: +{formatCurrency(gstAmt)}
                        </p>
                      )}
                      {gstAmt === 0 && <p className="text-xs mt-0.5 invisible">_</p>}
                    </td>

                    {/* Remove */}
                    <td className="px-3 pt-3 pb-2">
                      <button
                        onClick={() => removeLineItem(idx)}
                        disabled={form.lineItems.length === 1}
                        className="text-gray-300 hover:text-red-500 transition-colors disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Step 4 — Notes + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-full bg-primary-700 text-white text-xs font-bold flex items-center justify-center">4</span>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Notes & Terms</h2>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              className="input-field"
              rows={5}
              placeholder="Internal notes or special instructions..."
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
            <textarea
              className="input-field"
              rows={5}
              placeholder="Payment terms, delivery conditions..."
              value={form.terms}
              onChange={(e) => setForm((p) => ({ ...p, terms: e.target.value }))}
            />
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Order Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-xl">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm gap-4">
              <label className="text-gray-600 whitespace-nowrap">Shipping Cost</label>
              <input
                type="number" min="0" step="0.01"
                className="input-field w-28 text-right"
                value={form.shippingCost}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setForm((p) => ({ ...p, shippingCost: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
              <span className="font-bold text-gray-900">Total</span>
              <span className="text-xl font-semibold text-primary-700">{formatCurrency(total)}</span>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mt-1">
              <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-1">Amount in Words : </p>
              <p className="text-xl text-primary-700 font-semibold leading-snug">{amountToWords(total)}</p>
            </div>
          </div>

          <div className="mt-6 flex items-stretch gap-2">
            {!isEdit && (
              <button
                type="button"
                onClick={() => handleReset()}
                disabled={submitting}
                title="Reset form"
                aria-label="Reset form"
                className="btn-secondary flex-shrink-0 flex items-center justify-center min-h-[3.25rem] w-[3.25rem] rounded-xl"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={submitting}
              className="btn-primary flex-1 justify-center py-4 px-6 min-h-[3.25rem] text-base sm:text-xl font-semibold rounded-xl shadow-md hover:shadow-lg"
            >
              {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Submit PO'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePurchaseOrder;
