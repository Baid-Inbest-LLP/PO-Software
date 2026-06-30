import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { createItem, updateItem } from '../../features/items/itemsSlice';
import {
  UNITS,
  ITEM_DEPARTMENTS,
  DEPARTMENT_CATEGORIES,
  DEFAULT_DEPARTMENT,
  DEFAULT_CATEGORY,
} from '../../utils/helpers';
import CustomSelect from '../../components/common/CustomSelect';
import toast from 'react-hot-toast';

const ItemForm = ({ item, onClose }) => {
  const dispatch = useDispatch();
  const isEdit = Boolean(item);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      unit: 'pcs',
      department: DEFAULT_DEPARTMENT,
      category: DEFAULT_CATEGORY,
      isActive: true,
    },
  });

  useEffect(() => {
    if (item) {
      const inferredDepartment = item.department || Object.keys(DEPARTMENT_CATEGORIES).find((dept) =>
        (DEPARTMENT_CATEGORIES[dept] || []).includes(item.category)
      ) || DEFAULT_DEPARTMENT;
      const categoriesForDepartment = DEPARTMENT_CATEGORIES[inferredDepartment] || [];
      const safeCategory = categoriesForDepartment.includes(item.category)
        ? item.category
        : (categoriesForDepartment[0] || DEFAULT_CATEGORY);
      reset({
        ...item,
        department: inferredDepartment,
        category: safeCategory,
      });
    }
  }, [item, reset]);

  const selectedDepartment = watch('department') || DEFAULT_DEPARTMENT;
  const categoryOptions = (DEPARTMENT_CATEGORIES[selectedDepartment] || []).map((name) => ({
    value: name,
    label: name,
  }));

  const onSubmit = async (data) => {
    const payload = { ...data };
    const parsedUnitPrice = parseFloat(data.unitPrice);
    if (Number.isFinite(parsedUnitPrice)) {
      payload.unitPrice = parsedUnitPrice;
    } else {
      delete payload.unitPrice;
    }

    const action = isEdit
      ? dispatch(updateItem({ id: item._id, data: payload }))
      : dispatch(createItem(payload));

    const result = await action;

    if ((isEdit ? updateItem : createItem).fulfilled.match(result)) {
      toast.success(isEdit ? 'Item updated' : 'Item created');
      onClose();
    } else {
      toast.error(result.payload);
    }
  };

  const err = (field) => errors[field]?.message;
  const inputCls = (field) =>
    `input-field ${errors[field] ? 'border-red-400 focus:ring-red-400' : ''}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? 'Edit Item' : 'Add New Item'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isEdit ? 'Update item details' : 'Fill in item details below'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department <span className="text-red-500">*</span>
            </label>
            <CustomSelect
              placeholder="Select department..."
              value={selectedDepartment}
              onChange={(val) => {
                const nextCategory = (DEPARTMENT_CATEGORIES[val] || [])[0] || '';
                setValue('department', val, { shouldValidate: true, shouldDirty: true });
                setValue('category', nextCategory, { shouldValidate: true, shouldDirty: true });
              }}
              error={!!errors.department}
              options={ITEM_DEPARTMENTS.map((name) => ({ value: name, label: name }))}
            />
            <input type="hidden" {...register('department', { required: 'Department is required' })} />
            {err('department') && <p className="text-red-500 text-xs mt-1">{err('department')}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <CustomSelect
              placeholder="Select category..."
              value={watch('category')}
              onChange={(val) => setValue('category', val, { shouldValidate: true })}
              error={!!errors.category}
              options={categoryOptions}
            />
            <input type="hidden" {...register('category', { required: 'Category is required' })} />
            {err('category') && <p className="text-red-500 text-xs mt-1">{err('category')}</p>}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              className={inputCls('name')}
              placeholder="Product or service name"
              {...register('name', { required: 'Item name is required' })}
            />
            {err('name') && <p className="text-red-500 text-xs mt-1">{err('name')}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Unit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <CustomSelect
                value={watch('unit')}
                onChange={(val) => setValue('unit', val)}
                options={UNITS.map((u) => ({ value: u, label: u }))}
              />
              <input type="hidden" {...register('unit')} />
            </div>

            {/* Unit Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputCls('unitPrice')}
                placeholder="0.00"
                {...register('unitPrice', {
                  min: { value: 0, message: 'Must be ≥ 0' },
                })}
              />
              {err('unitPrice') && <p className="text-red-500 text-xs mt-1">{err('unitPrice')}</p>}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="Brief description..."
              {...register('description')}
            />
          </div>

          {/* Active */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="itemActive" className="rounded" {...register('isActive')} />
            <label htmlFor="itemActive" className="text-sm text-gray-700">Active item</label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving...' : isEdit ? 'Update Item' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ItemForm;
