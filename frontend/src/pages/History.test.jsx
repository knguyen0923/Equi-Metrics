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

const SAMPLE_HISTORY_TWO_ROWS = [
  ...SAMPLE_HISTORY,
  { id: "sim2", date: "2026-07-28", track: "Redcar", model: "XGBRanker", winner: "Desert Falcon (IRE)" },
];

const SAMPLE_DETAIL_TWO = {
  id: "sim2",
  date: "2026-07-28",
  track: "Redcar",
  model: "XGBRanker",
  results: [
    { rank: 1, horse: "Desert Falcon (IRE)", predictedRank: 1, probability: 20, odds: "1-1", model: "XGBRanker" },
  ],
};

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

  it("shows the most recently clicked row's detail even if an older request resolves later", async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ user: { email: "rider@example.com" }, loading: false });
    api.getHistory.mockResolvedValue(SAMPLE_HISTORY_TWO_ROWS);

    // sim1's request is deliberately left pending so it can resolve *after*
    // sim2's — this only passes if handleRowClick guards against a stale,
    // out-of-order response overwriting the newer selection (see History.jsx).
    let resolveSim1Detail;
    const sim1Detail = new Promise((resolve) => { resolveSim1Detail = resolve; });
    api.getHistoryDetail.mockImplementation((id) => (id === "sim1" ? sim1Detail : Promise.resolve(SAMPLE_DETAIL_TWO)));

    renderHistory();
    await screen.findByText("Leicester");

    await user.click(screen.getByText("Leicester")); // starts the slow sim1 request
    await user.click(screen.getByText("Redcar")); // starts + resolves the sim2 request
    // "Desert Falcon (IRE)" appears twice once its detail is showing: once
    // as the table row's winner cell, once in the expanded breakdown.
    await waitFor(() => expect(screen.getAllByText("Desert Falcon (IRE)")).toHaveLength(2));

    resolveSim1Detail(SAMPLE_DETAIL);
    // Give the now-resolved (but stale) sim1 promise's callbacks a turn to run.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getAllByText("Desert Falcon (IRE)")).toHaveLength(2);
    expect(screen.queryByText("Kasymir (FR)")).not.toBeInTheDocument();
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
