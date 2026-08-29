'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiClient, uploadAvatar, ApiError } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
}

export function ProfileForm({ user, token }: { user: User; token: string }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');
    try {
      let avatarUrl: string | undefined;
      if (avatarFile) {
        avatarUrl = await uploadAvatar(avatarFile, token);
      }
      await apiClient('/api/auth/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ name, ...(avatarUrl ? { avatarUrl } : {}) }),
      });
      setAvatarFile(null);
      setProfileSuccess('Profile updated');
      router.refresh();
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    setPasswordLoading(true);
    try {
      await apiClient('/api/auth/change-password', {
        method: 'POST',
        token,
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Password changed');
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setPasswordLoading(false);
    }
  }

  const inputClass = 'w-full rounded border border-gray-300 px-3 py-2 text-sm';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-3 font-bold">Profile</h2>
        <p className="mb-3 text-sm text-gray-500">{user.email}</p>
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt="Avatar"
            className="mb-3 h-16 w-16 rounded-full object-cover"
          />
        ) : null}
        <form onSubmit={handleProfileSubmit} className="space-y-3">
          {profileError ? <p className="text-sm text-red-600">{profileError}</p> : null}
          {profileSuccess ? <p className="text-sm text-green-600">{profileSuccess}</p> : null}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            required
            className={inputClass}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
          <button
            type="submit"
            disabled={profileLoading}
            className="w-full rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {profileLoading ? 'Saving...' : 'Save profile'}
          </button>
        </form>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="mb-3 font-bold">Change password</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
          {passwordSuccess ? <p className="text-sm text-green-600">{passwordSuccess}</p> : null}
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            required
            className={inputClass}
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8 characters)"
            required
            className={inputClass}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            className={inputClass}
          />
          <button
            type="submit"
            disabled={passwordLoading}
            className="w-full rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {passwordLoading ? 'Changing...' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
}
