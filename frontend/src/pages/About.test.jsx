// About is static marketing copy with no data fetching or state (see the
// component's own comment) — just a render smoke test that the key content
// is actually there.
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import About from "./About";

vi.mock("../context/useAuth", () => ({
  useAuth: () => ({ user: null, logout: vi.fn() }),
}));

describe("About", () => {
  it("renders the page heading and model list", () => {
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "About Equi-Metrics" })).toBeInTheDocument();
    expect(screen.getByText("XGBoost Ranker", { exact: false })).toBeInTheDocument();
  });
});
