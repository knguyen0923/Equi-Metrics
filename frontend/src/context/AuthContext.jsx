// Wraps the whole app (see App.jsx) and is the single source of truth for
// "who's logged in" — every page that needs auth state reads it via
// useAuth() instead of touching localStorage/the API directly.
import { useCallback, useEffect, useState } from "react";
import { api, clearToken, getToken, setToken } from "../lib/api";
import { AuthContext } from "./authContextBase";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Starts "loading" only if there's a token to validate — if there's no
  // token at all, there's nothing to wait for, so the app doesn't need to
  // show a loading state before rendering as logged-out.
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  // On first mount, if a token was saved from a previous session, verify it
  // still works and fetch the user it belongs to (restores login across
  // page refreshes). If the token's stale/invalid, api.me() rejects and the
  // stale token is cleared.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api
      .me()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    setToken(data.access_token);
    setUser(data.user);
  }, []);

  const signup = useCallback(async (email, password) => {
    const data = await api.signup(email, password);
    setToken(data.access_token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
