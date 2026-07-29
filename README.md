# Equi-Metrics

A horse racing prediction platform. Started as a capstone ML project —
Elo ratings and pedigree features (sire/damsire/dam stats) trained against
several ranking models (XGBRanker, CatBoost, LightGBM, a tuned neural
network) — and grew into a hostable full-stack app: pick a real historical
race or assemble a hypothetical one from real horses, run the model, and
see the predicted finishing order.

## How it's put together

```
backend/      FastAPI + MongoDB — auth, simulation history, ML inference
frontend/     React (Vite) — race/horse search, results, history, stats
ml-models/    Raw training data + the exported XGBRanker model (gitignored)
```

Only **XGBRanker** is wired up for live inference — it's the only model
that was exported to a loadable file. The other models' metrics are shown
for comparison in the UI, but aren't runnable. See
[backend/app/ml/registry.py](backend/app/ml/registry.py) for the inference
layer and [Equi_Metrics.ipynb](Equi_Metrics.ipynb) for how the models were
trained and evaluated.

Predictions run against real historical races the model was **never
trained on** (a held-out chronological 20% split), not hypothetical future
races — there's no live race-card data source wired up yet. You can still
build a hypothetical field from real horses via the custom race builder;
see the module docstring in `registry.py` for how that's scored.

## Running it locally

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in MONGODB_URI and JWT_SECRET at minimum
uvicorn app.main:app --reload
```

`app/ml/data/` (the trimmed test-races CSV, feature columns, and known
category vocabulary the model needs at inference time) is already
committed, generated from the raw dataset in `ml-models/` via:

```bash
python scripts/build_ml_data.py
```

You only need to re-run that if the raw dataset or trained model changes.

Run the test suite:

```bash
pip install -r requirements-dev.txt
pytest
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL, defaults to http://localhost:8000
npm run dev
```

Run tests / lint:

```bash
npm test
npm run lint
```

## Deployment

- **Backend** → Render, via [render.yaml](render.yaml) (`uvicorn app.main:app`).
- **Frontend** → Vercel, via [frontend/vercel.json](frontend/vercel.json).

Both need their respective `.env` variables set in the hosting provider
rather than committed — see each `.env.example` for the full list. A few
things that only surface on the actual first deploy, not in local dev:

- **Vercel's Root Directory must be set to `frontend`** in the project's
  dashboard settings. This repo has both a backend and a frontend at the
  root, so without that setting Vercel builds from the repo root, finds no
  `package.json`, and the build fails outright.
- **Set `VITE_API_URL` in Vercel's Environment Variables UI before the
  first build**, not after. Vite bakes env vars into the build at build
  time, not read at runtime — if it's missing on that first build, the
  deployed frontend silently calls `http://localhost:8000` and every API
  call fails. Changing it later requires a redeploy, not just an env edit.
- **Deploy order matters for CORS**: Render's `FRONTEND_URL` needs to be
  the actual deployed Vercel URL, so deploy the frontend first, then set
  `FRONTEND_URL` on the backend. Vercel preview deployments (per branch/PR)
  get their own unique URL that will never match a single fixed
  `FRONTEND_URL` — set `FRONTEND_PREVIEW_ORIGIN_REGEX` (see
  `backend/.env.example`) if you need previews to be able to call the API too.
- **MongoDB Atlas Network Access must allow Render's traffic.** Render's
  outbound IPs aren't static on the free/starter plan, so Atlas needs a
  `0.0.0.0/0` allowlist entry (or Render's static-IP add-on + a matching
  Atlas entry). `db.py`'s index creation swallows connection errors on
  purpose so a bad allowlist doesn't block startup — which means a
  misconfigured one boots the app "successfully" while every DB-backed
  route quietly fails, so check this first if auth/history don't work
  post-deploy but `/health` and `/simulations/races` do.
- **`requirements.txt` is pinned to exact versions**, generated from a
  known-working environment — if you bump a dependency, re-run the test
  suite before deploying, since Render does a fresh install on every deploy.

## License

[MIT](LICENSE)
