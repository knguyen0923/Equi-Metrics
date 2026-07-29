# Pydantic schemas for everything under /simulations, plus the enums that
# pin the simulation form's dropdown values server-side. The frontend
# dropdowns aren't a security boundary — a client can POST anything — so
# these Enum fields make FastAPI reject unrecognized values with a 422
# instead of silently accepting them.
#
# Field names in HorseResult/SimulationRunResponse are deliberately
# camelCase (not the usual Python snake_case) so they match the frontend's
# JSON contract exactly, without needing Pydantic alias configuration.
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class Country(str, Enum):
    GB = "GB"
    FR = "FR"
    IE = "IE"
    US = "US"
    HK = "HK"


class Course(str, Enum):
    # Values match the <option value="..."> in SimulationSetup.jsx, not the
    # human-readable labels shown in the dropdown (e.g. "Belmont Park").
    ASCOT = "Ascot"
    BELMONT = "Belmont"
    SANTA_ANITA = "SantaAnita"
    CHURCHILL = "Churchill"


class TrackCondition(str, Enum):
    FIRM = "Firm"
    GOOD = "Good"
    SOFT = "Soft"
    HEAVY = "Heavy"


class ModelName(str, Enum):
    XGBRANKER = "XGBRanker"
    CATBOOST_RANKER = "CatBoost Ranker"
    LIGHTGBM_RANKER = "LightGBM Ranker"
    NEURAL_NETWORK_RANKER = "Neural Network Ranker"


class SimulationRequest(BaseModel):
    # Body of POST /simulations/run.
    country: Country
    course: Course
    condition: TrackCondition
    model: ModelName


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
    isPlaceholder: bool = True  # always true today — see ml/registry.py
    saved: bool  # whether this run was tied to a logged-in user and written to history


class HistoryItem(BaseModel):
    # One row of GET /simulations/history — shaped to match the columns the
    # frontend's History table already renders (date/track/model/winner).
    id: str
    date: str
    track: str
    model: str
    winner: str


class ModelStat(BaseModel):
    # One row of GET /simulations/stats — the static model-evaluation
    # metrics from the training notebook.
    model: str
    top1: str
    ndcg3: str
    ndcg5: str
    ndcg10: str
