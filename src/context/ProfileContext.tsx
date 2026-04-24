import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { Profile, ProfileContextValue, ProfileListItem } from '../types';
import {
  fetchProfiles,
  fetchProfileById,
  insertProfile,
  updateProfileById,
  deleteProfileById,
  fetchUsers,
} from '../services/profileService';

const ProfileContext = createContext<ProfileContextValue | null>(null);

const DEFAULT_PROFILE: Profile = {
  personal: { name: '', email: '', phone: '', linkedin: '', portfolio: '', location: '' },
  accentColor: '#7C3AED',
  about: '',
  education: [],
  experience: [],
  projects: [],
  skills: {},
  certifications: []
};

function stripOwnerFields(item: ProfileListItem): Omit<ProfileListItem, 'ownerName' | 'ownerUsername' | 'ownerRole' | 'id'> {
  const { ownerName: _on, ownerUsername: _ou, ownerRole: _or, id: _id, ...rest } = item;
  return rest;
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(false);
  const [profileId, setProfileId] = useState<string | number | null>(null);
  const [profiles, setProfiles] = useState<ProfileListItem[]>([]);
  const [isProfileSelected, setIsProfileSelected] = useState(false);
  const [isDraft, setIsDraft] = useState(false);

  const loadProfile = useCallback(async (): Promise<void> => {
    if (!user) {
      setProfiles([]);
      setProfile(DEFAULT_PROFILE);
      setProfileId(null);
      setIsProfileSelected(false);
      setIsDraft(false);
      return;
    }

    setLoading(true);
    try {
      const [profilesData, usersData] = await Promise.all([
        fetchProfiles(user.userRole === 'admin', user.id),
        fetchUsers(),
      ]);
      const userMap = new Map(usersData.map(u => [u.id, u]));
      setProfiles(profilesData.map(item => {
        const owner = userMap.get(item.userId ?? '');
        return {
          ...item,
          ownerName: owner?.name || owner?.username || '',
          ownerUsername: owner?.username || '',
          ownerRole: owner?.userRole || 'user',
        };
      }));
      // Don't auto-select — user must pick from the dropdown
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const saveProfile = async (updated: Profile): Promise<void> => {
    if (!user) return;
    const existingProfile = profileId ? profiles.find(p => p.id === profileId) : undefined;
    const payload = { ...updated, userId: existingProfile?.userId ?? user.id };

    if (profileId) {
      try {
        await updateProfileById(profileId, stripOwnerFields({ ...payload, id: profileId }));
        setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, ...payload, id: profileId } : p));
      } catch (e) {
        console.error(e);
      }
    } else {
      try {
        const created = await insertProfile(stripOwnerFields({ ...payload, id: 0 }));
        const newId = created.id;
        const payloadWithId: ProfileListItem = {
          ...payload,
          id: newId,
          ownerName: user.name || user.username,
          ownerUsername: user.username,
          ownerRole: user.userRole || 'user',
        };
        setProfileId(newId);
        setProfiles(prev => [...prev, payloadWithId]);
      } catch (e) {
        console.error(e);
        return;
      }
    }
    setProfile(payload);
    setIsDraft(false);
  };

  const deleteProfile = async (id: string | number): Promise<void> => {
    if (!user) return;
    try {
      await deleteProfileById(id);
    } catch (e) {
      console.error(e);
      return;
    }

    setProfiles(prev => prev.filter(p => p.id !== id));

    if (profileId === id) {
      setProfile(DEFAULT_PROFILE);
      setProfileId(null);
      setIsProfileSelected(false);
      setIsDraft(false);
    }
  };

  const switchProfile = async (id: string | number): Promise<void> => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchProfileById(id);
      setProfile(data);
      setProfileId(id);
      setIsProfileSelected(true);
      setIsDraft(false);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const createNewProfile = (): boolean => {
    const ownedCount = user?.userRole === 'admin'
      ? profiles.length
      : profiles.filter(p => p.userId === user?.id).length;

    if (user?.userRole !== 'admin' && ownedCount >= 4) {
      return false;
    }

    setProfile(DEFAULT_PROFILE);
    setProfileId(null);
    setIsProfileSelected(true);
    setIsDraft(true);
    return true;
  };

  const loadDraftProfile = (draft: Partial<Profile>): void => {
    setProfile({ ...DEFAULT_PROFILE, ...draft });
    setProfileId(null);
    setIsProfileSelected(true);
    setIsDraft(false);
  };

  const updateField = <K extends keyof Profile>(field: K, value: Profile[K]): void => {
    setProfile(p => ({ ...p, [field]: value } as Profile));
  };

  return (
    <ProfileContext.Provider value={{ profile, loading, isProfileSelected, isDraft, saveProfile, deleteProfile, updateField, loadProfile, loadDraftProfile, profiles, switchProfile, createNewProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
