import { supabase } from '../lib/supabase';
import { isNetworkError } from '../lib/connectivity';

export type UserRole = 'reader' | 'creator' | 'both' | 'supervisor';
export type Permission = 'moderate_content' | 'manage_users' | 'manage_reports';

export interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  photo?: string;
  bio?: string;
  birthDate?: string;
  residence?: string;
  country?: string;
  phone?: string;
  preferredLanguage?: string;
  favoriteGenres?: string[];
  role?: UserRole;
  permissions?: Permission[];
  penName?: string;
  portfolioUrl?: string;
  specialization?: string;
  creatorBio?: string;
  currency?: string;
  isActive?: boolean;
  isDeleted?: boolean;
  banUntil?: string | null;
  createdAt?: string;
}

export interface AuthResult {
  success: boolean;
  message: string;
  code?: 'network';
  user?: User;
}

function mapProfileToUser(data: any, authEmail: string): User {
  return {
    id: data.id,
    name: data.name || 'Unknown User',
    email: authEmail || data.email || '',
    username: data.username || '',
    photo: data.photo || '',
    bio: data.bio || '',
    birthDate: data.birth_date || '',
    residence: data.residence || '',
    country: data.country || '',
    phone: data.phone || '',
    preferredLanguage: data.preferred_language || 'English',
    role: (data.role as UserRole) || 'reader',
    currency: data.currency || 'XOF',
    favoriteGenres: Array.isArray(data.favorite_genres) ? data.favorite_genres : [],
    penName: data.pen_name || '',
    portfolioUrl: data.portfolio_url || '',
    specialization: data.specialization || 'Writer',
    creatorBio: data.creator_bio || '',
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
    isActive: data.is_active ?? true,
    isDeleted: data.is_deleted ?? false,
    banUntil: data.ban_until ?? null,
    createdAt: data.created_at ?? undefined,
  };
}

/** PostgREST renvoie soit un objet (RPC), soit un tableau (update().select()), soit rien. */
function firstRow(data: any): any | null {
  if (!data) return null;
  if (Array.isArray(data)) return data[0] ?? null;
  return typeof data === 'object' ? data : null;
}

function isBanned(profile: any): boolean {
  return Boolean(profile.ban_until && new Date(profile.ban_until) > new Date());
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (isNetworkError(error)) {
        return { success: false, code: 'network', message: 'Network error. Please check your connection and try again.' };
      }
      if (error.message.toLowerCase().includes('email not confirmed')) {
        return { success: false, message: 'Please confirm your email address before logging in.' };
      }
      return { success: false, message: 'Invalid email or password.' };
    }

    if (!data.user) return { success: false, message: 'Login failed.' };

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
    }

    if (!profile) {
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
          email: data.user.email,
          role: 'reader',
        })
        .select()
        .single();

      if (insertError || !newProfile) {
        return {
          success: true,
          message: 'Login successful, but profile is incomplete.',
          user: mapProfileToUser({ id: data.user.id, name: data.user.user_metadata?.name || 'User', email: data.user.email }, data.user.email || '')
        };
      }

      return { success: true, message: 'Welcome!', user: mapProfileToUser(newProfile, email) };
    }

    if (profile.is_deleted) {
      await supabase.auth.signOut();
      return { success: false, message: 'This account has been deleted.' };
    }
    if (isBanned(profile)) {
      await supabase.auth.signOut();
      const dateStr = new Date(profile.ban_until).toLocaleDateString();
      return { success: false, message: `Your account is banned until ${dateStr}.` };
    }
    if (profile.is_active === false) {
      await supabase.auth.signOut();
      return { success: false, message: 'Your account is suspended.' };
    }

    return { success: true, message: 'Welcome back!', user: mapProfileToUser(profile, email) };
  } catch (err: any) {
    if (isNetworkError(err)) {
      return { success: false, code: 'network', message: 'Network error. Please check your connection and try again.' };
    }
    return { success: false, message: err?.message || 'An unexpected error occurred.' };
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.user) return null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profileError && isNetworkError(profileError)) throw profileError;
    if (profileError || !profile) return null;

    if (profile.is_deleted === true || isBanned(profile) || profile.is_active === false) {
      await supabase.auth.signOut();
      return null;
    }

    return mapProfileToUser(profile, session.user.email || '');
  } catch (err) {
    // Panne réseau : on laisse l'appelant conserver l'utilisateur déjà connu.
    if (isNetworkError(err)) throw err;
    console.error('[userService] getCurrentUser failed:', err);
    return null;
  }
}

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return mapProfileToUser(data, data.email);
}

