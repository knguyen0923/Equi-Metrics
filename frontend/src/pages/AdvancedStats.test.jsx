// AdvancedStats has no state of its own — every headline number is
// derived from its props (see the component's own top-of-file comment).
// These tests exercise that derivation logic directly: given a metrics
// array, does it pick the right "best NDCG@10" model, the right active
// model's own stats, and render nothing at all while metrics is still
// loading.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdvancedStats from "./AdvancedStats";

const METRICS = [
  { model: "XGBRanker", top1: "60.89%", ndcg3: "81.96%", ndcg5: "83.05%", ndcg10: "84.75%" },
  { model: "CatBoost Ranker", top1: "46.97%", ndcg3: "83.17%", ndcg5: "84.23%", ndcg10: "85.62%" },
  { model: "LightGBM Ranker", top1: "45.80%", ndcg3: "52.84%", ndcg5: "54.59%", ndcg10: "55.17%" },
  { model: "Neural Network Ranker", top1: "52.01%", ndcg3: "76.34%", ndcg5: "77.84%", ndcg10: "81.24%" },
];

describe("AdvancedStats", () => {
  it("renders nothing while metrics hasn't loaded yet", () => {
    const { container } = render(<AdvancedStats metrics={null} selectedModel="XGBRanker" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing (rather than crashing) if metrics loaded as an empty array", () => {
    // metrics[0] would be undefined here, which the "best NDCG@10" reduce()
    // uses as its seed — this guards against that instead of throwing.
    const { container } = render(<AdvancedStats metrics={[]} selectedModel="XGBRanker" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the active model's own Top-1 and NDCG@10", () => {
    const { container } = render(<AdvancedStats metrics={METRICS} selectedModel="XGBRanker" />);
    // Scoped to the headline stat cards, not the comparison table below —
    // several of these percentages (e.g. XGBRanker's own 84.75% NDCG@10)
    // also appear as a table cell, so an unscoped query would match twice.
    const statCards = within(container.querySelector(".stat-card-grid"));

    expect(statCards.getByText("60.89%")).toBeInTheDocument();
    expect(statCards.getByText("XGBRanker Top-1 Accuracy")).toBeInTheDocument();
    expect(statCards.getByText("84.75%")).toBeInTheDocument();
    expect(statCards.getByText("XGBRanker NDCG@10")).toBeInTheDocument();
  });

  it("picks CatBoost as the best NDCG@10 model out of all four, not just the active one", () => {
    const { container } = render(<AdvancedStats metrics={METRICS} selectedModel="XGBRanker" />);
    const statCards = within(container.querySelector(".stat-card-grid"));

    // 85.62% (CatBoost) beats every other model's ndcg10, including the
    // active model's own 84.75% — this is the whole point of the
    // reduce()-based lookup in the component, not just echoing selectedModel.
    expect(statCards.getByText("85.62%")).toBeInTheDocument();
    expect(statCards.getByText("Best NDCG@10 — CatBoost Ranker")).toBeInTheDocument();
  });

  it("highlights the active model's row in the comparison table", () => {
    render(<AdvancedStats metrics={METRICS} selectedModel="CatBoost Ranker" />);

    const activeCell = screen.getByText("CatBoost Ranker");
    expect(activeCell).toHaveStyle({ fontWeight: "bold" });

    const inactiveCell = screen.getByText("LightGBM Ranker");
    expect(inactiveCell).toHaveStyle({ fontWeight: "normal" });
  });

  it("renders every model's full row in the comparison table", () => {
    render(<AdvancedStats metrics={METRICS} selectedModel="XGBRanker" />);

    for (const row of METRICS) {
      expect(screen.getByText(row.model)).toBeInTheDocument();
    }
  });
});
