# PSM Plagiarism Detection System — Backend

## Requirements
- Python 3.11+ (Python 3.12 recommended)
- PostgreSQL running locally

## Setup (PowerShell)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Create a PostgreSQL database:
```sql
CREATE DATABASE psm_plagiarism;
```
Use pgAdmin Query Tool or `psql` to run the SQL. Update `DATABASE_URL` and `JWT_SECRET` environment variables before starting. For a local quick start, set them in PowerShell:
```powershell
$env:DATABASE_URL="postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/psm_plagiarism"
$env:JWT_SECRET="replace-with-a-long-random-secret"
uvicorn app.main:app --reload
```
API docs: http://127.0.0.1:8000/docs

## Optional semantic model
For stronger semantic comparison, install `sentence-transformers` and set `$env:USE_SENTENCE_TRANSFORMERS="true"`. The first run downloads the `all-MiniLM-L6-v2` model. Without it, exact and near-duplicate matching work; semantic model errors fall back without crashing. This starter's TF-IDF dependencies are installed by default, but TF-IDF alone is lexical similarity, not true semantic understanding.

## Security notes
This is an internship starter. Change JWT_SECRET, configure CORS for your deployed frontend, add migrations/rate limiting, and review privacy/storage policies before production use.
