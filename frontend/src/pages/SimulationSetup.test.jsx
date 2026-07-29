// Covers both simulation modes this page offers: searching a real
// historical race, and assembling a custom one from real horses (see the
// component's own comments for why arbitrary/hypothetical races aren't
// supported any other way). The backend (api.js) and auth context are
// both mocked so this only exercises SimulationSetup's own state/wiring —
// the actual model inference is covered separately in the backend's
// tests/test_registry.py and tests/test_simulations_router.py.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SimulationSetup from "./SimulationSetup";
import { api } from "../lib/api";
import { useAuth } from "../context/useAuth";

vi.mock("../lib/api", () => ({
  api: {
    getStats: vi.fn(),
    getRaceCount: vi.fn(),
    getRaceContextOptions: vi.fn(),
    getRaces: vi.fn(),
    runSimulation: vi.fn(),
    searchHorses: vi.fn(),
    runCustomSimulation: vi.fn(),
  },
}));

vi.mock("../context/useAuth", () => ({
  useAuth: vi.fn(),
}));

const RACE_OPTIONS = [
  { raceKey: "rac_1_2026-05-26", course: "Redcar", date: "2026-05-26" },
  { raceKey: "rac_2_2026-05-25", course: "Leicester", date: "2026-05-25" },
];

const CONTEXT_OPTIONS = {
  courses: ["Ascot", "Redcar"],
  goings: ["Good", "Firm"],
  classes: ["Class 1", "Class 2"],
  regions: ["GB", "FR"],
  surfaces: ["Turf", "Dirt"],
  distanceCategories: ["Mile", "Sprint"],
};

const HORSE_OPTIONS = [
  { profileId: 1, horse: "Zephyr (AUS)", lastCourse: "Ayr", lastDate: "2026-05-01", jockey: "A. Rider" },
  { profileId: 2, horse: "Desert Falcon (IRE)", lastCourse: "Bath", lastDate: "2026-05-02", jockey: "B. Rider" },
  { profileId: 3, horse: "Bailly's Comet (GB)", lastCourse: "Ayr", lastDate: "2026-05-03", jockey: "C. Rider" },
];

const RUN_RESPONSE = {
  id: null,
  date: "2026-07-29",
  saved: false,
  isPlaceholder: false,
  results: [
    { rank: 1, horse: "Coton Star (FR)", predictedRank: 1, probability: 18, odds: "3-2", model: "XGBRanker" },
    { rank: 2, horse: "Kasymir (FR)", predictedRank: 2, probability: 16, odds: "1-1", model: "XGBRanker" },
    { rank: 3, horse: "Invincible Guard (FR)", predictedRank: 3, probability: 16, odds: "3-2", model: "XGBRanker" },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <SimulationSetup />
    </MemoryRouter>
  );
}

