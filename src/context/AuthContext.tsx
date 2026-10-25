import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabase/client';
import type { ProfileRow, DepartmentRow, UserRole } from '../types/database.types';

export type UserProfile = ProfileRow & {
  departments?: DepartmentRow | null;
};

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  role: UserRole | null;
  departmentCode: string | null;
  isAdmin: boolean;
  isReviewer: boolean;
  isOfficer: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  instantDemoLogin: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_PROFILES: Record<string, {
  name: string;
  role: UserRole;
  deptCode: string;
  deptName: string;
  deptId: string;
  designation: string;
}> = {
  'admin@aicte.gov.in': {
    name: 'Dr. R. K. Sharma',
    role: 'Administrator',
    deptCode: 'RB',
    deptName: 'Regulation Bureau',
    deptId: 'd0000000-0000-0000-0000-000000000001',
    designation: 'Chief Vigilance Officer',
  },
  'rb.officer@aicte.gov.in': {
    name: 'Smt. Sunita Verma',
    role: 'Bureau Officer',
    deptCode: 'RB',
    deptName: 'Regulation Bureau',
    deptId: 'd0000000-0000-0000-0000-000000000001',
    designation: 'Director (Regulation)',
  },
  'pgrc.officer@aicte.gov.in': {
    name: 'Shri Arvind Nair',
    role: 'Bureau Officer',
    deptCode: 'PGRC',
    deptName: 'Public Grievance Redressal Cell',
    deptId: 'd0000000-0000-0000-0000-000000000002',
    designation: 'Nodal Officer (PGRC)',
  },
  'reviewer@aicte.gov.in': {
    name: 'Dr. Meenakshi Sundaram',
    role: 'Cross-Department Reviewer',
    deptCode: 'AB',
    deptName: 'Approval Bureau',
    deptId: 'd0000000-0000-0000-0000-000000000003',
    designation: 'Senior Consultant (Coordination)',
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isConfigured = isSupabaseConfigured();

  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          departments(*)
        `)
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Could not load profile from profiles table:', error.message);
        return null;
      }

      return data as unknown as UserProfile;
    } catch (err) {
      console.warn('Exception during profile fetch:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    const p = await fetchProfile(user.id);
    setProfile(p);
  };

  useEffect(() => {
    let mounted = true;

    // Check if session was cached in sessionStorage
    const cachedUser = sessionStorage.getItem('aicte_session_user');
    const cachedProfile = sessionStorage.getItem('aicte_session_profile');
    if (cachedUser && cachedProfile) {
      try {
        setUser(JSON.parse(cachedUser));
        setProfile(JSON.parse(cachedProfile));
        setIsLoading(false);
        return;
      } catch (e) {
        console.error(e);
      }
    }

    const timeoutTimer = setTimeout(() => {
      if (mounted) setIsLoading(false);
    }, 2000);

    if (!isConfigured) {
      setIsLoading(false);
      clearTimeout(timeoutTimer);
      return;
    }

    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) console.warn('Auth getSession error:', error.message);

        if (mounted) {
          setSession(session ?? null);
          setUser(session?.user ?? null);

          if (session?.user) {
            const p = await fetchProfile(session.user.id);
            if (mounted) setProfile(p);
          }
        }
      } catch (err) {
        console.warn('Failed to retrieve active session:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
          clearTimeout(timeoutTimer);
        }
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession ?? null);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          const p = await fetchProfile(newSession.user.id);
          if (mounted) setProfile(p);
        } else if (!sessionStorage.getItem('aicte_session_user')) {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeoutTimer);
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    setSession(data.session);
    setUser(data.user);
    if (data.user) {
      const p = await fetchProfile(data.user.id);
      setProfile(p);
    }
  };

  // Instant demo login bypasses remote auth glitches while keeping all Supabase DB calls live
  const instantDemoLogin = async (email: string) => {
    const demo = DEMO_PROFILES[email.toLowerCase().trim()];
    if (!demo) throw new Error('Unknown officer profile.');

    const mockUser: User = {
      id: 'b0000000-0000-0000-0000-000000000001',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: demo.name, role: demo.role },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: email,
      phone: '',
      role: 'authenticated',
      updated_at: new Date().toISOString(),
    };

    const mockProfile: UserProfile = {
      id: mockUser.id,
      full_name: demo.name,
      department_id: demo.deptId,
      role: demo.role,
      designation: demo.designation,
      contact_number: '+91 11 2958 1000',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      departments: {
        id: demo.deptId,
        name: demo.deptName,
        code: demo.deptCode,
        description: null,
        created_at: new Date().toISOString(),
      },
    };

    sessionStorage.setItem('aicte_session_user', JSON.stringify(mockUser));
    sessionStorage.setItem('aicte_session_profile', JSON.stringify(mockProfile));

    setUser(mockUser);
    setProfile(mockProfile);
  };

  const signOut = async () => {
    sessionStorage.removeItem('aicte_session_user');
    sessionStorage.removeItem('aicte_session_profile');
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsLoading(false);
    }
  };

  const role = profile?.role ?? null;
  const departmentCode = profile?.departments?.code ?? null;
  const isAdmin = role === 'Administrator';
  const isReviewer = role === 'Cross-Department Reviewer';
  const isOfficer = role === 'Bureau Officer';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoading,
        isConfigured,
        role,
        departmentCode,
        isAdmin,
        isReviewer,
        isOfficer,
        signIn,
        instantDemoLogin,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
