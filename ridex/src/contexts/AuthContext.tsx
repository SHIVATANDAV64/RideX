import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ID, OAuthProvider, Query, type Models } from 'appwrite';
import { account, DB_ID, TABLE, tablesDB } from '../lib/appwrite';
import { APPWRITE_CONFIGURED, MISSING_APPWRITE_ENV } from '../lib/env';

export type AppRole = 'rider' | 'driver' | 'admin';

export type AppUserProfile = Models.Row & {
  user_id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: AppRole;
  avatar_url?: string | null;
  notifications_enabled: boolean;
  safety_alerts_enabled: boolean;
  marketing_opt_in: boolean;
  preferred_payment_method_id?: string | null;
};

interface AuthState {
  user: Models.User<Models.Preferences> | null;
  profile: AppUserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => void;
  sendMagicLink: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<AppUserProfile, 'name' | 'phone' | 'avatar_url' | 'notifications_enabled' | 'safety_alerts_enabled' | 'marketing_opt_in' | 'preferred_payment_method_id'>>) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function syncProfileForUser(currentUser: Models.User<Models.Preferences>): Promise<AppUserProfile> {
  const existing = await tablesDB.listRows<AppUserProfile>({
    databaseId: DB_ID,
    tableId: TABLE.USERS,
    queries: [Query.equal('user_id', currentUser.$id), Query.limit(1)],
  });

  const nextBase = {
    user_id: currentUser.$id,
    name: currentUser.name || 'Rider',
    email: currentUser.email,
    phone: currentUser.phone || null,
  };

  if (existing.total === 0) {
    return tablesDB.createRow<AppUserProfile>({
      databaseId: DB_ID,
      tableId: TABLE.USERS,
      rowId: ID.unique(),
      data: {
        ...nextBase,
        role: 'rider',
        avatar_url: null,
        notifications_enabled: true,
        safety_alerts_enabled: true,
        marketing_opt_in: false,
        preferred_payment_method_id: null,
      },
    });
  }

  const profile = existing.rows[0];
  const patch: Record<string, string | null> = {};

  if (profile.name !== nextBase.name) patch.name = nextBase.name;
  if (profile.email !== nextBase.email) patch.email = nextBase.email;
  if ((profile.phone || null) !== nextBase.phone) patch.phone = nextBase.phone;

  if (Object.keys(patch).length === 0) {
    return profile;
  }

  return tablesDB.updateRow<AppUserProfile>({
    databaseId: DB_ID,
    tableId: TABLE.USERS,
    rowId: profile.$id,
    data: patch,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!APPWRITE_CONFIGURED) {
        if (active) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const userId = params.get('userId');
      const secret = params.get('secret');

      try {
        if (userId && secret) {
          await account.createSession({ userId, secret });
        }

        const currentUser = await account.get();
        const currentProfile = await syncProfileForUser(currentUser);

        if (!active) return;
        setUser(currentUser);
        setProfile(currentProfile);
      } catch {
        if (!active) return;
        setUser(null);
        setProfile(null);
      } finally {
        const url = new URL(window.location.href);
        url.searchParams.delete('userId');
        url.searchParams.delete('secret');
        window.history.replaceState({}, document.title, url.toString());

        if (active) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  async function refreshProfile() {
    if (!APPWRITE_CONFIGURED) {
      throw new Error(`Appwrite is not configured. Missing: ${MISSING_APPWRITE_ENV.join(', ')}`);
    }

    const currentUser = await account.get();
    const currentProfile = await syncProfileForUser(currentUser);
    setUser(currentUser);
    setProfile(currentProfile);
  }

  async function login(email: string, password: string) {
    if (!APPWRITE_CONFIGURED) {
      throw new Error(`Appwrite is not configured. Missing: ${MISSING_APPWRITE_ENV.join(', ')}`);
    }

    await account.createEmailPasswordSession({ email, password });
    await refreshProfile();
  }

  async function register(name: string, email: string, password: string) {
    if (!APPWRITE_CONFIGURED) {
      throw new Error(`Appwrite is not configured. Missing: ${MISSING_APPWRITE_ENV.join(', ')}`);
    }

    await account.create({ userId: ID.unique(), email, password, name });
    await login(email, password);
  }

  function loginWithGoogle() {
    if (!APPWRITE_CONFIGURED) {
      throw new Error(`Appwrite is not configured. Missing: ${MISSING_APPWRITE_ENV.join(', ')}`);
    }

    const success = `${window.location.origin}/home`;
    const failure = `${window.location.origin}/login`;
    account.createOAuth2Session({
      provider: OAuthProvider.Google,
      success,
      failure,
    });
  }

  async function sendMagicLink(email: string) {
    if (!APPWRITE_CONFIGURED) {
      throw new Error(`Appwrite is not configured. Missing: ${MISSING_APPWRITE_ENV.join(', ')}`);
    }

    await account.createMagicURLToken({
      userId: ID.unique(),
      email,
      url: `${window.location.origin}/login`,
      phrase: false,
    });
  }

  async function logout() {
    if (!APPWRITE_CONFIGURED) {
      setUser(null);
      setProfile(null);
      return;
    }

    await account.deleteSession('current');
    setUser(null);
    setProfile(null);
  }

  async function updateProfile(updates: Partial<Pick<AppUserProfile, 'name' | 'phone' | 'avatar_url' | 'notifications_enabled' | 'safety_alerts_enabled' | 'marketing_opt_in' | 'preferred_payment_method_id'>>) {
    if (!APPWRITE_CONFIGURED) {
      throw new Error(`Appwrite is not configured. Missing: ${MISSING_APPWRITE_ENV.join(', ')}`);
    }

    if (!profile) {
      throw new Error('Profile not loaded');
    }

    const nextProfile = await tablesDB.updateRow<AppUserProfile>({
      databaseId: DB_ID,
      tableId: TABLE.USERS,
      rowId: profile.$id,
      data: updates,
    });

    setProfile(nextProfile);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin: profile?.role === 'admin',
        loading,
        login,
        register,
        loginWithGoogle,
        sendMagicLink,
        logout,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
