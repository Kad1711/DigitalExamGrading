import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => {
    return sessionStorage.getItem("accessToken") || null;
  });

  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  // Dong bo ho so nguoi dung tu API /auth/me khi mo app co san token
  useEffect(() => {
    let isMounted = true;

    async function verifyMe() {
      const token = sessionStorage.getItem("accessToken");
      if (!token) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const res = await api.get("/auth/me");
        if (isMounted && res.data?.data) {
          const freshUser = res.data.data;
          setUser(freshUser);
          sessionStorage.setItem("user", JSON.stringify(freshUser));
        }
      } catch (err) {
        console.warn("Could not verify session with /auth/me:", err);
        // Neu token khong hop le hoac tai khoan bi khoa, interceptor se xu ly hoac xoa storage
        if (err.response?.status === 401 || err.response?.status === 403) {
          sessionStorage.removeItem("accessToken");
          sessionStorage.removeItem("user");
          if (isMounted) {
            setUser(null);
            setAccessToken(null);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    verifyMe();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    const { user: loggedInUser, accessToken: newAccessToken } = res.data.data;

    sessionStorage.setItem("accessToken", newAccessToken);
    sessionStorage.setItem("user", JSON.stringify(loggedInUser));

    setAccessToken(newAccessToken);
    setUser(loggedInUser);

    return loggedInUser;
  };

  const logout = () => {
    const token = sessionStorage.getItem("accessToken");
    if (token) {
      api.post("/auth/logout").catch(() => {});
    }
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("user");
    setAccessToken(null);
    setUser(null);
  };

  const refreshMe = async () => {
    try {
      const res = await api.get("/auth/me");
      if (res.data?.data) {
        const freshUser = res.data.data;
        setUser(freshUser);
        sessionStorage.setItem("user", JSON.stringify(freshUser));
        return freshUser;
      }
    } catch (err) {
      console.error("Failed to refresh user:", err);
    }
    return null;
  };

  const updateUser = (partial) => {
    setUser((prev) => {
      const updated = { ...prev, ...partial };
      sessionStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
  };

  const value = {
    accessToken,
    user,
    loading,
    isAuthenticated: Boolean(accessToken && user),
    login,
    logout,
    refreshMe,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export default AuthContext;
