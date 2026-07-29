// Account is gated on auth (see the component's own comment) and its only
// real behavior is the change-password form — both are covered here. The
// backend (api.js) and auth context are both mocked.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Account from "./Account";
import { api } from "../lib/api";
import { useAuth } from "../context/useAuth";

vi.mock("../lib/api", () => ({
  api: {
    changePassword: vi.fn(),
  },
}));

vi.mock("../context/useAuth", () => ({
  useAuth: vi.fn(),
}));

function renderAccount() {
  return render(
    <MemoryRouter initialEntries={["/account"]}>
      <Routes>
        <Route path="/account" element={<Account />} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing while the session is still being restored", () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = renderAccount();
    expect(container).toBeEmptyDOMElement();
  });

  it("redirects to /login once loading finishes and there's no logged-in user", async () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    renderAccount();
    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  it("shows the logged-in user's email", () => {
    useAuth.mockReturnValue({ user: { email: "rider@example.com" }, loading: false });
    const { container } = renderAccount();
    // Scoped to the page heading, not the Navbar — which also shows the
    // logged-in user's email as its account link, so an unscoped query
    // would match twice.
    const heading = within(container.querySelector(".section-heading"));
    expect(heading.getByText("rider@example.com")).toBeInTheDocument();
  });

  it("submitting valid passwords calls changePassword and shows a success message", async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ user: { email: "rider@example.com" }, loading: false });
    api.changePassword.mockResolvedValue(null);
    renderAccount();

    await user.type(screen.getByLabelText("Current password"), "old-password-123");
    await user.type(screen.getByLabelText("New password"), "brand-new-password");
    await user.click(screen.getByRole("button", { name: "Change Password" }));

    expect(api.changePassword).toHaveBeenCalledWith("old-password-123", "brand-new-password");
    expect(await screen.findByText("Password updated.")).toBeInTheDocument();
    // Fields are cleared after a successful change (see handleSubmit).
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
  });

  it("shows the API's error message if the current password is wrong", async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ user: { email: "rider@example.com" }, loading: false });
    api.changePassword.mockRejectedValue(new Error("Current password is incorrect"));
    renderAccount();

    await user.type(screen.getByLabelText("Current password"), "wrong-password");
    await user.type(screen.getByLabelText("New password"), "brand-new-password");
    await user.click(screen.getByRole("button", { name: "Change Password" }));

    expect(await screen.findByText("Current password is incorrect")).toBeInTheDocument();
    expect(screen.queryByText("Password updated.")).not.toBeInTheDocument();
  });
});
