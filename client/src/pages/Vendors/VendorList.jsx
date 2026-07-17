import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchVendors, deleteVendor } from '../../features/vendors/vendorsSlice';
import VendorForm from './VendorForm';
import ConfirmModal from '../../components/common/ConfirmModal';
import Pagination, { TABLE_PAGE_SIZE } from '../../components/common/Pagination';
import PageBanner from '../../components/common/PageBanner';
import ControlCenterToolbar from '../control-center/ControlCenterToolbar';
import toast from 'react-hot-toast';
import Skeleton, { SkeletonText } from '../../components/common/Skeleton';

const VendorList = ({ embedded = false }) => {
  const dispatch = useDispatch();
  const { vendors, total, pages, loading } = useSelector((state) => state.vendors);
  const { user } = useSelector((state) => state.auth);
  const canDelete = user?.role === 'PO_ADMIN' || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editVendor, setEditVendor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    dispatch(fetchVendors({ search, page, limit: TABLE_PAGE_SIZE }));
  }, [dispatch, search, page]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const result = await dispatch(deleteVendor(confirmDelete.id));
    setConfirmDelete(null);
    if (deleteVendor.fulfilled.match(result)) {
      toast.success('Vendor deleted');
      dispatch(fetchVendors({ search, page, limit: TABLE_PAGE_SIZE }));
    } else {
      toast.error(result.payload);
    }
  };

  const cancelDelete = useCallback(() => setConfirmDelete(null), []);

  const handleEdit = (vendor) => {
    setEditVendor(vendor);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditVendor(null);
    dispatch(fetchVendors({ search, page, limit: TABLE_PAGE_SIZE }));
  };

  const subtitle = `Manage supplier contacts and billing details · ${total} Vendor${total !== 1 ? 's' : ''}`;

  return (
    <div>
      {!embedded && (
        <PageBanner
          className="mb-4"
          title="Vendors"
          subtitle={subtitle}
          action={{ onClick: () => setShowForm(true), label: 'Add Vendor' }}
        />
      )}

      {embedded ? (
        <ControlCenterToolbar
          title="Vendors"
          subtitle={subtitle}
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          searchPlaceholder="Search vendors..."
          actionLabel="Add Vendor"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="card p-4 mb-4">
          <input
            className="input-field max-w-sm"
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-8 w-28" />
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Name</th>
                    <th className="text-center">Contact Person</th>
                    <th className="text-center">Phone</th>
                    <th className="text-center">GST No</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3].map((row) => (
                    <tr key={row}>
                      <td className="text-left">
                        <SkeletonText lines={2} />
                      </td>
                      <td className="text-center">
                        <Skeleton className="h-3 w-32 mx-auto" />
                      </td>
                      <td className="text-center">
                        <Skeleton className="h-3 w-24 mx-auto" />
                      </td>
                      <td className="text-center">
                        <Skeleton className="h-3 w-24 mx-auto" />
                      </td>
                      <td className="text-center">
                        <Skeleton className="h-6 w-20 rounded-full mx-auto" />
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Skeleton className="h-8 w-8 rounded-full" />
                          <Skeleton className="h-8 w-8 rounded-full" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-gray-500 font-medium">No vendors yet</p>
            <button onClick={() => setShowForm(true)} className="btn-primary mt-4">Add First Vendor</button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-left">Name</th>
                  <th className="text-center">Contact Person</th>
                  <th className="text-center">Phone</th>
                  <th className="text-center">GST No</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v._id}>
                    <td className="text-left font-semibold text-gray-800">{v.name}</td>
                    <td className="text-center text-gray-600">{v.contactPerson || '—'}</td>
                    <td className="text-center text-gray-500">{v.phone || '—'}</td>
                    <td className="text-center text-gray-500">{v.taxId || '—'}</td>
                    <td className="text-center">
                      <span className={`badge ${v.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {v.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEdit(v)}
                          className="p-1.5 text-gray-400 hover:text-primary-700 rounded transition-colors"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => canDelete && setConfirmDelete({ id: v._id, name: v.name })}
                          disabled={!canDelete}
                          className={`p-1.5 rounded transition-colors ${
                            canDelete ? 'text-gray-400 hover:text-red-600' : 'text-gray-300 cursor-not-allowed'
                          }`}
                          title={canDelete ? 'Delete' : 'Only PO Admin or Superadmin can delete'}
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && vendors.length > 0 && (
          <Pagination
            page={page}
            pages={pages}
            total={total}
            pageSize={TABLE_PAGE_SIZE}
            loading={loading}
            onPageChange={setPage}
          />
        )}
      </div>

      {showForm && (
        <VendorForm vendor={editVendor} onClose={handleClose} />
      )}

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete Vendor"
        message={`Are you sure you want to delete "${confirmDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

export default VendorList;
