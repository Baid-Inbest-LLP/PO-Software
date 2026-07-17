import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PageBanner from '../../components/common/PageBanner';
import CompanyList from '../Companies/CompanyList';
import VendorList from '../Vendors/VendorList';
import ItemList from '../Items/ItemList';

const TABS = [
  { to: '/control-center/items', label: 'Items & Products', end: true },
  { to: '/control-center/vendors', label: 'Vendors' },
  { to: '/control-center/companies', label: 'Companies' },
];

export default function ControlCenterPage() {
  const location = useLocation();

  const subtitle = location.pathname.includes('/vendors')
    ? 'Manage supplier contacts and billing details'
    : location.pathname.includes('/companies')
      ? 'Legal entities and shipping locations'
      : 'Catalog of items and products for purchase orders';

  return (
    <div>
      <PageBanner className="mb-4" title="Control Center" subtitle={subtitle} />

      <div className="card p-2 mb-4">
        <div className="flex flex-wrap gap-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#0b2f81] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      <Routes>
        <Route index element={<Navigate to="items" replace />} />
        <Route path="items" element={<ItemList embedded />} />
        <Route path="vendors" element={<VendorList embedded />} />
        <Route path="companies" element={<CompanyList embedded />} />
      </Routes>
    </div>
  );
}
