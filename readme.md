# TaskFlow — Full Stack Task Manager

FastAPI + SQLite backend, vanilla HTML/CSS/JS frontend, JWT auth, and full CRUD on tasks.

## Project structure

```
taskflow/
├── backend/
│   ├── main.py            # FastAPI app, routes (auth + tasks CRUD + AI)
│   ├── models.py          # SQLAlchemy models (User, Task)
│   ├── schemas.py         # Pydantic request/response schemas
│   ├── database.py        # SQLAlchemy engine/session setup
│   ├── auth.py            # Password hashing + JWT create/verify
│   ├── requirements.txt   # Python dependencies
│   ├── .env.example       # Copy to .env and fill in real values
│   └── taskflow.db        # SQLite file (auto-created, gitignored)
├── frontend/
│   ├── index.html         # UI markup
│   ├── style.css          # Theming (dark/light) + layout
│   └── script.js          # All event handling + API calls
├── .gitignore
└── README.md
```

## 1. Backend setup

```bash
cd taskflow/backend

# create + activate a virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS / Linux

# install dependencies
pip install -r requirements.txt

# create your local .env from the example
copy .env.example .env       # Windows
cp .env.example .env         # macOS / Linux
```

Open `.env` and set a real `SECRET_KEY` (any long random string is fine for local dev).

Run the API:

```bash
uvicorn main:app --reload --port 8000
```

The API is now live at `http://127.0.0.1:8000`, with interactive docs at
`http://127.0.0.1:8000/docs`.

## 2. Frontend setup

The frontend is plain HTML/CSS/JS — no build step. Just serve the folder so
`fetch()` calls aren't blocked by `file://` restrictions:

```bash
cd taskflow/frontend

# any static server works, e.g.:
python -m http.server 5500
# then open http://127.0.0.1:5500 in your browser
```

If you use VS Code, the "Live Server" extension works too (it defaults to
port 5500, which is already whitelisted in the backend's CORS config).

`script.js` points at `API_URL = "http://127.0.0.1:8000"` — update that if
you run the backend on a different host/port.

## 3. API endpoints (CRUD)

| Method | Route            | Auth required | Description                     |
|--------|------------------|:--------------:|----------------------------------|
| POST   | `/register`      | No             | Create a new user account        |
| POST   | `/token`         | No             | Log in, returns a JWT            |
| GET    | `/tasks`         | Yes            | List the logged-in user's tasks  |
| GET    | `/tasks/{id}`    | Yes            | Get a single task                |
| POST   | `/tasks`         | Yes            | Create a task                    |
| PATCH  | `/tasks/{id}`    | Yes            | Update a task (partial)          |
| DELETE | `/tasks/{id}`    | Yes            | Delete a task                    |
| POST   | `/ai`            | Yes            | Simple rule-based assistant reply|

Auth uses `Authorization: Bearer <token>` on every protected route.

## 4. What to add to `.gitignore` (already done for you)

- `.env` / `backend/.env` — secrets (JWT secret key, DB URL)
- `venv/`, `__pycache__/` — Python virtual env + bytecode
- `*.db` / `taskflow.db` — the local SQLite database file
- `.vscode/`, `.idea/`, `.DS_Store` — editor/OS clutter

Never commit `.env` or the `.db` file — commit `.env.example` instead so
teammates know which variables to set.

## 5. Git commands to publish this project

```bash
cd taskflow
git init
git add .
git commit -m "Initial commit: TaskFlow full-stack app"
git branch -M main
git remote add origin <your-empty-github-repo-url>
git push -u origin main
```

## Notes on what changed from the original code

- **Event handling**: removed all inline `onclick`/`onchange` attributes from
  the HTML. `script.js` now wires everything up with `addEventListener`, and
  the dynamically-rendered task list uses **event delegation** (`data-*`
  attributes + one listener on the container) instead of re-binding a new
  inline handler per row.
- **Edit task**: added a pencil/edit button per task, wired to the same
  modal used for creating tasks (`PATCH /tasks/{id}` instead of `POST` when
  editing) — this was the missing CRUD "U" for full manual editing (title/
  category/priority/date), not just status.
- **Toasts instead of `alert()`**: non-blocking toast notifications for
  errors/success messages, styled to match the dark/light theme.
- **Backend**: added `GET /tasks/{id}`, a shared `get_owned_task()` helper
  to avoid repeating the "not found / not authorized" checks, `Literal`
  types on category/priority/status so bad values are rejected with a
  clear 422 instead of silently saved, and a `.env.example` for onboarding.