export async function getUsersByIds(ids: string[]): Promise<User[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('profiles').select('*').in('id', ids);
  if (error || !data) return [];
  return data.map((p) => mapProfileToUser(p, p.email));
}

export async function registerUser(name: string, email: string, password: string): Promise<AuthResult> {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/let-go`,
      },
    });

    if (authError) {
      if (isNetworkError(authError)) {
        return { success: false, code: 'network', message: 'Network error. Please check your connection and try again.' };
      }
      return { success: false, message: authError.message };
    }
    if (!authData.user) return { success: false, message: 'Registration failed.' };

    if (authData.user.identities && authData.user.identities.length === 0) {
      return { success: false, message: 'An account with this email already exists.' };
    }

    return {
      success: true,
      message: `Account created for ${name}. Please check your email to confirm.`,
    };
  } catch (err: any) {
    if (isNetworkError(err)) {
      return { success: false, code: 'network', message: 'Network error. Please check your connection and try again.' };
    }
    return { success: false, message: err?.message || 'An unexpected error occurred.' };
  }
}

export async function logoutCurrentUser(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) {
      console.warn('[userService] Global sign-out failed, clearing local session.', error.message);
      await supabase.auth.signOut({ scope: 'local' });
    }
  } catch (err) {
    console.warn('[userService] Sign-out error, forcing local clear.', err);
    await supabase.auth.signOut({ scope: 'local' });
  } finally {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('reztoon:logout'));
    }
  }
}

export async function setCurrentUser(user: User | null): Promise<void> {
  if (!user) await logoutCurrentUser();
}

export async function updateUser(
  id: string,
  updates: Partial<Omit<User, 'role' | 'permissions'>>,
): Promise<AuthResult> {
  try {
    const caller = await getCurrentUser();
    if (!caller) return { success: false, message: 'Not authenticated.' };
    if (caller.id !== id) return { success: false, message: 'Not authorized.' };

    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.username !== undefined) dbUpdates.username = updates.username;
    if (updates.photo !== undefined) dbUpdates.photo = updates.photo;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
    if (updates.birthDate !== undefined) dbUpdates.birth_date = updates.birthDate;
    if (updates.residence !== undefined) dbUpdates.residence = updates.residence;
    if (updates.country !== undefined) dbUpdates.country = updates.country;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.preferredLanguage !== undefined) dbUpdates.preferred_language = updates.preferredLanguage;
    if (updates.favoriteGenres !== undefined) dbUpdates.favorite_genres = updates.favoriteGenres;
    if (updates.penName !== undefined) dbUpdates.pen_name = updates.penName;
    if (updates.portfolioUrl !== undefined) dbUpdates.portfolio_url = updates.portfolioUrl;
    if (updates.specialization !== undefined) dbUpdates.specialization = updates.specialization;
    if (updates.creatorBio !== undefined) dbUpdates.creator_bio = updates.creatorBio;

    if (Object.keys(dbUpdates).length === 0) {
      return { success: true, message: 'Nothing to update.', user: caller };
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', id)
      .select();

    if (error) return { success: false, message: error.message };
    const row = firstRow(data);
    if (!row) {
      return { success: false, message: 'Profile update was not applied (permission denied).' };
    }
    return { success: true, message: 'Profile updated.', user: mapProfileToUser(row, row.email) };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Update failed.' };
  }
}

export async function adminUpdateUser(
  id: string,
  updates: Partial<Pick<User, 'role' | 'permissions'>>,
): Promise<AuthResult> {
  try {
    const caller = await getCurrentUser();
    if (!caller || caller.role !== 'supervisor') {
      return { success: false, message: 'Not authorized.' };
    }

    const dbUpdates: any = {};
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.permissions !== undefined) dbUpdates.permissions = updates.permissions;

    if (Object.keys(dbUpdates).length === 0) {
      return { success: true, message: 'Nothing to update.' };
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', id)
      .select();

    if (error) return { success: false, message: error.message };
    const row = firstRow(data);
    if (!row) {
      return { success: false, message: 'Update was not applied (permission denied).' };
    }
    return { success: true, message: 'User updated.', user: mapProfileToUser(row, row.email) };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Update failed.' };
  }
}

export async function updatePassword(newPassword: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Password updated successfully.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Update failed.' };
  }
}

export async function getUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_deleted', false);
  if (error || !data) return [];
  return data.map((p) => mapProfileToUser(p, p.email));
}

export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user) return false;
  if (user.role === 'supervisor') return true;
  return (user.permissions ?? []).includes(permission);
}

export async function getSupervisors(): Promise<User[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'supervisor')
    .eq('is_active', true)
    .eq('is_deleted', false);
  if (error || !data) return [];
  return data.map((p) => mapProfileToUser(p, p.email));
}

export async function toggleUserActive(id: string, isActive: boolean): Promise<AuthResult> {
  const patch: any = { is_active: isActive };
  if (isActive) patch.ban_until = null;
  const { error } = await supabase.from('profiles').update(patch).eq('id', id);
  if (error) return { success: false, message: error.message };
  return { success: true, message: `User ${isActive ? 'activated' : 'deactivated'}.` };
}

export async function deleteUserAccount(id: string): Promise<AuthResult> {
  const { error } = await supabase
    .from('profiles')
    .update({
      is_deleted: true,
      name: 'Deleted User',
      email: `deleted_${id}@reztoon.com`,
      photo: null,
      is_active: false,
    })
    .eq('id', id);
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'User account has been permanently deleted.' };
}

export async function banUser(id: string, days: number): Promise<AuthResult> {
  const banUntil = new Date();
  banUntil.setDate(banUntil.getDate() + days);
  const { error } = await supabase
    .from('profiles')
    .update({ ban_until: banUntil.toISOString(), is_active: false })
    .eq('id', id);
  if (error) return { success: false, message: error.message };
  return { success: true, message: `User banned for ${days} days.` };
}

export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error('[uploadAvatar] failed:', err);
    return null;
  }
}

export async function updateOwnRole(
  role: 'reader' | 'creator' | 'both',
): Promise<AuthResult> {
  try {
    if (!['reader', 'creator', 'both'].includes(role)) {
      return { success: false, message: 'Invalid role.' };
    }

    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return { success: false, message: 'Not authenticated.' };

    const { data: current } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
    if (current?.role === 'supervisor') {
      return { success: false, message: 'Les superviseurs ne peuvent pas changer leur propre rôle.' };
    }

    let row: any = null;
    const rpc = await supabase.rpc('update_own_role', { new_role: role });
    if (!rpc.error) {
      row = firstRow(rpc.data);
    } else {
      const direct = await supabase.from('profiles').update({ role }).eq('id', uid).select();
      if (direct.error) return { success: false, message: direct.error.message };
      row = firstRow(direct.data);
    }

    if (!row) {
      const { data: fresh } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      row = fresh;
    }
    if (!row || row.role !== role) {
      return { success: false, message: 'Role update was not applied.' };
    }

    return { success: true, message: 'Role updated.', user: mapProfileToUser(row, row.email) };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Role update failed.' };
  }
}
