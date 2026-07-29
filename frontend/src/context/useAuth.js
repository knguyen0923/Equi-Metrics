// Convenience hook so pages/components can do `const { user } = useAuth()`
// instead of importing useContext + AuthContext everywhere.
import { useContext } from "react";
import { AuthContext } from "./authContextBase";

export function useAuth() {
  const ctx = useContext(AuthContext);
  // Fires if a component calls useAuth() outside of <AuthProvider> —
  // catches the mistake immediately instead of returning undefined and
  // failing confusingly later.
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
