# Pydantic schemas for everything under /simulations.
#
# Field names in HorseResult/SimulationRunResponse are deliberately
# camelCase (not the usual Python snake_case) so they match the frontend's
# JSON contract exactly, without needing Pydantic alias configuration.
from typing import Optional

from pydantic import BaseModel


class RaceOption(BaseModel):
    # One entry in GET /simulations/races — a real historical race the user
    # can pick to run inference against (see app/ml/registry.py).
    raceKey: str
    course: str
    date: str


class SimulationRequest(BaseModel):
    # Body of POST /simulations/run. race_key must be one returned by
    # GET /simulations/races — there's no live race-card data source, so
    # arbitrary/future races aren't supported (see app/ml/registry.py).
    race_key: str


class RaceContextOptions(BaseModel):
    # Response of GET /simulations/race-context-options — the category
    # values the model actually recognizes, for populating the custom race
    # builder's dropdowns (see app/ml/registry.py's predict_custom).
    courses: list[str]
    goings: list[str]
    classes: list[str]
    regions: list[str]
    surfaces: list[str]
    distanceCategories: list[str]


class HorseProfile(BaseModel):
    # One entry in GET /simulations/horses — a real horse the user can add
    # to a custom race, seeded from that horse's most recent real appearance.
    profileId: int
    horse: str
    lastCourse: str
    lastDate: str
    age: Optional[float] = None
    jockey: Optional[str] = None
    trainer: Optional[str] = None
    officialRating: Optional[float] = None


class CustomRaceRequest(BaseModel):
    # Body of POST /simulations/custom-run.
    course: str
    going: str
    race_class: str
    region: str
    surface: str
    distance_category: str
    profile_ids: list[int]


class HorseResult(BaseModel):
    # One ranked horse in a simulation's results.
    rank: int
    horse: str
    predictedRank: int
    probability: int
    odds: str
    model: str


class SimulationRunResponse(BaseModel):
    # Response of POST /simulations/run.
    id: Optional[str] = None  # Mongo _id of the saved history row; None if not saved (anonymous run)
    date: str
    results: list[HorseResult]
    isPlaceholder: bool = False  # kept for frontend compat; always false now — see ml/registry.py
    saved: bool  # whether this run was tied to a logged-in user and written to history


class HistoryItem(BaseModel):
    # One row of GET /simulations/history — shaped to match the columns the
    # frontend's History table already renders (date/track/model/winner).
    id: str
    date: str
    track: str
    model: str
    winner: str


class HistoryDetail(BaseModel):
    # Response of GET /simulations/history/{id} — the full ranked breakdown
    # behind one history row, shown when a user clicks into it.
    id: str
    date: str
    track: str
    model: str
    results: list[HorseResult]


class ModelStat(BaseModel):
    # One row of GET /simulations/stats — the static model-evaluation
    # metrics from the training notebook.
    model: str
    top1: str
    ndcg3: str
    ndcg5: str
    ndcg10: str
