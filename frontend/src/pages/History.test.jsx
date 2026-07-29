// History has three states worth covering: logged out (prompt to log in),
// logged in with no runs yet (empty state), and logged in with runs
// (clickable rows that expand into the full per-horse breakdown). The
// backend (api.js) and auth context are both mocked so this test only
// exercises History's own rendering/interaction logic.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import History from "./History";
import { api } from "../lib/api";
import { useAuth } from "../context/useAuth";

vi.mock("../lib/api", () => ({
  api: {
    getHistory: vi.fn(),
    getHistoryDetail: vi.fn(),
  },
}));

vi.mock("../context/useAuth", () => ({
  useAuth: vi.fn(),
}));

const SAMPLE_HISTORY = [
  { id: "sim1", date: "2026-07-29", track: "Leicester", model: "XGBRanker", winner: "Coton Star (FR)" },
];

const SAMPLE_DETAIL = {
  id: "sim1",
  date: "2026-07-29",
  track: "Leicester",
  model: "XGBRanker",
  results: [
    { rank: 1, horse: "Coton Star (FR)", predictedRank: 1, probability: 18, odds: "3-2", model: "XGBRanker" },
    { rank: 2, horse: "Kasymir (FR)", predictedRank: 2, probability: 16, odds: "1-1", model: "XGBRanker" },
    { rank: 3, horse: "Invincible Guard (FR)", predictedRank: 3, probability: 16, odds: "3-2", model: "XGBRanker" },
  ],
};

function renderHistory() {
  return render(
    <MemoryRouter>
      <History />
    </MemoryRouter>
  );
}

describe("History", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prompts a logged-out user to log in, without ever calling getHistory", () => {
    useAuth.mockReturnValue({ user: null, loading: false });

    renderHistory();

    expect(screen.getByText("Log in to view your simulation history.")).toBeInTheDocument();
    expect(api.getHistory).not.toHaveBeenCalled();
  });

  it("shows an empty state when a logged-in user has no simulations yet", async () => {
    useAuth.mockReturnValue({ user: { email: "rider@example.com" }, loading: false });
    api.getHistory.mockResolvedValue([]);

    renderHistory();

    expect(await screen.findByText(/No simulations yet/)).toBeInTheDocument();
  });

  it("renders one row per past simulation", async () => {
    useAuth.mockReturnValue({ user: { email: "rider@example.com" }, loading: false });
    api.getHistory.mockResolvedValue(SAMPLE_HISTORY);

    renderHistory();

    expect(await screen.findByText("Leicester")).toBeInTheDocument();
    expect(screen.getByText("Coton Star (FR)")).toBeInTheDocument();
  });

  it("clicking a row fetches and shows the full per-horse breakdown", async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ user: { email: "rider@example.com" }, loading: false });
    api.getHistory.mockResolvedValue(SAMPLE_HISTORY);
    api.getHistoryDetail.mockResolvedValue(SAMPLE_DETAIL);

    renderHistory();
    await screen.findByText("Leicester");

    await user.click(screen.getByText("Leicester"));

    expect(api.getHistoryDetail).toHaveBeenCalledWith("sim1");
    // All three ranked horses from the detail response should now be on
    // the page, not just the single "winner" the table row already showed.
    expect(await screen.findByText("Kasymir (FR)")).toBeInTheDocument();
    expect(screen.getByText("Invincible Guard (FR)")).toBeInTheDocument();
  });

  it("clicking an already-open row collapses it again without re-fetching", async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ user: { email: "rider@example.com" }, loading: false });
    api.getHistory.mockResolvedValue(SAMPLE_HISTORY);
    api.getHistoryDetail.mockResolvedValue(SAMPLE_DETAIL);

    renderHistory();
    await screen.findByText("Leicester");

    await user.click(screen.getByText("Leicester"));
    await screen.findByText("Kasymir (FR)");

    await user.click(screen.getByText("Leicester"));

    await waitFor(() => expect(screen.queryByText("Kasymir (FR)")).not.toBeInTheDocument());
    expect(api.getHistoryDetail).toHaveBeenCalledTimes(1);
  });

  it("shows an error message if the detail request fails", async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ user: { email: "rider@example.com" }, loading: false });
    api.getHistory.mockResolvedValue(SAMPLE_HISTORY);
    api.getHistoryDetail.mockRejectedValue(new Error("Simulation not found"));

    renderHistory();
    await screen.findByText("Leicester");
    await user.click(screen.getByText("Leicester"));

    expect(await screen.findByText("Simulation not found")).toBeInTheDocument();
  });
});
