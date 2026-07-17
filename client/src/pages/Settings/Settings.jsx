import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useSelector } from 'react-redux';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/common/ConfirmModal';
import PasswordInput from '../../components/common/PasswordInput';
import CustomSelect from '../../components/common/CustomSelect';
import PageBanner from '../../components/common/PageBanner';
import ProfilePhotoModal from '../../components/common/ProfilePhotoModal';
import Skeleton, { SkeletonText } from '../../components/common/Skeleton';

const EDIT_USER_STATUS_OPTIONS = [
  { value: true, label: 'Active' },
  { value: false, label: 'Inactive' },
];

const CREATE_ROLE_OPTIONS = [
  { value: 'PO_Assistant', label: 'PO Assistant' },
  { value: 'PO_ADMIN', label: 'PO Admin' },
];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_POLICY_LABEL = 'Min 8 chars, with uppercase, lowercase, number, special character';
const STRONG_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[ !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]).{8,}$/;

const roleLabel = (role) => {
  if (role === 'SUPERADMIN') return 'Superadmin';
  if (role === 'PO_ADMIN' || role === 'ADMIN') return 'PO Admin';
  if (role === 'PO_Assistant') return 'PO Assistant';
  return role || '';
};

const readImageFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  if (!file) {
    resolve('');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Could not read image file'));
  reader.readAsDataURL(file);
});

