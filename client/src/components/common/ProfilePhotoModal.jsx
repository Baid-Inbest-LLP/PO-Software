import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import Skeleton from './Skeleton';
import { fetchAvatar, updateProfile } from '../../features/auth/authSlice';

const readImageFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });

export default function ProfilePhotoModal({ open, onClose }) {
  const dispatch = useDispatch();
  const { user, avatarPreview } = useSelector((state) => state.auth);
  const fileInputRef = useRef(null);
  const [localPreview, setLocalPreview] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [clearPhoto, setClearPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const displayPreview = clearPhoto ? '' : localPreview || avatarPreview;
  const hasChanges = Boolean(pendingFile) || clearPhoto;

  useEffect(() => {
    if (!open) return undefined;
    setLocalPreview('');
    setPendingFile(null);
    setClearPhoto(false);

    let cancelled = false;
    if (user?.hasAvatar && !avatarPreview) {
      setLoadingPreview(true);
      dispatch(fetchAvatar()).finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [open, dispatch, user?.hasAvatar, avatarPreview]);

  if (!open) return null;

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      toast.error('Photo must be a PNG, JPEG, or WebP image');
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error('Photo must be 1 MB or smaller');
      return;
    }
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setPendingFile(file);
      setLocalPreview(dataUrl);
      setClearPhoto(false);
    } catch {
      toast.error('Could not preview photo');
    }
  };

  const onRemove = () => {
    setPendingFile(null);
    setLocalPreview('');
    setClearPhoto(true);
  };

  const onSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      let payload = {};
      if (clearPhoto) {
        payload = { clearAvatar: true };
      } else if (pendingFile) {
        payload = { avatarImage: await readImageFileAsDataUrl(pendingFile) };
      }
      const result = await dispatch(updateProfile(payload));
      if (updateProfile.fulfilled.match(result)) {
        toast.success('Profile photo updated');
        setPendingFile(null);
        setLocalPreview('');
        setClearPhoto(false);
        onClose();
      } else {
        toast.error(result.payload || 'Failed to update photo');
      }
    } catch {
      toast.error('Failed to update photo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="card profile-photo-modal w-full max-w-lg p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Upload DP</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
            disabled={saving}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col items-center">
          <div className="profile-photo-modal-preview w-[min(20rem,50vw)] h-[min(20rem,50vw)] max-w-full rounded-full overflow-hidden flex items-center justify-center text-6xl font-semibold">
            {loadingPreview ? (
              <Skeleton className="w-full h-full rounded-full" />
            ) : displayPreview ? (
              <img
                src={displayPreview}
                alt="Profile"
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <span className="profile-photo-modal-initial">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-4 text-center">
            PNG, JPEG, or WebP · max 1 MB
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={onFileChange}
          />

          <div className="flex items-center justify-center gap-3 mt-5 w-full">
            <button
              type="button"
              className="btn-secondary flex-1 justify-center"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
            >
              Choose photo
            </button>
            <button
              type="button"
              className="btn-danger flex-1 justify-center"
              onClick={onRemove}
              disabled={saving || !displayPreview}
            >
              Remove photo
            </button>
          </div>
        </div>

        <button
          type="button"
          className="btn-primary w-full justify-center mt-2"
          onClick={onSave}
          disabled={saving || !hasChanges}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
