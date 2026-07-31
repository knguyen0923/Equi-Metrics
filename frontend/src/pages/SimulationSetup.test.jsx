// Covers assembling a custom race from real horses (see the component's own
// comments for why arbitrary/hypothetical races aren't supported any other
// way). The backend (api.js) and auth context are both mocked so this only
// exercises SimulationSetup's own state/wiring — the actual model inference
// is covered separately in the backend's tests/test_registry.py and
// tests/test_simulations_router.py.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SimulationSetup from "./SimulationSetup";
import { api } from "../lib/api";
import { useAuth } from "../context/useAuth";

vi.mock("../lib/api", () => ({
  api: {
    getStats: vi.fn(),
    getRaceContextOptions: vi.fn(),
    searchHorses: vi.fn(),
    populateHorses: vi.fn(),
    runCustomSimulation: vi.fn(),
  },
}));

vi.mock("../context/useAuth", () => ({
  useAuth: vi.fn(),
}));

const CONTEXT_OPTIONS = {
  courses: ["Ascot", "Redcar", "Compiegne"],
  goings: ["Good", "Firm"],
  classes: ["Class 1", "Class 2"],
  regions: ["GB", "FR"],
  surfaces: ["Turf", "Dirt"],
  distanceCategories: ["Mile", "Sprint"],
  courseRegions: { Ascot: "GB", Redcar: "GB", Compiegne: "FR" },
};

