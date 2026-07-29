// The React context object itself lives in its own file, separate from
// AuthProvider (AuthContext.jsx) and useAuth (useAuth.js). This is purely
// to satisfy Vite's fast-refresh ESLint rule, which requires component
// files to only export components — splitting it out avoids a full page
// reload on every edit to the provider or hook during development.
import { createContext } from "react";

export const AuthContext = createContext(null);