describe("SimulationSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: null });
    // A realistic (non-empty) shape, matching what /simulations/stats
    // actually returns in production — AdvancedStats' "best NDCG@10"
    // lookup assumes at least one row.
    api.getStats.mockResolvedValue([
      { model: "XGBRanker", top1: "60.89%", ndcg3: "81.96%", ndcg5: "83.05%", ndcg10: "84.75%" },
    ]);
    api.getRaceCount.mockResolvedValue({ total: 1770 });
    api.getRaceContextOptions.mockResolvedValue(CONTEXT_OPTIONS);
    api.getRaces.mockResolvedValue(RACE_OPTIONS);
    api.searchHorses.mockResolvedValue(HORSE_OPTIONS);
  });

  describe("real race mode", () => {
    // Search results only appear once the user has actually typed
    // something (see useDebouncedSearch's `enabled` condition in
    // SimulationSetup) — there's no default "recent races" list shown on
    // an empty search, so every test that needs a selected race types a
    // term first.
    async function selectRedcar(user) {
      await user.type(screen.getByPlaceholderText("Search race by course..."), "red");
      await user.click(await screen.findByText("Redcar"));
    }

    it("does not call getRaces or show a default race list before the user types anything", async () => {
      renderPage();

      await waitFor(() => expect(api.getRaceCount).toHaveBeenCalled());
      expect(api.getRaces).not.toHaveBeenCalled();
      expect(screen.queryByText("Redcar")).not.toBeInTheDocument();
    });

    it("shows search results, then selecting one enables Run Simulation", async () => {
      const user = userEvent.setup();
      renderPage();

      await selectRedcar(user);

      // Selecting a race collapses the search box into a read-only chip
      // showing the course + date, per the component's handleSelectRace.
      expect(screen.getByRole("button", { name: "Run Simulation" })).toBeEnabled();
      expect(screen.queryByPlaceholderText("Search race by course...")).not.toBeInTheDocument();
    });

    it("'Change' clears the selected race and brings back the search box", async () => {
      const user = userEvent.setup();
      renderPage();

      await selectRedcar(user);
      await user.click(screen.getByRole("button", { name: "Change race" }));

      expect(screen.getByPlaceholderText("Search race by course...")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Run Simulation" })).toBeDisabled();
    });

    it("typing a search term calls getRaces with that term", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByPlaceholderText("Search race by course..."), "leicester");

      await waitFor(() => expect(api.getRaces).toHaveBeenCalledWith("leicester"));
    });

    it("running a simulation calls runSimulation with the selected race_key and shows real results", async () => {
      const user = userEvent.setup();
      api.runSimulation.mockResolvedValue(RUN_RESPONSE);
      renderPage();

      await selectRedcar(user);
      await user.click(screen.getByRole("button", { name: "Run Simulation" }));

      expect(api.runSimulation).toHaveBeenCalledWith({ race_key: "rac_1_2026-05-26" });
      expect(await screen.findByText("Coton Star (FR)")).toBeInTheDocument();
    });

    it("shows the API's error message if the run fails", async () => {
      const user = userEvent.setup();
      api.runSimulation.mockRejectedValue(new Error("Unknown race_key"));
      renderPage();

      await selectRedcar(user);
      await user.click(screen.getByRole("button", { name: "Run Simulation" }));

      expect(await screen.findByText("Unknown race_key")).toBeInTheDocument();
    });

    it("prompts an anonymous user to log in to save their result, after a successful run", async () => {
      const user = userEvent.setup();
      api.runSimulation.mockResolvedValue(RUN_RESPONSE);
      renderPage();

      await selectRedcar(user);
      await user.click(screen.getByRole("button", { name: "Run Simulation" }));

      expect(await screen.findByText("Log in to save this result to your history.")).toBeInTheDocument();
    });

    it("does not show the login prompt for a logged-in user", async () => {
      const user = userEvent.setup();
      useAuth.mockReturnValue({ user: { email: "rider@example.com" } });
      api.runSimulation.mockResolvedValue({ ...RUN_RESPONSE, saved: true, id: "sim1" });
      renderPage();

      await selectRedcar(user);
      await user.click(screen.getByRole("button", { name: "Run Simulation" }));

      await screen.findByText("Coton Star (FR)");
      expect(screen.queryByText("Log in to save this result to your history.")).not.toBeInTheDocument();
    });
  });

  describe("custom race mode", () => {
    async function switchToCustomMode(user) {
      await user.click(screen.getByRole("button", { name: "Custom Race" }));
      await screen.findByText("Course"); // context selects have loaded
    }

    // Fills in all 6 race-context selects with one valid combination —
    // shared by every test that needs a *complete* context before it can
    // exercise horse-selection or the Run button.
    async function fillCompleteContext(user) {
      await user.selectOptions(screen.getByDisplayValue("Course"), "Ascot");
      await user.selectOptions(screen.getByDisplayValue("Going"), "Good");
      await user.selectOptions(screen.getByDisplayValue("Class"), "Class 1");
      await user.selectOptions(screen.getByDisplayValue("Region"), "GB");
      await user.selectOptions(screen.getByDisplayValue("Surface"), "Turf");
      await user.selectOptions(screen.getByDisplayValue("Distance"), "Mile");
    }

    it("keeps Run Simulation disabled until the race context is complete and 3 horses are added", async () => {
      const user = userEvent.setup();
      renderPage();
      await switchToCustomMode(user);

      const runButton = screen.getByRole("button", { name: "Run Simulation" });
      expect(runButton).toBeDisabled();

      await fillCompleteContext(user);

      // Context alone isn't enough — still needs 3 horses.
      expect(runButton).toBeDisabled();

      const horseInput = screen.getByPlaceholderText("Search horses by name to add to the field...");
      await user.type(horseInput, "z");
      await user.click(await screen.findByText("Zephyr (AUS)"));
      expect(runButton).toBeDisabled(); // only 1 horse so far

      await user.type(horseInput, "d");
      await user.click(await screen.findByText("Desert Falcon (IRE)"));
      await user.type(horseInput, "b");
      await user.click(await screen.findByText("Bailly's Comet (GB)"));

      expect(runButton).toBeEnabled();
    });

    it("adding the same horse twice is a no-op, not a duplicate entry", async () => {
      const user = userEvent.setup();
      renderPage();
      await switchToCustomMode(user);

      const horseInput = screen.getByPlaceholderText("Search horses by name to add to the field...");
      // Anchored at the start: the dropdown option's accessible name
      // *starts with* the horse name ("Zephyr (AUS)last: Ayr — ..."), while
      // the chip's "Remove Zephyr (AUS)" button — which also exists once
      // the horse is selected — starts with "Remove" instead, so this
      // can't accidentally match and click the wrong button.
      const dropdownOptionFor = (name) => screen.findByRole("button", { name: new RegExp(`^${name}`) });

      await user.type(horseInput, "zephyr");
      await user.click(await dropdownOptionFor("Zephyr \\(AUS\\)"));

      await user.type(horseInput, "zephyr");
      // handleAddHorse silently returns for an already-selected profileId
      // (see SimulationSetup.jsx) — clicking it again shouldn't add a
      // second entry to the selected list. (The dropdown itself stays
      // open showing the horse as a no-op-eligible option — that's fine;
      // what matters is the *selected* list, identified by its one Remove
      // button per horse, doesn't grow a second entry.)
      await user.click(await dropdownOptionFor("Zephyr \\(AUS\\)"));

      expect(screen.getAllByRole("button", { name: /^Remove Zephyr/ })).toHaveLength(1);
    });

    it("removing a selected horse takes it back out of the field", async () => {
      const user = userEvent.setup();
      renderPage();
      await switchToCustomMode(user);

      const horseInput = screen.getByPlaceholderText("Search horses by name to add to the field...");
      await user.type(horseInput, "zephyr");
      await user.click(await screen.findByText("Zephyr (AUS)"));

      await user.click(screen.getByRole("button", { name: "Remove Zephyr (AUS)" }));

      expect(screen.queryByText("Zephyr (AUS)")).not.toBeInTheDocument();
    });

    it("running a custom simulation sends the context and profile ids, and shows real results", async () => {
      const user = userEvent.setup();
      api.runCustomSimulation.mockResolvedValue(RUN_RESPONSE);
      renderPage();
      await switchToCustomMode(user);
      await fillCompleteContext(user);

      const horseInput = screen.getByPlaceholderText("Search horses by name to add to the field...");
      for (const name of ["Zephyr (AUS)", "Desert Falcon (IRE)", "Bailly's Comet (GB)"]) {
        await user.type(horseInput, name.slice(0, 3));
        await user.click(await screen.findByText(name));
      }

      await user.click(screen.getByRole("button", { name: "Run Simulation" }));

      expect(api.runCustomSimulation).toHaveBeenCalledWith({
        course: "Ascot",
        going: "Good",
        race_class: "Class 1",
        region: "GB",
        surface: "Turf",
        distance_category: "Mile",
        profile_ids: [1, 2, 3],
      });
      expect(await screen.findByText("Coton Star (FR)")).toBeInTheDocument();
    });

    it("switching back to Real Race mode clears any previous results", async () => {
      const user = userEvent.setup();
      api.runSimulation.mockResolvedValue(RUN_RESPONSE);
      renderPage();

      await user.type(screen.getByPlaceholderText("Search race by course..."), "red");
      await user.click(await screen.findByText("Redcar"));
      await user.click(screen.getByRole("button", { name: "Run Simulation" }));
      await screen.findByText("Coton Star (FR)");

      await switchToCustomMode(user);
      expect(screen.queryByText("Coton Star (FR)")).not.toBeInTheDocument();
    });
  });
});