const HORSE_OPTIONS = [
  { profileId: 1, horse: "Zephyr (AUS)", lastCourse: "Ayr", lastDate: "2026-05-01", jockey: "A. Rider" },
  { profileId: 2, horse: "Desert Falcon (IRE)", lastCourse: "Bath", lastDate: "2026-05-02", jockey: "B. Rider" },
  { profileId: 3, horse: "Bailly's Comet (GB)", lastCourse: "Ayr", lastDate: "2026-05-03", jockey: "C. Rider" },
  { profileId: 4, horse: "Silver Arrow (GB)", lastCourse: "Redcar", lastDate: "2026-05-04", jockey: "D. Rider" },
  { profileId: 5, horse: "Midnight Runner (IRE)", lastCourse: "Bath", lastDate: "2026-05-05", jockey: "E. Rider" },
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

// Fills in all 6 race-context selects with one valid combination — shared
// by every test that needs a *complete* context before it can exercise
// horse-selection or the Run button. Region isn't selected manually: it's
// auto-filled from Course (see SimulationSetup.jsx's handleContextChange).
async function fillCompleteContext(user) {
  await user.selectOptions(screen.getByDisplayValue("Course"), "Ascot");
  await user.selectOptions(screen.getByDisplayValue("Going"), "Good");
  await user.selectOptions(screen.getByDisplayValue("Class"), "Class 1");
  await user.selectOptions(screen.getByDisplayValue("Surface"), "Turf");
  await user.selectOptions(screen.getByDisplayValue("Distance"), "Mile");
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
    api.getRaceContextOptions.mockResolvedValue(CONTEXT_OPTIONS);
    api.searchHorses.mockResolvedValue(HORSE_OPTIONS);
  });

  it("selecting a course auto-fills the region field", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Course"); // context selects have loaded

    await user.selectOptions(screen.getByDisplayValue("Course"), "Ascot");

    expect(screen.getByDisplayValue("GB")).toBeInTheDocument();
  });

  it("selecting a region first narrows the course dropdown to that region's courses", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Course");

    await user.selectOptions(screen.getByDisplayValue("Region"), "FR");

    const courseSelect = screen.getByDisplayValue("Course");
    const optionLabels = within(courseSelect)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(optionLabels).toEqual(["Course", "Compiegne"]);
  });

  it("picking a different region clears an already-selected course that no longer belongs to it", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Course");

    await user.selectOptions(screen.getByDisplayValue("Course"), "Ascot");
    expect(screen.getByDisplayValue("GB")).toBeInTheDocument();

    await user.selectOptions(screen.getByDisplayValue("GB"), "FR");

    // Ascot (GB) is no longer valid once the region filter is FR.
    expect(screen.getByDisplayValue("Course")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Ascot")).not.toBeInTheDocument();
  });

  it("does not search or show a horse dropdown before the user types anything", async () => {
    renderPage();
    await screen.findByText("Course");

    // Give the debounce (300ms) plenty of time to have fired if it were
    // going to — it must not, since the search box is still empty.
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(api.searchHorses).not.toHaveBeenCalled();
    expect(screen.queryByText("Zephyr (AUS)")).not.toBeInTheDocument();
  });

  it("keeps Run Simulation disabled until the race context is complete and 5 horses are added", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Course");

    const runButton = screen.getByRole("button", { name: "Run Simulation" });
    expect(runButton).toBeDisabled();

    await fillCompleteContext(user);

    // Context alone isn't enough — still needs 5 horses.
    expect(runButton).toBeDisabled();

    const horseInput = screen.getByPlaceholderText("Search horses by name to add to the field...");
    await user.type(horseInput, "z");
    await user.click(await screen.findByText("Zephyr (AUS)"));
    expect(runButton).toBeDisabled(); // only 1 horse so far

    for (const name of ["Desert Falcon (IRE)", "Bailly's Comet (GB)", "Silver Arrow (GB)"]) {
      await user.type(horseInput, name.slice(0, 3));
      await user.click(await screen.findByText(name));
    }
    expect(runButton).toBeDisabled(); // 4 horses — still one short

    await user.type(horseInput, "mid");
    await user.click(await screen.findByText("Midnight Runner (IRE)"));

    expect(runButton).toBeEnabled();
  });

  it("closes the horse dropdown when focus leaves it, without requiring a horse to be selected", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Course");

    const horseInput = screen.getByPlaceholderText("Search horses by name to add to the field...");
    await user.type(horseInput, "zephyr");
    await screen.findByRole("button", { name: /^Zephyr/ });

    // Clicking something else on the page (not the input, not a dropdown
    // item) moves focus away from the whole search group.
    await user.click(screen.getByText("Race Simulation Setup"));

    expect(screen.queryByRole("button", { name: /^Zephyr/ })).not.toBeInTheDocument();
  });

  it("does not show the dropdown again just because results already exist, until the input is refocused", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Course");

    const horseInput = screen.getByPlaceholderText("Search horses by name to add to the field...");
    await user.type(horseInput, "zephyr");
    await screen.findByRole("button", { name: /^Zephyr/ });
    await user.click(screen.getByText("Race Simulation Setup"));
    expect(screen.queryByRole("button", { name: /^Zephyr/ })).not.toBeInTheDocument();

    // Refocusing (without retyping) reopens it — the results weren't
    // cleared, just hidden.
    await user.click(horseInput);
    expect(await screen.findByRole("button", { name: /^Zephyr/ })).toBeInTheDocument();
  });

  it("adding the same horse twice is a no-op, not a duplicate entry", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Course");

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
    await screen.findByText("Course");

    const horseInput = screen.getByPlaceholderText("Search horses by name to add to the field...");
    await user.type(horseInput, "zephyr");
    await user.click(await screen.findByText("Zephyr (AUS)"));

    await user.click(screen.getByRole("button", { name: "Remove Zephyr (AUS)" }));

    expect(screen.queryByText("Zephyr (AUS)")).not.toBeInTheDocument();
  });

  it("running a custom simulation sends the context (with auto-filled region) and profile ids, and shows real results", async () => {
    const user = userEvent.setup();
    api.runCustomSimulation.mockResolvedValue(RUN_RESPONSE);
    renderPage();
    await screen.findByText("Course");
    await fillCompleteContext(user);

    const horseInput = screen.getByPlaceholderText("Search horses by name to add to the field...");
    for (const name of [
      "Zephyr (AUS)",
      "Desert Falcon (IRE)",
      "Bailly's Comet (GB)",
      "Silver Arrow (GB)",
      "Midnight Runner (IRE)",
    ]) {
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
      profile_ids: [1, 2, 3, 4, 5],
    });
    expect(await screen.findByText("Coton Star (FR)")).toBeInTheDocument();
  });

  it("shows the API's error message if the run fails", async () => {
    const user = userEvent.setup();
    api.runCustomSimulation.mockRejectedValue(new Error("Select at least 3 horses"));
    renderPage();
    await screen.findByText("Course");
    await fillCompleteContext(user);

    const horseInput = screen.getByPlaceholderText("Search horses by name to add to the field...");
    for (const name of [
      "Zephyr (AUS)",
      "Desert Falcon (IRE)",
      "Bailly's Comet (GB)",
      "Silver Arrow (GB)",
      "Midnight Runner (IRE)",
    ]) {
      await user.type(horseInput, name.slice(0, 3));
      await user.click(await screen.findByText(name));
    }
    await user.click(screen.getByRole("button", { name: "Run Simulation" }));

    expect(await screen.findByText("Select at least 3 horses")).toBeInTheDocument();
  });

  it("prompts an anonymous user to log in to save their result, after a successful run", async () => {
    const user = userEvent.setup();
    api.runCustomSimulation.mockResolvedValue(RUN_RESPONSE);
    renderPage();
    await screen.findByText("Course");
    await fillCompleteContext(user);

    const horseInput = screen.getByPlaceholderText("Search horses by name to add to the field...");
    for (const name of [
      "Zephyr (AUS)",
      "Desert Falcon (IRE)",
      "Bailly's Comet (GB)",
      "Silver Arrow (GB)",
      "Midnight Runner (IRE)",
    ]) {
      await user.type(horseInput, name.slice(0, 3));
      await user.click(await screen.findByText(name));
    }
    await user.click(screen.getByRole("button", { name: "Run Simulation" }));

    expect(await screen.findByText("Log in to save this result to your history.")).toBeInTheDocument();
  });

  it("does not show the login prompt for a logged-in user", async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ user: { email: "rider@example.com" } });
    api.runCustomSimulation.mockResolvedValue({ ...RUN_RESPONSE, saved: true, id: "sim1" });
    renderPage();
    await screen.findByText("Course");
    await fillCompleteContext(user);

    const horseInput = screen.getByPlaceholderText("Search horses by name to add to the field...");
    for (const name of [
      "Zephyr (AUS)",
      "Desert Falcon (IRE)",
      "Bailly's Comet (GB)",
      "Silver Arrow (GB)",
      "Midnight Runner (IRE)",
    ]) {
      await user.type(horseInput, name.slice(0, 3));
      await user.click(await screen.findByText(name));
    }
    await user.click(screen.getByRole("button", { name: "Run Simulation" }));

    await screen.findByText("Coton Star (FR)");
    expect(screen.queryByText("Log in to save this result to your history.")).not.toBeInTheDocument();
  });

  describe("populate buttons", () => {
    it("Populate Random calls populateHorses with no race class and adds only the first new horse", async () => {
      const user = userEvent.setup();
      api.populateHorses.mockResolvedValue(HORSE_OPTIONS);
      renderPage();
      await screen.findByText("Course");

      await user.click(screen.getByRole("button", { name: "Populate Random" }));

      expect(api.populateHorses).toHaveBeenCalledWith({ raceClass: undefined, limit: 20 });
      // One click adds exactly one horse — the first candidate returned —
      // not the whole candidate pool.
      expect(await screen.findByText("Zephyr (AUS)")).toBeInTheDocument();
      expect(screen.queryByText("Desert Falcon (IRE)")).not.toBeInTheDocument();
      expect(screen.queryByText("Bailly's Comet (GB)")).not.toBeInTheDocument();
    });

    it("Populate Class 1 calls populateHorses with raceClass set to Class 1", async () => {
      const user = userEvent.setup();
      api.populateHorses.mockResolvedValue(HORSE_OPTIONS);
      renderPage();
      await screen.findByText("Course");

      await user.click(screen.getByRole("button", { name: "Populate Class 1" }));

      expect(api.populateHorses).toHaveBeenCalledWith({ raceClass: "Class 1", limit: 20 });
      expect(await screen.findByText("Zephyr (AUS)")).toBeInTheDocument();
    });

    it("does not add horses already in the field a second time", async () => {
      const user = userEvent.setup();
      api.populateHorses.mockResolvedValue(HORSE_OPTIONS);
      renderPage();
      await screen.findByText("Course");

      const horseInput = screen.getByPlaceholderText("Search horses by name to add to the field...");
      await user.type(horseInput, "zephyr");
      await user.click(await screen.findByText("Zephyr (AUS)"));

      await user.click(screen.getByRole("button", { name: "Populate Random" }));
      // Zephyr is already selected, so the first *new* candidate — Desert
      // Falcon — is the one added, and only that one.
      await waitFor(() => expect(screen.getByText("Desert Falcon (IRE)")).toBeInTheDocument());

      expect(screen.getAllByRole("button", { name: /^Remove Zephyr/ })).toHaveLength(1);
      expect(screen.queryByText("Bailly's Comet (GB)")).not.toBeInTheDocument();
    });

    it("shows a message instead of adding anything when every fetched candidate is already selected", async () => {
      const user = userEvent.setup();
      api.populateHorses.mockResolvedValue(HORSE_OPTIONS);
      renderPage();
      await screen.findByText("Course");

      const horseInput = screen.getByPlaceholderText("Search horses by name to add to the field...");
      for (const name of [
        "Zephyr (AUS)",
        "Desert Falcon (IRE)",
        "Bailly's Comet (GB)",
        "Silver Arrow (GB)",
        "Midnight Runner (IRE)",
      ]) {
        await user.type(horseInput, name.slice(0, 3));
        await user.click(await screen.findByText(name));
      }

      // Every candidate populateHorses would return is already selected.
      await user.click(screen.getByRole("button", { name: "Populate Class 1" }));

      expect(await screen.findByText("No new Class 1 horses to add.")).toBeInTheDocument();
    });

    it("shows a message instead of fetching anything once the field is already full", async () => {
      const user = userEvent.setup();
      // Every click sees the same full pool; only the first not-yet-selected
      // candidate gets added each time, so 18 clicks fills the field to
      // exactly the max, one horse per click.
      const EIGHTEEN_HORSES = Array.from({ length: 18 }, (_, i) => ({
        profileId: i + 1,
        horse: `Horse ${i + 1}`,
        lastCourse: "Ayr",
        lastDate: "2026-05-01",
      }));
      api.populateHorses.mockResolvedValue(EIGHTEEN_HORSES);
      renderPage();
      await screen.findByText("Course");

      for (let i = 1; i <= 18; i++) {
        await user.click(screen.getByRole("button", { name: "Populate Random" }));
        await screen.findByText(`Horse ${i}`); // field now has i/18
      }

      api.populateHorses.mockClear();
      await user.click(screen.getByRole("button", { name: "Populate Random" }));

      expect(
        await screen.findByText("Your field already has the maximum of 18 horses.")
      ).toBeInTheDocument();
      expect(api.populateHorses).not.toHaveBeenCalled();
    });
  });
});
