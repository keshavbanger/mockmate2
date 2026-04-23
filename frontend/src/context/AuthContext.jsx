import { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Create axios instance with auth header
  const api = axios.create({
    baseURL: API_BASE,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add token to requests if it exists
  api.interceptors.request.use((config) => {
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const response = await api.get('/api/auth/me');
          setUser(response.data);
          setError(null);
        } catch (err) {
          console.error('Auth check failed:', err);
          setToken(null);
          localStorage.removeItem('token');
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const signup = async (email, firstName, lastName, username, password) => {
    try {
      setError(null);
      const response = await api.post('/api/auth/signup', {
        email,
        first_name: firstName,
        last_name: lastName,
        username,
        password,
      });

      const { access_token, user: userData } = response.data;
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
      return userData;
    } catch (err) {
      const message = err.response?.data?.detail || 'Signup failed';
      setError(message);
      throw new Error(message);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await api.post('/api/auth/login', {
        email,
        password,
      });

      const { access_token, user: userData } = response.data;
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
      return userData;
    } catch (err) {
      const message = err.response?.data?.detail || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await api.post('/api/auth/logout');
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
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
        logout,
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
