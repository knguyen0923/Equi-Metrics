// Thin fetch wrapper around the FastAPI backend. Every other file talks to
// the API through the `api` object at the bottom instead of calling fetch
// directly, so auth headers, error handling, and the base URL only live here.

// Falls back to localhost so `npm run dev` works without a .env file;
// production deployments set VITE_API_URL (see frontend/.env.example).
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "equi_metrics_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// auth: true attaches the JWT (if one exists) as an Authorization header,
// and treats a 401 response as "session expired" — clearing the stored
// token and bouncing to /login instead of leaving the app in a broken state.
async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && auth) {
    clearToken();
    window.location.assign("/login");
    throw new Error("Session expired");
  }

  if (!response.ok) {
    // FastAPI error responses are JSON with a `detail` field; fall back to
    // a generic message if the body isn't JSON (e.g. a 502 from the host).
    let detail = "Something went wrong. Please try again.";
    try {
      const data = await response.json();
      detail = data.detail || detail;
    } catch {
      // response had no JSON body
    }
    throw new Error(detail);
  }

  // 204 No Content responses (reset-password, change-password) have no
  // body to parse.
  if (response.status === 204) return null;
  return response.json();
}

// One method per backend endpoint. Callers (pages/components) import `api`
// and never touch `request`/fetch directly.
export const api = {
  signup: (email, password) => request("/auth/signup", { method: "POST", body: { email, password } }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  me: () => request("/auth/me", { auth: true }),
  forgotPassword: (email) => request("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (token, newPassword) =>
    request("/auth/reset-password", { method: "POST", body: { token, new_password: newPassword } }),
  changePassword: (currentPassword, newPassword) =>
    request("/auth/change-password", {
      method: "POST",
      auth: true,
      body: { current_password: currentPassword, new_password: newPassword },
    }),
  // auth: true here attaches a token if one exists, but the backend allows
  // this call without one too — it just won't be saved to history.
  runSimulation: (payload) => request("/simulations/run", { method: "POST", auth: true, body: payload }),
  getHistory: () => request("/simulations/history", { auth: true }),
  getStats: () => request("/simulations/stats"),
};
