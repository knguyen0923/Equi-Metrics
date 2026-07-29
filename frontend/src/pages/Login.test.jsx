// Covers all three modes this one page renders: login, signup, and
// forgot-password (see the component's own comment for why they're one
// page instead of three). The backend (api.js) and auth context are both
// mocked so this only exercises Login's own state/wiring.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "./Login";
import { api } from "../lib/api";
import { useAuth } from "../context/useAuth";

vi.mock("../lib/api", () => ({
  api: {
    forgotPassword: vi.fn(),
  },
}));

vi.mock("../context/useAuth", () => ({
  useAuth: vi.fn(),
}));

function renderLogin() {
  // A real two-route tree (not just <Login /> alone) so a successful
  // login/signup's navigate("/") is actually observable.
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<p>Home page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Login", () => {
  let login;
  let signup;

  beforeEach(() => {
    vi.clearAllMocks();
    login = vi.fn().mockResolvedValue(undefined);
    signup = vi.fn().mockResolvedValue(undefined);
    useAuth.mockReturnValue({ login, signup });
  });

  it("defaults to login mode", () => {
    renderLogin();
    expect(screen.getByRole("heading", { name: "Welcome Back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("submitting valid credentials logs in and navigates home", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Email address"), "rider@example.com");
    await user.type(screen.getByLabelText("Password"), "correcthorse123");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(login).toHaveBeenCalledWith("rider@example.com", "correcthorse123");
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it("shows the API's error message if login fails, without navigating away", async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new Error("Invalid email or password"));
    renderLogin();

    await user.type(screen.getByLabelText("Email address"), "rider@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welcome Back" })).toBeInTheDocument();
  });

  it("switching to signup mode and submitting calls signup, not login", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByText("Need an account? Sign up"));
    expect(screen.getByRole("heading", { name: "Create Account" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Email address"), "newrider@example.com");
    await user.type(screen.getByLabelText("Password"), "brandnewpass123");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(signup).toHaveBeenCalledWith("newrider@example.com", "brandnewpass123");
    expect(login).not.toHaveBeenCalled();
  });

  it("switching back from signup to login toggles the heading back", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByText("Need an account? Sign up"));
    await user.click(screen.getByText("Already have an account? Log in"));

    expect(screen.getByRole("heading", { name: "Welcome Back" })).toBeInTheDocument();
  });

  it("forgot-password mode only asks for an email and calls api.forgotPassword, not login", async () => {
    const user = userEvent.setup();
    api.forgotPassword.mockResolvedValue({ detail: "sent" });
    renderLogin();

    await user.click(screen.getByText("Forgot password?"));
    expect(screen.getByRole("heading", { name: "Reset Password" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Email address"), "rider@example.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    expect(api.forgotPassword).toHaveBeenCalledWith("rider@example.com");
    expect(login).not.toHaveBeenCalled();
    expect(
      await screen.findByText("If that email is registered, a reset link has been sent.")
    ).toBeInTheDocument();
  });

  it("'Back to Login' from forgot-password mode returns to the login form", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByText("Forgot password?"));
    await user.click(screen.getByText("Back to Login"));

    expect(screen.getByRole("heading", { name: "Welcome Back" })).toBeInTheDocument();
  });
});
