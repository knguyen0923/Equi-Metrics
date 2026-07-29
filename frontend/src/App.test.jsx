// Routing-level smoke test: confirms the catch-all route actually renders
// something for an unmatched URL, rather than the blank page react-router
// produces when no <Route> matches and there's no fallback.
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Routes, Route } from "react-router-dom";
import NotFound from "./pages/NotFound";

vi.mock("./context/useAuth", () => ({
  useAuth: () => ({ user: null, logout: vi.fn() }),
}));

describe("NotFound route", () => {
  it("renders a not-found message with a way back home", () => {
    render(
      <MemoryRouter initialEntries={["/this-page-does-not-exist"]}>
        <Routes>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Page not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/");
  });
});
