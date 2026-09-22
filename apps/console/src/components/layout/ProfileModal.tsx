import React, { useState, useRef } from 'react';
import { Modal } from '../common/Modal';
import { ImageCropModal } from '../common/ImageCropModal';
import { useAuth } from '../../context/AuthContext';
import { ApiClient } from '../../api/client';
import {
  Camera,
  Trash2,
  Copy,
  Check,
  User,
  Mail,
  Building2,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Layers,
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateAvatar } = useAuth();

  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    showToast(`Copied ${field} to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImageSrc(reader.result as string);
      setIsCropOpen(true);
      // Reset input value so re-selecting same file triggers onChange
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedDataUrl: string) => {
    setIsUploading(true);
    try {
      const res = await ApiClient.put<{ success?: boolean; avatarUrl: string }>('/auth/me/avatar', {
        avatarDataUrl: croppedDataUrl,
      });

      updateAvatar(res.avatarUrl);
      setIsCropOpen(false);
      setSelectedImageSrc(null);
      showToast('Profile photo updated successfully!');
    } catch (err: any) {
      console.error('Failed to upload avatar:', err);
      alert(err?.message || 'Failed to upload profile photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!confirm('Are you sure you want to remove your profile photo?')) return;

    setIsDeleting(true);
    try {
      await ApiClient.delete('/auth/me/avatar');
      updateAvatar(null);
      showToast('Profile photo removed.');
    } catch (err: any) {
      console.error('Failed to remove avatar:', err);
      alert(err?.message || 'Failed to remove profile photo.');
    } finally {
      setIsDeleting(false);
    }
  };

  const initials = user?.fullName
    ? user.fullName
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'AD';

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="My Profile" maxWidth="480px">
        <div className="profile-dialog-content">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="profile-dialog-toast">
              <Sparkles size={14} className="profile-toast-icon" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Top Banner Hero with Avatar */}
          <div className="profile-hero-banner">
            <div className="profile-hero-bg-accent" />

            <div className="profile-avatar-wrapper">
              <div
                className="profile-avatar-frame"
                onClick={() => fileInputRef.current?.click()}
                title="Click to change photo"
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    className="profile-avatar-img"
                    onError={(e) => {
                      // Fallback to initials if image fails to load
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="profile-avatar-initials">{initials}</div>
                )}

                {/* Hover overlay with camera icon */}
                <div className="profile-avatar-hover-overlay">
                  <Camera size={22} />
                  <span>Change</span>
                </div>
              </div>

              {/* Floating Camera Button */}
              <button
                type="button"
                className="profile-avatar-badge-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload new photo"
              >
                <Camera size={14} />
              </button>
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: 'none' }}
            />

            {/* Profile Header Title */}
            <div className="profile-header-meta">
              <h3 className="profile-name-title">
                {user?.fullName || 'Support Agent'}
                <span className="profile-verified-badge" title="Verified Agent">
                  <ShieldCheck size={14} />
                </span>
              </h3>
              <p className="profile-email-subtitle">{user?.email || 'agent@workspace.local'}</p>
            </div>

            {/* Quick Actions (Upload / Delete photo) */}
            <div className="profile-avatar-actions">
              <button
                type="button"
                className="profile-action-btn primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Camera size={13} />
                <span>{user?.avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
              </button>

              {user?.avatarUrl && (
                <button
                  type="button"
                  className="profile-action-btn danger"
                  onClick={handleDeleteAvatar}
                  disabled={isDeleting}
                  title="Remove photo and use initials"
                >
                  <Trash2 size={13} />
                  <span>{isDeleting ? 'Removing...' : 'Remove'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Profile Details List */}
          <div className="profile-details-grid">
            {/* Full Name */}
            <div className="profile-info-card">
              <div className="profile-info-icon">
                <User size={16} />
              </div>
              <div className="profile-info-content">
                <span className="profile-info-label">Full Name</span>
                <span className="profile-info-value">{user?.fullName || 'Support Agent'}</span>
              </div>
            </div>

            {/* Email Address */}
            <div className="profile-info-card">
              <div className="profile-info-icon">
                <Mail size={16} />
              </div>
              <div className="profile-info-content">
                <span className="profile-info-label">Email Address</span>
                <span className="profile-info-value font-mono">{user?.email || 'N/A'}</span>
              </div>
              {user?.email && (
                <button
                  type="button"
                  className="profile-copy-btn"
                  onClick={() => handleCopy(user.email, 'Email')}
                  title="Copy email"
                >
                  {copiedField === 'Email' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                </button>
              )}
            </div>

            {/* Organization */}
            <div className="profile-info-card">
              <div className="profile-info-icon">
                <Building2 size={16} />
              </div>
              <div className="profile-info-content">
                <span className="profile-info-label">Organization</span>
                <span className="profile-info-value">{user?.tenantName || 'My Organization'}</span>
              </div>
            </div>

            {/* Tenant ID */}
            <div className="profile-info-card">
              <div className="profile-info-icon">
                <KeyRound size={16} />
              </div>
              <div className="profile-info-content">
                <span className="profile-info-label">Tenant ID</span>
                <span className="profile-info-value font-mono text-xs text-muted">
                  {user?.tenantId || 'N/A'}
                </span>
              </div>
              {user?.tenantId && (
                <button
                  type="button"
                  className="profile-copy-btn"
                  onClick={() => handleCopy(user.tenantId, 'Tenant ID')}
                  title="Copy Tenant ID"
                >
                  {copiedField === 'Tenant ID' ? (
                    <Check size={14} color="#10b981" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              )}
            </div>

            {/* User Type & Session Status */}
            <div className="profile-meta-row">
              <div className="profile-meta-item">
                <span className="profile-info-label">User Kind</span>
                <span
                  className={`profile-kind-pill ${user?.kind === 'STAFF' ? 'staff' : 'customer'}`}
                >
                  {user?.kind || 'STAFF'}
                </span>
              </div>

              <div className="profile-meta-item">
                <span className="profile-info-label">Session Status</span>
                <span className="profile-status-indicator">
                  <span className="profile-status-dot" />
                  <span>Active Session</span>
                </span>
              </div>
            </div>

            {/* Assigned Roles */}
            <div className="profile-roles-section">
              <div className="profile-roles-header">
                <Layers size={14} />
                <span>Assigned Workspace Roles</span>
              </div>
              <div className="profile-roles-tags">
                {user?.roles && user.roles.length > 0 ? (
                  user.roles.map((role: string) => (
                    <span key={role} className="profile-role-badge">
                      {role.replace(/_/g, ' ')}
                    </span>
                  ))
                ) : (
                  <span className="profile-no-roles">No explicit roles assigned</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Image Crop Dialog */}
      <ImageCropModal
        isOpen={isCropOpen}
        imageSrc={selectedImageSrc}
        onClose={() => {
          setIsCropOpen(false);
          setSelectedImageSrc(null);
        }}
        onCropComplete={handleCropComplete}
        isSaving={isUploading}
      />
    </>
  );
};
