// Error boundaries only catch errors thrown during render, so this
// deliberately renders a component that throws — React logs that to
// console.error twice on its own (dev-mode double-invoke), on top of the
// boundary's own componentDidCatch log, so console.error is silenced for
// the duration of the throwing render rather than asserted on.
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary";

vi.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: null, logout: vi.fn() }),
}));

function Bomb() {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("renders children normally when nothing throws", () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <p>All good</p>
        </ErrorBoundary>
      </MemoryRouter>
    );

    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("shows a fallback instead of crashing the whole page when a child throws", () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>
      </MemoryRouter>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to Home" })).toBeInTheDocument();
    // Navbar (which needs both router and auth context) still renders in
    // the fallback rather than the boundary itself crashing.
    expect(screen.getByText("Equi-Metrics")).toBeInTheDocument();
  });
});
