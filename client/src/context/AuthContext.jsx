import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (mountedRef.current) setLoading(false);
    }, 5000); // 5 second max wait
    
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    // Safety timeout - ALWAYS unlock after 3 seconds no matter what
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data) setProfile(data);
            setLoading(false);
            clearTimeout(timeout);
          })
          .catch(() => {
            setLoading(false);
            clearTimeout(timeout);
          });
      } else {
        setLoading(false);
        clearTimeout(timeout);
      }
    }).catch(() => {
      setLoading(false);
      clearTimeout(timeout);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
            .then(({ data }) => {
              if (data) setProfile(data);
            });
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data && mountedRef.current) {
        setProfile(data);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      if (mountedRef.current) setLoading(false); // ALWAYS runs, no matter what
    }
  }

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const register = async (name, email, password, profileType = 'normal', birthDate = null, gender = null) => {
    const computedAge = birthDate
      ? Math.max(0, Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
      : null;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, profile_type: profileType, birth_date: birthDate, age: computedAge, gender },
      },
    });
    if (error) throw error;

    if (data?.user?.id) {
      try {
        await supabase
          .from('profiles')
          .upsert(
            { id: data.user.id, name, profile_type: profileType, birth_date: birthDate, age: computedAge, gender },
            { onConflict: 'id' }
          );
      } catch {
        // If email confirmation or RLS prevents this now, metadata still carries profile_type.
      }
    }

    return data;
  };

  const loginWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const updateProfile = async (updates) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (!error && data) {
      setProfile(data);
    }
    return { data, error };
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      loading,
      login,
      register,
      loginWithGoogle,
      logout,
      updateProfile,
      fetchProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
