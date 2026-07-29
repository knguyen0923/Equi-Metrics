# All /simulations/* endpoints: running a simulation, fetching a logged-in
# user's history, and the static model-evaluation stats table.
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.db import simulations_collection
from app.ml.registry import predict
from app.models.simulation import (
    HistoryItem,
    ModelStat,
    SimulationRequest,
    SimulationRunResponse,
)
from app.rate_limit import limiter
from app.security import get_current_user, get_optional_user

router = APIRouter(prefix="/simulations", tags=["simulations"])

# Static model-evaluation metrics from the training notebook. Moved server-side
# so the frontend has a single source of truth instead of a hardcoded table.
_MODEL_STATS = [
    ModelStat(model="XGBRanker", top1="60.89%", ndcg3="81.96%", ndcg5="83.05%", ndcg10="84.75%"),
    ModelStat(model="CatBoost Ranker", top1="46.97%", ndcg3="83.17%", ndcg5="84.23%", ndcg10="85.62%"),
    ModelStat(model="LightGBM Ranker", top1="45.80%", ndcg3="52.84%", ndcg5="54.59%", ndcg10="55.17%"),
    ModelStat(model="Neural Network Ranker", top1="52.01%", ndcg3="76.34%", ndcg5="77.84%", ndcg10="81.24%"),
]


@router.get("/stats", response_model=list[ModelStat])
async def get_stats():
    return _MODEL_STATS


@router.post("/run", response_model=SimulationRunResponse)
@limiter.limit("20/minute")
async def run_simulation(
    request: Request,
    payload: SimulationRequest,
    # get_optional_user (not get_current_user): running a simulation doesn't
    # require login. Whether `user` ends up set just decides whether the
    # result gets saved to history below.
    user: Optional[dict] = Depends(get_optional_user),
):
    results = predict(payload.course, payload.condition, payload.model)
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    saved_id = None
    if user is not None:
        doc = {
            "user_id": user["_id"],
            "date": date,
            "country": payload.country.value,
            "course": payload.course.value,
            "condition": payload.condition.value,
            "model": payload.model.value,
            "results": [r.model_dump() for r in results],
            "is_placeholder": True,
            "created_at": datetime.now(timezone.utc),
        }
        inserted = await simulations_collection.insert_one(doc)
        saved_id = str(inserted.inserted_id)

    return SimulationRunResponse(
        id=saved_id,
        date=date,
        results=results,
        isPlaceholder=True,
        saved=user is not None,
    )


@router.get("/history", response_model=list[HistoryItem])
async def get_history(
    limit: int = Query(default=20, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
    # get_current_user (not optional): unlike /run, viewing history always
    # requires being logged in — there's nothing to show otherwise.
    user: dict = Depends(get_current_user),
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
