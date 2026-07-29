// Covers the two entry states (with/without a token in the URL, see the
// component's own comment about landing here directly) and the submit
// flow. The backend (api.js) is mocked.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetPassword from "./ResetPassword";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: {
    resetPassword: vi.fn(),
  },
}));

vi.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: null, logout: vi.fn() }),
}));

function renderResetPassword(token = "a-real-token") {
  const entry = token ? `/reset-password?token=${token}` : "/reset-password";
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ResetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a missing-token message and a disabled input when there's no token in the URL", () => {
    renderResetPassword(null);

    expect(screen.getByText("This reset link is missing its token.")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset Password" })).toBeDisabled();
  });

  it("with a real token: prompts for a new password with the input enabled", () => {
    renderResetPassword("real-token-123");

    expect(screen.getByText("Choose a new password for your account.")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeEnabled();
  });

  it("submitting a new password calls the API with the token, then shows confirmation and redirects to login", async () => {
    const user = userEvent.setup();
    api.resetPassword.mockResolvedValue(null);
    renderResetPassword("real-token-123");

    await user.type(screen.getByLabelText("New password"), "brand-new-password");
    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    expect(api.resetPassword).toHaveBeenCalledWith("real-token-123", "brand-new-password");
    expect(await screen.findByText("Password reset. Redirecting to login...")).toBeInTheDocument();

    // The component waits ~1.5s before navigating away (see its own comment).
    await waitFor(() => expect(screen.getByText("Login page")).toBeInTheDocument(), { timeout: 3000 });
  });

  it("shows the API's error message if the reset fails, without redirecting", async () => {
    const user = userEvent.setup();
    api.resetPassword.mockRejectedValue(new Error("Reset link is invalid or has expired"));
    renderResetPassword("stale-token");

    await user.type(screen.getByLabelText("New password"), "brand-new-password");
    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    expect(await screen.findByText("Reset link is invalid or has expired")).toBeInTheDocument();
    expect(screen.queryByText("Password reset. Redirecting to login...")).not.toBeInTheDocument();
  });
});
