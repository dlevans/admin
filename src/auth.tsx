import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken, setUnauthorizedHandler, Volunteer } from "./api";

interface AuthState {
  user: Volunteer | null;
  checking: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Volunteer | null>(null);
  const [checking, setChecking] = useState(!!getToken());

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) return;
    // Restore the session from a saved token.
    api
      .me()
      .then((me) => (me.role === "admin" ? setUser(me) : logout()))
      .catch(logout)
      .finally(() => setChecking(false));
  }, [logout]);

  const login = async (email: string, password: string) => {
    const { token, volunteer } = await api.login(email, password);
    if (volunteer.role !== "admin") {
      throw new Error("This account isn't an admin. Ask an existing admin to run make_admin.py for you.");
    }
    setToken(token);
    setUser(volunteer);
  };

  return <AuthContext.Provider value={{ user, checking, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
