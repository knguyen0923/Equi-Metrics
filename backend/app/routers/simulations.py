# All /simulations/* endpoints: running a simulation, fetching a logged-in
# user's history, and the static model-evaluation stats table.
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.db import get_simulations_collection
from app.ml import registry
from app.models.simulation import (
    CustomRaceRequest,
    HistoryDetail,
    HistoryItem,
    HorseProfile,
    HorseResult,
    ModelStat,
    RaceContextOptions,
    RaceOption,
    SimulationRequest,
    SimulationRunResponse,
)
from app.rate_limit import limiter
from app.security import get_current_user, get_optional_user

router = APIRouter(prefix="/simulations", tags=["simulations"])


async def _save_and_respond(
    user: Optional[dict],
    date: str,
    course: str,
    results: list[HorseResult],
    simulations_collection,
    race_key: Optional[str] = None,
) -> SimulationRunResponse:
    # Shared by /run and /custom-run: only the race_key/course differ
    # between a real historical race and a custom-built one — everything
    # else about "save if logged in, then respond" is identical.
    saved_id = None
    if user is not None:
        doc = {
            "user_id": user["_id"],
            "date": date,
            "race_key": race_key,
            "course": course,
            "model": results[0].model if results else "XGBRanker",
            "results": [r.model_dump() for r in results],
            "created_at": datetime.now(timezone.utc),
        }
        inserted = await simulations_collection.insert_one(doc)
        saved_id = str(inserted.inserted_id)

    return SimulationRunResponse(
        id=saved_id,
        date=date,
        results=results,
        saved=user is not None,
    )


# Static model-evaluation metrics from the training notebook. Moved server-side
# so the frontend has a single source of truth instead of a hardcoded table.
# CatBoost/LightGBM/the neural network were never exported to a loadable
# model file (see app/ml/registry.py's module docstring), so only
# XGBRanker actually runs — the others are kept here for reference only.
_MODEL_STATS = [
    ModelStat(model="XGBRanker", top1="60.89%", ndcg3="81.96%", ndcg5="83.05%", ndcg10="84.75%"),
    ModelStat(model="CatBoost Ranker", top1="46.97%", ndcg3="83.17%", ndcg5="84.23%", ndcg10="85.62%"),
    ModelStat(model="LightGBM Ranker", top1="45.80%", ndcg3="52.84%", ndcg5="54.59%", ndcg10="55.17%"),
    ModelStat(model="Neural Network Ranker", top1="52.01%", ndcg3="76.34%", ndcg5="77.84%", ndcg10="81.24%"),
]


@router.get("/stats", response_model=list[ModelStat])
async def get_stats():
    return _MODEL_STATS


@router.get("/races", response_model=list[RaceOption])
async def get_races(
    search: str = Query(default="", max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
):
    return registry.list_races(search=search, limit=limit, skip=skip)


@router.get("/races/count")
async def get_races_count():
    return {"total": registry.count_races()}


@router.get("/race-context-options", response_model=RaceContextOptions)
async def get_race_context_options():
    return registry.get_race_context_options()


@router.get("/horses", response_model=list[HorseProfile])
async def get_horses(
    search: str = Query(default="", max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
):
    return registry.search_horses(search=search, limit=limit)


@router.post("/run", response_model=SimulationRunResponse)
@limiter.limit("20/minute")
async def run_simulation(
    request: Request,
    payload: SimulationRequest,
    # get_optional_user (not get_current_user): running a simulation doesn't
    # require login. Whether `user` ends up set just decides whether the
    # result gets saved to history below.
    user: Optional[dict] = Depends(get_optional_user),
    simulations_collection=Depends(get_simulations_collection),
):
    # An unknown race_key raises ValueError, turned into a 400 by the
    # app-wide handler in main.py rather than a try/except here.
    results = registry.predict(payload.race_key)
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return await _save_and_respond(
        user,
        date,
        course=registry.get_race_course(payload.race_key),
        results=results,
        simulations_collection=simulations_collection,
        race_key=payload.race_key,
    )


@router.post("/custom-run", response_model=SimulationRunResponse)
@limiter.limit("20/minute")
async def run_custom_simulation(
    request: Request,
    payload: CustomRaceRequest,
    user: Optional[dict] = Depends(get_optional_user),
    simulations_collection=Depends(get_simulations_collection),
):
    context = {
        "course": payload.course,
        "going": payload.going,
        "race_class": payload.race_class,
        "region": payload.region,
        "surface": payload.surface,
        "distance_category": payload.distance_category,
    }
    # Too few/duplicate/unknown horses all raise ValueError, turned into a
    # 400 by the app-wide handler in main.py rather than a try/except here.
    results = registry.predict_custom(context, payload.profile_ids)
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return await _save_and_respond(
        user,
        date,
        course=f"{payload.course} (custom)",
        results=results,
        simulations_collection=simulations_collection,
    )


@router.get("/history", response_model=list[HistoryItem])
async def get_history(
    limit: int = Query(default=20, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
    # get_current_user (not optional): unlike /run, viewing history always
    # requires being logged in — there's nothing to show otherwise.
    user: dict = Depends(get_current_user),
    simulations_collection=Depends(get_simulations_collection),
):
    cursor = (
        simulations_collection.find({"user_id": user["_id"]})
        .sort("created_at", -1)  # most recent first
        .skip(skip)
        .limit(limit)
    )
    items = []
    async for doc in cursor:
        # The "winner" shown in the history table is just the top-ranked
        # horse from that run's saved results.
        winner = doc["results"][0]["horse"] if doc.get("results") else "—"
        items.append(
            HistoryItem(
                id=str(doc["_id"]),
                date=doc["date"],
                track=doc["course"],
                model=doc["model"],
                winner=winner,
            )
        )
    return items


@router.get("/history/{sim_id}", response_model=HistoryDetail)
async def get_history_detail(
    sim_id: str,
    # Scoped to the logged-in user (not just any valid id) so one user
    # can't view another's saved simulation by guessing/incrementing ids.
    user: dict = Depends(get_current_user),
    simulations_collection=Depends(get_simulations_collection),
):
    try:
        object_id = ObjectId(sim_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid simulation id")

    doc = await simulations_collection.find_one({"_id": object_id, "user_id": user["_id"]})
    if doc is None:
        raise HTTPException(status_code=404, detail="Simulation not found")

    return HistoryDetail(
        id=str(doc["_id"]),
        date=doc["date"],
        track=doc["course"],
        model=doc["model"],
        results=doc["results"],
    )
