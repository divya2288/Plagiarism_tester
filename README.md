# PSM Insight – Plagiarism Detection System

A document similarity analysis application that compares submitted text and documents against a reference library, identifies matching passages, and generates downloadable PDF reports.

## Features

- User registration and login
- PDF, DOCX, and TXT document uploads
- Text-based scanning
- Exact and near-duplicate passage detection
- Similarity score and matched-word count
- Highlighted passages with reference source details
- PDF report export
- Scan history with open and delete options
- User-specific scan history and report access
- Upload validation and file-size limits

## Technology Stack

- **Frontend:** React, Vite
- **Backend:** Python, FastAPI
- **Database:** PostgreSQL
- **Document processing:** PDF, DOCX, and TXT extraction
- **Detection:** Exact matching, text similarity, and optional semantic similarity

## Project Structure

- `backend/` – API, authentication, document processing, and detection logic
- `frontend/` – React user interface
- `README.md` – Project documentation

## Local Setup

### 1. Backend

From the project root, activate the virtual environment:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies if a `requirements.txt` file is provided:

```powershell
pip install -r backend\requirements.txt
```

Configure the PostgreSQL connection and required environment variables according to the backend configuration.

Start the API:

```powershell
python -m uvicorn app.main:app --app-dir backend --port 8000
```

### 2. Frontend

Open another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite.

## Detection Methodology

The system compares submitted documents against documents in its reference library. Depending on the configured detection options, it identifies exact matches and near-duplicate passages and can use semantic similarity when that capability is enabled.

Similarity scores are indicators of textual overlap, not definitive proof of plagiarism. Results depend on the reference documents available to the system.

## Limitations

- Internet-wide plagiarism detection is not included.
- Semantic similarity depends on the model and configuration being available and enabled.
- Results may not identify every paraphrased passage.

## Testing

Test the system using original, exact-copy, modified, paraphrased, and unrelated documents. Record expected and actual similarity scores, matched passages, and source details.

## Security

Keep database credentials, secret keys, and API keys in environment variables. Do not commit secrets or private user documents to the repository.
