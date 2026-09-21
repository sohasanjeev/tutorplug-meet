import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types.js';
import { api } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  loginWithGoogle: (email: string, name?: string, googleId?: string, avatar?: string) => Promise<User>;
  guestLogin: (displayName: string) => Promise<User>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('tutorplug_token') || localStorage.getItem('aurameet_token'));
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    if (token) {
      try {
        const res = await api.getMe(token);
        if (res?.user) {
          setUser(res.user);
        }
      } catch {}
    }
  };

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const res = await api.getMe(token);
          if (res?.user) {
            setUser(res.user);
          } else {
            localStorage.removeItem('tutorplug_token');
            setToken(null);
          }
        } catch {
          localStorage.removeItem('tutorplug_token');
          setToken(null);
        }
      }
      setIsLoading(false);
    }
    loadUser();
  }, [token]);

  const login = async (email: string, pass: string) => {
    const data = await api.login(email, pass);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('tutorplug_token', data.token);
  };

  const register = async (name: string, email: string, pass: string) => {
    const data = await api.register(name, email, pass);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('tutorplug_token', data.token);
  };

  const loginWithGoogle = async (email: string, name?: string, googleId?: string, avatar?: string): Promise<User> => {
    const data = await api.loginWithGoogle(email, name, googleId, avatar);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('tutorplug_token', data.token);
    return data.user;
  };

  const guestLogin = async (displayName: string): Promise<User> => {
    const data = await api.guestLogin(displayName);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('tutorplug_token', data.token);
    return data.user;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('tutorplug_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        loginWithGoogle,
        guestLogin,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
