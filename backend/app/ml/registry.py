"""Synthetic ranking generator.

Real model inference isn't wired up yet: the trained model files (ml-models/)
and the feature-input schema they expect don't exist in this repo yet. This
module returns deterministic, clearly-labeled placeholder rankings so the
rest of the app (auth, history, deployment) can be built and used end to end
today. Swapping in real inference later means implementing `predict()` here
against the real feature pipeline — nothing in the routers or frontend needs
to change, since the response shape and `isPlaceholder` flag stay the same.
"""

import hashlib

from app.models.simulation import Course, HorseResult, ModelName, TrackCondition

_HORSE_POOL = [
    "Goldship",
    "The Hawkstonian",
    "Skibidi Rizz",
    "Midnight Runner",
    "Silver Comet",
    "Iron Duke",
    "Northern Blaze",
    "Coastal Drift",
]


def predict(course: Course, condition: TrackCondition, model: ModelName) -> list[HorseResult]:
    # Same (course, condition, model) always produces the same 3 horses in
    # the same order — deterministic rather than random, so a user re-running
    # an identical simulation sees consistent "results" instead of noise.
    seed = f"{course.value}|{condition.value}|{model.value}"
    ranked = sorted(_HORSE_POOL, key=lambda horse: hashlib.sha256(f"{seed}|{horse}".encode()).hexdigest())[:3]

    results = []
    for i, horse in enumerate(ranked):
        # Derives a probability/odds pair from the hash so values vary per
        # horse/seed but stay in a plausible range — not meant to resemble
        # real model confidence, just to avoid an obviously-fake flat number.
        digest = hashlib.sha256(f"{seed}|{horse}|score".encode()).digest()
        probability = max(75 - i * 20 - (digest[0] % 10), 5)
        odds_numerator = 4 + i * 2 + (digest[1] % 3)
        results.append(
            HorseResult(
                rank=i + 1,
                horse=horse,
                predictedRank=i + 1,
                probability=probability,
                odds=f"{odds_numerator}-1",
                model=model.value,
            )
        )
    return results
