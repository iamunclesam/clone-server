"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, User, Company, ApiError } from "./api";

interface AuthContextType {
  user: User | null;
  companies: Company[];
  activeCompany: Company | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  createCompany: (name: string, companySize?: string, companyType?: string) => Promise<Company>;
  logout: () => Promise<void>;
  switchCompany: (companyId: string) => void;
  refreshState: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessionAndCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Check session
      const sessionRes = await api.getSession().catch(() => null);
      if (sessionRes?.user) {
        setUser(sessionRes.user);

        // 2. Fetch user companies
        const compRes = await api.getCompanies().catch(() => ({ companies: [] }));
        let list: Company[] = compRes.companies || [];

        // If user is authenticated but has no company yet, auto-create a default workspace
        if (list.length === 0) {
          try {
            const createRes = await api.createCompany({
              name: `${sessionRes.user.fullName || "My"}'s Workspace`,
              companySize: "1-10",
              companyType: "AI OS Workspace",
            });
            if (createRes?.company) {
              list = [createRes.company];
            }
          } catch (createErr) {
            console.error("Auto company creation failed:", createErr);
          }
        }

        setCompanies(list);

        if (list.length > 0) {
          const savedId = typeof window !== "undefined" ? localStorage.getItem("clone_active_company") : null;
          const matched = list.find((c) => c.id === savedId) || list[0];
          setActiveCompany(matched);
        } else {
          setActiveCompany(null);
        }
      } else {
        setUser(null);
        setCompanies([]);
        setActiveCompany(null);
      }
    } catch (err: any) {
      console.warn("Auth initialization note:", err?.message);
      setUser(null);
      setCompanies([]);
      setActiveCompany(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessionAndCompanies();
  }, [fetchSessionAndCompanies]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.login({ email, password });
      setUser(res.user);
      await fetchSessionAndCompanies();
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Failed to sign in. Please check credentials.";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, fullName: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.register({ email, password, fullName });
      setUser(res.user);
      await fetchSessionAndCompanies();
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Registration failed. Try a different email.";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createCompany = async (name: string, companySize?: string, companyType?: string): Promise<Company> => {
    setError(null);
    try {
      const res = await api.createCompany({ name, companySize, companyType });
      const newCompany = res.company;
      setCompanies((prev) => [...prev, newCompany]);
      setActiveCompany(newCompany);
      if (typeof window !== "undefined") {
        localStorage.setItem("clone_active_company", newCompany.id);
      }
      return newCompany;
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Failed to create workspace.";
      setError(msg);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network errors on logout
    }
    setUser(null);
    setCompanies([]);
    setActiveCompany(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("clone_active_company");
    }
  };

  const switchCompany = (companyId: string) => {
    const found = companies.find((c) => c.id === companyId);
    if (found) {
      setActiveCompany(found);
      if (typeof window !== "undefined") {
        localStorage.setItem("clone_active_company", companyId);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        companies,
        activeCompany,
        loading,
        error,
        isAuthenticated: !!user,
        login,
        register,
        createCompany,
        logout,
        switchCompany,
        refreshState: fetchSessionAndCompanies,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
