import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchItems, deleteItem } from '../../features/items/itemsSlice';
import {
  formatCurrency,
  ITEM_DEPARTMENTS,
  DEPARTMENT_CATEGORIES,
  CATEGORY_COLOR_MAP,
  DEPARTMENT_COLOR_MAP,
} from '../../utils/helpers';
import ItemForm from './ItemForm';
import ConfirmModal from '../../components/common/ConfirmModal';
import CustomSelect from '../../components/common/CustomSelect';
import Pagination, { TABLE_PAGE_SIZE } from '../../components/common/Pagination';
import PageBanner from '../../components/common/PageBanner';
import ControlCenterToolbar from '../control-center/ControlCenterToolbar';
import toast from 'react-hot-toast';
import Skeleton, { SkeletonText } from '../../components/common/Skeleton';

const ALL_TAB = 'All';

const ItemList = ({ embedded = false }) => {
  const dispatch = useDispatch();
  const { items, total, pages, loading } = useSelector((state) => state.items);
  const { user } = useSelector((state) => state.auth);
  const canDelete = user?.role === 'PO_ADMIN' || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const [search, setSearch] = useState('');
  const [activeDepartment, setActiveDepartment] = useState(ALL_TAB);
  const [activeCategory, setActiveCategory] = useState(ALL_TAB);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const listParams = {
    search,
    page,
    limit: TABLE_PAGE_SIZE,
    ...(activeDepartment !== ALL_TAB ? { department: activeDepartment } : {}),
    ...(activeCategory !== ALL_TAB ? { category: activeCategory } : {}),
  };

  useEffect(() => {
    dispatch(fetchItems(listParams));
  }, [dispatch, search, activeDepartment, activeCategory, page]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const result = await dispatch(deleteItem(confirmDelete.id));
    setConfirmDelete(null);
    if (deleteItem.fulfilled.match(result)) {
      toast.success('Item deleted');
      dispatch(
        fetchItems({
          search,
          page,
          limit: TABLE_PAGE_SIZE,
          ...(activeDepartment !== ALL_TAB ? { department: activeDepartment } : {}),
          ...(activeCategory !== ALL_TAB ? { category: activeCategory } : {}),
        })
      );
    } else {
      toast.error(result.payload);
    }
  };

  const cancelDelete = useCallback(() => setConfirmDelete(null), []);

  const handleEdit = (item) => {
    setEditItem(item);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditItem(null);
    dispatch(fetchItems(listParams));
  };

  const categoryColor = (cat) =>
    CATEGORY_COLOR_MAP[cat] || 'bg-gray-100 text-gray-600 border-gray-200';
  const departmentColor = (department) =>
    DEPARTMENT_COLOR_MAP[department] || 'bg-gray-100 text-gray-600 border-gray-200';

  const categoryFilterOptions = activeDepartment === ALL_TAB
    ? ITEM_DEPARTMENTS.flatMap((department) => DEPARTMENT_CATEGORIES[department] || [])
    : (DEPARTMENT_CATEGORIES[activeDepartment] || []);

  const subtitle =
    activeCategory === ALL_TAB
      ? `Catalog for purchase orders · ${total} item${total !== 1 ? 's' : ''}`
      : `${total} item${total !== 1 ? 's' : ''} in ${activeCategory}`;

  return (
    <div>
      {!embedded && (
        <PageBanner
          className="mb-4"
          title="Items & Products"
          subtitle={subtitle}
          action={{ onClick: () => setShowForm(true), label: 'Add Item' }}
        />
      )}

      {embedded && (
        <ControlCenterToolbar
          title="Items & Products"
          subtitle={subtitle}
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          searchPlaceholder="Search items by name..."
          actionLabel="Add Item"
          onAction={() => setShowForm(true)}
        />
      )}

      <div className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        {!embedded && (
          <div className="flex-1 min-w-48">
            <input
              className="input-field"
              placeholder="Search items by name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        )}
        <CustomSelect
          className="w-56"
          placeholder="All Departments"
          value={activeDepartment}
          onChange={(val) => {
            setActiveDepartment(val);
            setActiveCategory(ALL_TAB);
            setPage(1);
          }}
          options={[
            { value: ALL_TAB, label: 'All Departments' },
            ...ITEM_DEPARTMENTS.map((department) => ({ value: department, label: department })),
          ]}
        />
        <CustomSelect
          className="w-56"
          placeholder="All Categories"
          value={activeCategory}
          onChange={(val) => {
            setActiveCategory(val);
            setPage(1);
          }}
          options={[
            { value: ALL_TAB, label: 'All Categories' },
            ...categoryFilterOptions.map((cat) => ({ value: cat, label: cat })),
          ]}
        />
      </div>

      <div className="card">
        {loading ? (
          <div className="p-5">
            {activeCategory !== ALL_TAB && (
              <div className="px-1 pb-3">
                <Skeleton className="h-4 w-40" />
              </div>
            )}
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Name</th>
                    <th className="text-center">Department</th>
                    <th className="text-center">Category</th>
                    <th className="text-center">Unit</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3, 4].map((row) => (
                    <tr key={row}>
                      <td className="text-left">
                        <SkeletonText lines={2} />
                      </td>
                      <td className="text-center">
                        <Skeleton className="h-6 w-28 rounded-full mx-auto" />
                      </td>
                      <td className="text-center">
                        <Skeleton className="h-6 w-32 rounded-full mx-auto" />
                      </td>
                      <td className="text-center">
                        <Skeleton className="h-3 w-12 mx-auto" />
                      </td>
                      <td className="text-right">
                        <Skeleton className="h-3 w-16 ml-auto" />
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
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-gray-500 font-medium">
              {activeCategory === ALL_TAB ? 'No items yet' : `No items in "${activeCategory}"`}
            </p>
            {activeCategory !== ALL_TAB && (
              <button
                type="button"
                onClick={() => {
                  setActiveCategory(ALL_TAB);
                  setPage(1);
                }}
                className="text-primary-600 text-sm mt-2 hover:underline"
              >
                View all items
              </button>
            )}
            <button type="button" onClick={() => setShowForm(true)} className="btn-primary mt-4 block mx-auto">
              Add Item
            </button>
          </div>
        ) : (
          <>
            {activeCategory !== ALL_TAB && (
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${categoryColor(activeCategory)}`}>
                  {activeCategory}
                </span>
                <span className="text-sm text-gray-500">
                  {total} item{total !== 1 ? 's' : ''} matching filter
                </span>
              </div>
            )}

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Name</th>
                    <th className="text-center">Department</th>
                    <th className="text-center">Category</th>
                    <th className="text-center">Unit</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id}>
                      <td className="text-left">
                        <div>
                          <p className="font-semibold text-gray-800">{item.name}</p>
                        </div>
                      </td>
                      <td className="text-center">
                        <span
                          title={item.department || '—'}
                          className={`inline-block max-w-[150px] xl:max-w-[180px] align-middle truncate whitespace-nowrap text-xs font-medium px-2.5 py-1 rounded-full border ${departmentColor(item.department)}`}
                        >
                          {item.department || '—'}
                        </span>
                      </td>
                      <td className="text-center">
                        <span
                          title={item.category || '—'}
                          className={`inline-block max-w-[170px] xl:max-w-[210px] align-middle truncate whitespace-nowrap text-xs font-medium px-2.5 py-1 rounded-full border ${categoryColor(item.category)}`}
                        >
                          {item.category || '—'}
                        </span>
                      </td>
                      <td className="text-center text-gray-500">{item.unit}</td>
                      <td className="text-right font-semibold">{formatCurrency(item.unitPrice)}</td>
                      <td className="text-center">
                        <span className={`badge ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                            className="p-1.5 text-gray-400 hover:text-primary-700 rounded transition-colors"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => canDelete && setConfirmDelete({ id: item._id, name: item.name })}
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
          </>
        )}
        {!loading && items.length > 0 && (
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

      {showForm && <ItemForm item={editItem} onClose={handleClose} />}

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete Item"
        message={`Are you sure you want to delete "${confirmDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

export default ItemList;