const Settings = () => {
  const { user } = useSelector((state) => state.auth);
  const isSuperadmin = user?.role === 'SUPERADMIN';
  const isPoAdmin = user?.role === 'PO_ADMIN' || user?.role === 'ADMIN';
  const canCreateUser = isSuperadmin || isPoAdmin;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [createSignatureFile, setCreateSignatureFile] = useState(null);
  const [createSignaturePreview, setCreateSignaturePreview] = useState('');
  const [editSignatureFile, setEditSignatureFile] = useState(null);
  const [editSignaturePreview, setEditSignaturePreview] = useState('');
  const [editSignatureLoading, setEditSignatureLoading] = useState(false);
  const [clearEditSignature, setClearEditSignature] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await authAPI.getUsers({ fresh: true });
      setUsers(res.data?.users || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canCreateUser) fetchUsers();
  }, [canCreateUser]);

  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    control: controlCreate,
    formState: { errors: createErrors, isSubmitting: createSubmitting },
  } = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'PO_Assistant',
    },
  });

  const createRole = useWatch({ control: controlCreate, name: 'role' });

  const {
    register: registerPwd,
    handleSubmit: handleSubmitPwd,
    reset: resetPwd,
    watch: watchPwd,
    formState: { errors: pwdErrors, isSubmitting: pwdSubmitting },
  } = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    control: controlEdit,
    formState: { errors: editErrors, isSubmitting: editSubmitting },
  } = useForm({
    defaultValues: { name: '', email: '', isActive: true },
  });

  const onCreateUser = async (data) => {
    try {
      const payload = {
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role || 'PO_Assistant',
      };
      if (data.role === 'PO_ADMIN' && createSignatureFile) {
        payload.signatureImage = await readImageFileAsDataUrl(createSignatureFile);
      }
      await authAPI.createUser(payload);
      toast.success(`${roleLabel(data.role)} account created`);
      setShowCreate(false);
      setCreateSignatureFile(null);
      setCreateSignaturePreview('');
      resetCreate();
      if (canCreateUser) fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    }
  };

  const onChangePassword = async (data) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    try {
      await authAPI.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success('Password updated successfully');
      resetPwd();
      setShowPasswordModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    }
  };

  const closeCreateModal = () => {
    setShowCreate(false);
    setCreateSignatureFile(null);
    setCreateSignaturePreview('');
    resetCreate({ name: '', email: '', password: '', role: isPoAdmin ? 'PO_Assistant' : 'PO_Assistant' });
  };

  const onCreateSignatureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      toast.error('Signature must be a PNG or JPEG image');
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error('Signature image must be 1 MB or smaller');
      return;
    }
    setCreateSignatureFile(file);
    try {
      setCreateSignaturePreview(await readImageFileAsDataUrl(file));
    } catch {
      toast.error('Could not preview signature');
    }
  };

  const onEditSignatureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      toast.error('Signature must be a PNG or JPEG image');
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error('Signature image must be 1 MB or smaller');
      return;
    }
    setEditSignatureFile(file);
    setClearEditSignature(false);
    try {
      setEditSignaturePreview(await readImageFileAsDataUrl(file));
    } catch {
      toast.error('Could not preview signature');
    }
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    resetPwd();
  };

  const openEditUser = async (u) => {
    setEditingUser(u);
    setEditSignatureFile(null);
    setEditSignaturePreview('');
    setClearEditSignature(false);
    resetEdit({
      name: u.name || '',
      email: u.email || '',
      isActive: u.isActive !== false,
    });
    const isTargetPoAdmin = u.role === 'PO_ADMIN' || u.role === 'ADMIN';
    if (isSuperadmin && isTargetPoAdmin && u.hasSignature) {
      setEditSignatureLoading(true);
      try {
        const res = await authAPI.getUserSignature(u._id);
        setEditSignaturePreview(res.data?.signaturePreview || '');
      } catch {
        toast.error('Could not load current signature');
      } finally {
        setEditSignatureLoading(false);
      }
    }
  };

  const closeEditUser = () => {
    setEditingUser(null);
    setEditSignatureFile(null);
    setEditSignaturePreview('');
    setClearEditSignature(false);
    resetEdit({ name: '', email: '', isActive: true });
  };

  const editingIsPoAdmin = editingUser?.role === 'PO_ADMIN' || editingUser?.role === 'ADMIN';

  const onUpdateUser = async (data) => {
    if (!editingUser) return;
    try {
      const payload = {
        name: data.name,
        email: data.email,
        isActive: Boolean(data.isActive),
      };
      if (editingIsPoAdmin && isSuperadmin) {
        if (clearEditSignature) {
          payload.clearSignature = true;
        } else if (editSignatureFile) {
          payload.signatureImage = await readImageFileAsDataUrl(editSignatureFile);
        }
      }
      await authAPI.updateUser(editingUser._id, payload);
      toast.success('User updated');
      closeEditUser();
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    }
  };

  const canDelete = useMemo(() => {
    if (!confirmDelete) return false;
    if (confirmDelete._id === user?._id) return false;
    if (confirmDelete.role === 'SUPERADMIN') return false;
    if (isPoAdmin && (confirmDelete.role === 'PO_ADMIN' || confirmDelete.role === 'ADMIN')) return false;
    return true;
  }, [confirmDelete, user?._id, isPoAdmin]);

  const handleDelete = async () => {
    if (!confirmDelete || !canDelete) return;
    try {
      await authAPI.deleteUser(confirmDelete._id);
      toast.success('User deleted');
      setConfirmDelete(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    }
  };

  return (
    <div>
      <PageBanner
        className="mb-4"
        title="Settings"
        subtitle={
          isSuperadmin
            ? 'User management and account security'
            : 'Account security'
        }
        action={[
          { onClick: () => setShowPasswordModal(true), label: 'Change password', icon: 'key' },
          { onClick: () => setShowPhotoModal(true), label: 'Upload DP', icon: 'none' },
          ...(canCreateUser ? [{ onClick: () => setShowCreate(true), label: 'Create User' }] : []),
        ]}
      />

      <ProfilePhotoModal open={showPhotoModal} onClose={() => setShowPhotoModal(false)} />

      {canCreateUser && (
        <>
          {showCreate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Create User</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {isSuperadmin
                        ? 'Superadmin can create PO Admin or PO Assistant users'
                        : 'PO Admin can create PO Assistant users'}
                    </p>
                  </div>
                  <button
                    onClick={closeCreateModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    type="button"
                    aria-label="Close create user modal"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSubmitCreate(onCreateUser)} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      className="input-field"
                      placeholder="Enter full name"
                      {...registerCreate('name', { required: 'Name is required' })}
                    />
                    {createErrors.name && (
                      <p className="text-red-500 text-xs mt-1">{createErrors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      className="input-field"
                      placeholder="assistant@company.com"
                      type="email"
                      {...registerCreate('email', {
                        required: 'Email is required',
                        pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email address' },
                      })}
                    />
                    {createErrors.email && (
                      <p className="text-red-500 text-xs mt-1">{createErrors.email.message}</p>
                    )}
                  </div>

                  {isSuperadmin ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <select
                        className="input-field"
                        {...registerCreate('role', { required: 'Role is required' })}
                      >
                        {CREATE_ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {createErrors.role && (
                        <p className="text-red-500 text-xs mt-1">{createErrors.role.message}</p>
                      )}
                    </div>
                  ) : null}

                  {isSuperadmin && createRole === 'PO_ADMIN' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Signature image <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="input-field py-2"
                        onChange={onCreateSignatureChange}
                      />
                      {createSignaturePreview ? (
                        <div className="mt-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
                          <img
                            src={createSignaturePreview}
                            alt="Signature preview"
                            className="max-h-20 max-w-full object-contain mx-auto"
                          />
                        </div>
                      ) : null}
                      <p className="text-xs text-gray-500 mt-1">
                        PNG or JPEG, max 1 MB. If omitted, Admin &amp; Accounts stays blank on POs this user approves.
                      </p>
                    </div>
                  ) : null}

                  {!isSuperadmin ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <input
                        className="input-field bg-gray-50"
                        value="PO Assistant"
                        readOnly
                      />
                    </div>
                  ) : null}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <PasswordInput
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                      {...registerCreate('password', {
                        required: 'Password is required',
                        pattern: { value: STRONG_PASSWORD_PATTERN, message: PASSWORD_POLICY_LABEL },
                      })}
                    />
                    {createErrors.password && (
                      <p className="text-red-500 text-xs mt-1">{createErrors.password.message}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">{PASSWORD_POLICY_LABEL}</p>
                  </div>

                  <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                    <button type="button" onClick={closeCreateModal} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" disabled={createSubmitting} className="btn-primary">
                      {createSubmitting ? 'Creating user...' : 'Create User'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {canCreateUser && (
            <>
              <div className="card">
                {loading ? (
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                    <div className="space-y-3">
                      {[0, 1, 2].map((row) => (
                        <div
                          key={row}
                          className="grid grid-cols-[2fr,2fr,1.5fr,1.2fr,1.2fr] gap-3 items-center py-2 border-b border-gray-100 last:border-0"
                        >
                          <div>
                            <Skeleton className="h-3 w-40 mb-2" />
                            <Skeleton className="h-3 w-56" />
                          </div>
                          <SkeletonText lines={2} />
                          <Skeleton className="h-6 w-20 rounded-full" />
                          <div className="flex justify-center">
                            <Skeleton className="h-8 w-20" />
                          </div>
                          <div className="flex justify-center gap-2">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <Skeleton className="h-8 w-8 rounded-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-500 font-medium">No users found</p>
                    <p className="text-sm text-gray-400 mt-1">Create a PO Admin or PO Assistant to get started</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                  <thead>
                    <tr>
                      <th className="text-left">Name</th>
                      <th className="text-center">Email</th>
                      <th className="text-center">Role</th>
                      <th className="text-center">Status</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const isTargetSuperadmin = u.role === 'SUPERADMIN';
                      const isTargetPoAdmin = u.role === 'PO_ADMIN' || u.role === 'ADMIN';
                      const isSelf = u._id === user?._id;
                      const canEdit = isSuperadmin
                        ? !isTargetSuperadmin
                        : !isSelf && !isTargetSuperadmin && !isTargetPoAdmin;
                      const deleteDisabled = !canEdit;
                      const disabledReason = isSuperadmin
                        ? 'Superadmin user cannot be modified here'
                        : 'PO Admin can edit/delete only PO Assistant users';
                      return (
                        <tr key={u._id}>
                          <td className="text-left font-semibold text-gray-800">{u.name}</td>
                          <td className="text-center text-gray-600">{u.email}</td>
                          <td className="text-center">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded border border-gray-200 bg-gray-50">
                              {roleLabel(u.role)}
                            </span>
                            {(u.role === 'PO_ADMIN' || u.role === 'ADMIN') && (
                              <span className={`block text-xs mt-0.5 ${u.hasSignature ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {u.hasSignature ? 'Signature on file' : 'No signature'}
                              </span>
                            )}
                          </td>
                          <td className="text-center">
                            <span
                              className={`badge ${
                                u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => openEditUser(u)}
                                className={`p-1.5 rounded transition-colors ${
                                  !canEdit
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-400 hover:text-primary-600'
                                }`}
                                title={canEdit ? 'Edit user' : disabledReason}
                                aria-label={canEdit ? `Edit ${u.name}` : undefined}
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </button>
                              <button
                                type="button"
                                disabled={deleteDisabled}
                                onClick={() =>
                                  setConfirmDelete({ _id: u._id, name: u.name, role: u.role })
                                }
                                className={`p-1.5 rounded transition-colors ${
                                  deleteDisabled
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-400 hover:text-red-600'
                                }`}
                                title={deleteDisabled ? disabledReason : 'Delete'}
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                    </table>
                  </div>
                )}
              </div>
              <ConfirmModal
                open={!!confirmDelete}
                title="Delete User"
                message={`Are you sure you want to delete "${confirmDelete?.name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                variant="danger"
                onConfirm={handleDelete}
                onCancel={() => setConfirmDelete(null)}
              />

              {editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                  <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="edit-user-title"
                  >
                    <div className="flex items-center justify-between p-6 border-b border-gray-100">
                      <div>
                        <h2 id="edit-user-title" className="text-lg font-bold text-gray-900">
                          Edit user
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">Update name, email, or account status</p>
                      </div>
                      <button
                        type="button"
                        onClick={closeEditUser}
                        disabled={editSubmitting}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded-lg disabled:opacity-50"
                        aria-label="Close"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <form onSubmit={handleSubmitEdit(onUpdateUser)} className="p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                        <input
                          className="input-field"
                          {...registerEdit('name', { required: 'Name is required' })}
                        />
                        {editErrors.name && (
                          <p className="text-red-500 text-xs mt-1">{editErrors.name.message}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          className="input-field"
                          autoComplete="off"
                          {...registerEdit('email', { required: 'Email is required' })}
                        />
                        {editErrors.email && (
                          <p className="text-red-500 text-xs mt-1">{editErrors.email.message}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <Controller
                          name="isActive"
                          control={controlEdit}
                          render={({ field }) => (
                            <CustomSelect
                              options={EDIT_USER_STATUS_OPTIONS}
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Select status..."
                              disabled={editSubmitting}
                            />
                          )}
                        />
                        <p className="text-xs text-gray-500 mt-1">Inactive users cannot sign in or use the API.</p>
                      </div>
                      {isSuperadmin && editingIsPoAdmin && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Signature image</label>
                          {editSignatureLoading ? (
                            <p className="text-sm text-gray-500">Loading current signature…</p>
                          ) : (
                            <>
                              {editSignaturePreview && !clearEditSignature ? (
                                <div className="mb-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
                                  <img
                                    src={editSignaturePreview}
                                    alt="Signature preview"
                                    className="max-h-20 max-w-full object-contain mx-auto"
                                  />
                                </div>
                              ) : (
                                <p className="text-sm text-amber-600 mb-2">No signature on file</p>
                              )}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                className="input-field py-2"
                                onChange={onEditSignatureChange}
                              />
                              {editSignaturePreview && !clearEditSignature ? (
                                <button
                                  type="button"
                                  className="text-sm text-red-600 hover:text-red-700 mt-2"
                                  onClick={() => {
                                    setClearEditSignature(true);
                                    setEditSignatureFile(null);
                                    setEditSignaturePreview('');
                                  }}
                                >
                                  Remove signature
                                </button>
                              ) : null}
                            </>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Optional. Without a signature, Admin &amp; Accounts stays blank on POs they approve.
                          </p>
                        </div>
                      )}
                      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                        <button type="button" onClick={closeEditUser} disabled={editSubmitting} className="btn-secondary">
                          Cancel
                        </button>
                        <button type="submit" disabled={editSubmitting} className="btn-primary">
                          {editSubmitting ? 'Saving…' : 'Save changes'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 id="change-password-title" className="text-lg font-bold text-gray-900">
                  Change password
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Enter your current password, then choose a new one (min. 6 characters).
                </p>
              </div>
              <button
                type="button"
                onClick={closePasswordModal}
                disabled={pwdSubmitting}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg disabled:opacity-50"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmitPwd(onChangePassword)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
                <PasswordInput
                  autoComplete="current-password"
                  {...registerPwd('currentPassword', { required: 'Current password is required' })}
                />
                {pwdErrors.currentPassword && (
                  <p className="text-red-500 text-xs mt-1">{pwdErrors.currentPassword.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <PasswordInput
                  autoComplete="new-password"
                  {...registerPwd('newPassword', {
                    required: 'New password is required',
                    minLength: { value: 6, message: 'Minimum 6 characters' },
                  })}
                />
                {pwdErrors.newPassword && (
                  <p className="text-red-500 text-xs mt-1">{pwdErrors.newPassword.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                <PasswordInput
                  autoComplete="new-password"
                  {...registerPwd('confirmPassword', {
                    required: 'Please confirm your new password',
                    validate: (val) => val === watchPwd('newPassword') || 'Does not match new password',
                  })}
                />
                {pwdErrors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">{pwdErrors.confirmPassword.message}</p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={closePasswordModal} disabled={pwdSubmitting} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={pwdSubmitting} className="btn-primary">
                  {pwdSubmitting ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
