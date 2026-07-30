// Account is gated on auth (see the component's own comment) and its only
// real behavior is the change-password form — both are covered here. The
// backend (api.js) and auth context are both mocked.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Account from "./Account";
import { api } from "../lib/api";
import { useAuth } from "../context/useAuth";

vi.mock("../lib/api", () => ({
  api: {
    changePassword: vi.fn(),
    createCheckoutSession: vi.fn(),
    createPortalSession: vi.fn(),
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

  describe("subscription section", () => {
    // jsdom's window.location.href isn't spy-able in place (its property
    // descriptor isn't configurable), so the whole location object is
    // swapped out for a plain stub for the duration of each test here —
    // same pattern as lib/api.test.js's 401-redirect test.
    let originalLocation;

    beforeEach(() => {
      originalLocation = window.location;
      delete window.location;
      window.location = { ...originalLocation, href: "" };
    });

    afterEach(() => {
      window.location = originalLocation;
    });

    it("shows Free plan and an Upgrade button for a free-tier user, and redirects to Checkout", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: { email: "rider@example.com", tier: "free" }, loading: false });
      api.createCheckoutSession.mockResolvedValue({ checkout_url: "https://checkout.stripe.com/abc" });
      renderAccount();

      expect(screen.getByText("Free")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Upgrade" }));

      expect(api.createCheckoutSession).toHaveBeenCalled();
      await waitFor(() => expect(window.location.href).toBe("https://checkout.stripe.com/abc"));
    });

    it("shows Pro plan and a Manage Subscription button for a paid-tier user, and redirects to the Portal", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: { email: "rider@example.com", tier: "paid" }, loading: false });
      api.createPortalSession.mockResolvedValue({ portal_url: "https://billing.stripe.com/abc" });
      renderAccount();

      expect(screen.getByText("Pro")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Manage Subscription" }));

      expect(api.createPortalSession).toHaveBeenCalled();
      await waitFor(() => expect(window.location.href).toBe("https://billing.stripe.com/abc"));
    });

    it("shows the renewal date for a paid-tier user with a current_period_end", () => {
      useAuth.mockReturnValue({
        user: { email: "rider@example.com", tier: "paid", current_period_end: "2026-08-30T00:41:49" },
        loading: false,
      });
      renderAccount();

      expect(screen.getByText("Renews August 30, 2026")).toBeInTheDocument();
    });

    it("does not show a renewal date for a free-tier user", () => {
      useAuth.mockReturnValue({
        user: { email: "rider@example.com", tier: "free", current_period_end: null },
        loading: false,
      });
      renderAccount();

      expect(screen.queryByText(/^Renews/)).not.toBeInTheDocument();
    });

    it("shows an error message if starting checkout fails", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: { email: "rider@example.com", tier: "free" }, loading: false });
      api.createCheckoutSession.mockRejectedValue(new Error("Billing is not configured on this server"));
      renderAccount();

      await user.click(screen.getByRole("button", { name: "Upgrade" }));

      expect(await screen.findByText("Billing is not configured on this server")).toBeInTheDocument();
    });
  });
});
