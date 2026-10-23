
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const saveUser = useCallback((userData) => {
    setUser(userData);

    if (userData?.role) {
      localStorage.setItem("role", userData.role);
    } else {
      localStorage.removeItem("role");
    }
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("role");
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      clearSession();
      setLoading(false);
      return;
    }

    try {
      const response = await api.get("/auth/me");
      saveUser(response.data);
    } catch (error) {
      console.error("Unable to restore login session:", error);
      clearSession();
    } finally {
      setLoading(false);
    }
  }, [clearSession, saveUser]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  async function login(email, password) {
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const response = await api.post("/auth/login", formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const token = response.data.access_token;

    if (!token) {
      throw new Error(
        "Login succeeded but no access token was returned."
      );
    }

    localStorage.setItem("access_token", token);

    try {
      const profile = await api.get("/auth/me");
      saveUser(profile.data);
      return profile.data;
    } catch (error) {
      clearSession();
      throw error;
    }
  }

  async function register(username, email, password) {
    await api.post("/auth/register", {
      username,
      email,
      password,
    });

    return login(email, password);
  }

  function logout() {
    clearSession();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
