import { createContext, useState, useContext, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const AuthContext = createContext();

// Initialize Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const lastVerifiedSupabaseTokenRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

  // Create axios instance with auth header
  const api = axios.create({
    baseURL: API_BASE,
    // Render's free tier spins the backend down when idle. Render's own
    // dashboard says a cold start "can delay requests by 50 seconds or
    // more," but that's an understatement for this specific app — live
    // Render logs show this Spring Boot backend (JVM warm-up + Hibernate/JPA
    // init + connection pooling + loading problem banks at startup) actually
    // takes ~135s to boot from cold ("Started MockmateApplication in 137.0
    // seconds" / "133.801 seconds" on two separate observed cold starts).
    // 65s was still less than half of what's needed. 160s gives margin over
    // the observed worst case — see also the keep-alive workflow that
    // avoids most cold starts happening at all.
    timeout: 160000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add token to requests if it exists
  api.interceptors.request.use((config) => {
    const currentToken = localStorage.getItem('token');
    if (currentToken) {
      config.headers.Authorization = `Bearer ${currentToken}`;
    }
    return config;
  });

  // Handle 401 errors by clearing token
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        logout();
      }
      return Promise.reject(error);
    }
  );

  // Exchange Supabase token for MockMate token
  const verifySupabaseToken = async (supabaseAccessToken) => {
    try {
      setError(null);
      const response = await api.post('/api/auth/verify', {
        token: supabaseAccessToken
      });

      const { accessToken, user: userData } = response.data;
      setToken(accessToken);
      setUser(userData);
      localStorage.setItem('token', accessToken);
      localStorage.setItem('mockmate_token', accessToken);
      return userData;
    } catch (err) {
      console.error('Failed to verify token with MockMate backend:', err);
      const message = err.response?.data?.detail || 'Verification with backend failed';
      setError(message);
      throw new Error(message);
    }
  };

  // Check and sync authentication state on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 1. Get current Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          lastVerifiedSupabaseTokenRef.current = session.access_token;
          try {
            // If we have a Supabase session but no MockMate token, verify it
            const currentToken = localStorage.getItem('token');
            if (!currentToken) {
              await verifySupabaseToken(session.access_token);
            } else {
              // Otherwise, get profile from backend to ensure synchronization
              const response = await api.get('/api/auth/me');
              setUser(response.data);
            }
          } catch (err) {
            console.error('Initial sync failed:', err);
            // Try standard login fallback if it is a local token
            const currentToken = localStorage.getItem('token');
            if (currentToken) {
              try {
                const response = await api.get('/api/auth/me');
                setUser(response.data);
              } catch (fallbackErr) {
                logout();
              }
            }
          }
        } else {
          // Fallback for local user session if Supabase is not active
          const currentToken = localStorage.getItem('token');
          if (currentToken) {
            try {
              const response = await api.get('/api/auth/me');
              setUser(response.data);
            } catch (err) {
              logout();
            }
          }
        }
      } catch (err) {
        console.error('Supabase checkAuth failed, checking local credentials:', err);
        // Fallback for local user session if Supabase fails or is offline
        const currentToken = localStorage.getItem('token');
        if (currentToken) {
          try {
            const response = await api.get('/api/auth/me');
            setUser(response.data);
          } catch (localErr) {
            console.error('Local auth check failed:', localErr);
            logout();
          }
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // 2. Listen for auth state changes
    let subscription = null;
    try {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // Only trigger verification if the token has actually changed or is not set
          if (session.access_token === lastVerifiedSupabaseTokenRef.current) {
            console.log('[Auth] Supabase SIGNED_IN event triggered on focus, but token is already verified. Skipping re-verification.');
            return;
          }

          // Only show the full-screen page loader if this is the first token verification (initial mount or fresh login)
          const shouldShowSpinner = !lastVerifiedSupabaseTokenRef.current;
          if (shouldShowSpinner) {
            setLoading(true);
          }

          try {
            lastVerifiedSupabaseTokenRef.current = session.access_token;
            await verifySupabaseToken(session.access_token);
          } catch (err) {
            console.error('Auth state change verify failed:', err);
          } finally {
            if (shouldShowSpinner) {
              setLoading(false);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          lastVerifiedSupabaseTokenRef.current = null;
          setUser(null);
          setToken(null);
          localStorage.removeItem('token');
          localStorage.removeItem('mockmate_token');
        }
      });
      subscription = data.subscription;
    } catch (err) {
      console.error('Failed to subscribe to auth state changes:', err);
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Email/Password Signup via Supabase
  const signupWithEmail = async (email, password, fullName) => {
    try {
      setError(null);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (signUpError) throw signUpError;
      
      // If user already exists in Supabase, identities array is empty
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        throw new Error('An account with this email already exists. Please log in instead.');
      }

      // If auto-confirm is enabled, we get a session immediately
      if (data.session) {
        const userData = await verifySupabaseToken(data.session.access_token);
        return { isAutoConfirmed: true, user: userData };
      }
      
      return { isAutoConfirmed: false, user: data.user };
    } catch (err) {
      setError(err.message || 'Signup failed');
      throw err;
    }
  };

  // Email/Password Login via Supabase
  const loginWithEmail = async (email, password) => {
    try {
      setError(null);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      if (data.session) {
        const userData = await verifySupabaseToken(data.session.access_token);
        return userData;
      }
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    }
  };

  // Google OAuth Login via Supabase
  const loginWithGoogle = async () => {
    try {
      setError(null);
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Lands on /dashboard (a ProtectedRoute) rather than the bare
          // origin (the marketing landing page): ProtectedRoute shows a
          // loading spinner until the post-redirect session check
          // resolves, so a successful login visibly drops the user into
          // the app instead of leaving them on marketing copy wondering
          // whether anything happened.
          redirectTo: `${window.location.origin}/dashboard`,
        }
      });

      if (googleError) throw googleError;
    } catch (err) {
      setError(err.message || 'Google login failed');
      throw err;
    }
  };

  // Legacy Signup Fallback
  const signup = async (email, firstName, lastName, username, password) => {
    try {
      setError(null);
      const response = await api.post('/api/auth/signup', {
        email,
        firstName,
        lastName,
        username,
        password,
      });

      const { accessToken, user: userData } = response.data;
      setToken(accessToken);
      setUser(userData);
      localStorage.setItem('token', accessToken);
      localStorage.setItem('mockmate_token', accessToken);
      return userData;
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.detail || err.message || 'Signup failed';
      setError(message);
      throw new Error(message);
    }
  };

  // Send OTP Email Verification
  const sendOtp = async (email, purpose = 'SIGNUP') => {
    try {
      setError(null);
      const response = await api.post('/api/auth/send-otp', { email, purpose });
      if (response.data && response.data.success === false) {
        throw new Error(response.data.message || 'Failed to send verification code');
      }
      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.detail || err.message || 'Failed to send verification code';
      setError(message);
      throw new Error(message);
    }
  };

  // Verify OTP Email Code
  const verifyOtp = async (email, otpCode, purpose = 'SIGNUP') => {
    try {
      setError(null);
      const response = await api.post('/api/auth/verify-otp', { email, otpCode, purpose });
      if (response.data && response.data.success === false) {
        throw new Error(response.data.message || 'Invalid verification code');
      }
      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.detail || err.message || 'Invalid or expired verification code';
      setError(message);
      throw new Error(message);
    }
  };

  // Legacy Login Fallback
  const login = async (email, password) => {
    try {
      setError(null);
      const response = await api.post('/api/auth/login', {
        email,
        password,
      });

      const { accessToken, user: userData } = response.data;
      setToken(accessToken);
      setUser(userData);
      localStorage.setItem('token', accessToken);
      localStorage.setItem('mockmate_token', accessToken);
      return userData;
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.detail || err.message || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };

  // Re-fetch the current user from the backend and update context state —
  // previously nothing did this; `user` was only ever set once (on mount or
  // on login/verify), so a mutation like saving Interview Preferences had
  // no way to reach every consumer (Profile, Dashboard, Tech Interview
  // setup) without a full page reload / re-login.
  const refreshUser = async () => {
    try {
      const response = await api.get('/api/auth/me');
      setUser(response.data);
      return response.data;
    } catch (err) {
      console.error('Failed to refresh user:', err);
      throw err;
    }
  };

  // Complete Logout
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Supabase logout error:', err);
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('mockmate_token');
      setError(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        signup,
        login,
        signupWithEmail,
        loginWithEmail,
        loginWithGoogle,
        sendOtp,
        verifyOtp,
        logout,
        refreshUser,
        isAuthenticated: !!user,
        api,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
