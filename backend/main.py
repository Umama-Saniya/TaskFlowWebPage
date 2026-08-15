from typing import List

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import auth
import models
import schemas
from database import Base, SessionLocal, engine

# Create tables on startup (SQLite file persists between restarts)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="TaskFlow API", version="2.1.0")

# =========================================================
# CORS — add any extra local dev origins you use here
# =========================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "https://umama-saniya.github.io",
        "null",  # allows opening index.html directly via file:// while testing
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


# =========================================================
# DB SESSION DEPENDENCY
# =========================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================================================
# CURRENT USER DEPENDENCY
# =========================================================
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    username = auth.decode_access_token(token)
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_owned_task(task_id: int, current_user: models.User, db: Session) -> models.Task:
    """Fetch a task and verify the current user owns it, or raise the right HTTP error."""
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this task")
    return task


# =========================================================
# ROOT
# =========================================================
@app.get("/")
def home():
    return {"message": "TaskFlow API is running successfully"}


# =========================================================
# AUTH — REGISTER
# =========================================================
@app.post("/register", status_code=status.HTTP_201_CREATED)
def register(user: schemas.UserAuth, db: Session = Depends(get_db)):
    username = user.username.strip()

    existing = db.query(models.User).filter(models.User.username == username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    new_user = models.User(
        username=username,
        hashed_password=auth.hash_password(user.password),
    )
    db.add(new_user)
    db.commit()

    return {"message": "User registered successfully", "username": username}


# =========================================================
# AUTH — LOGIN
# =========================================================
@app.post("/token", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()

    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    access_token = auth.create_access_token(user.username)
    return {"access_token": access_token, "token_type": "bearer"}


# =========================================================
# TASKS — FULL CRUD
# =========================================================

# CREATE
@app.post("/tasks", response_model=schemas.TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    task: schemas.TaskCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_task = models.Task(
        title=task.title,
        category=task.category,
        priority=task.priority,
        due_date=task.due_date,
        status="Pending",
        owner_id=current_user.id,
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task


# READ — all tasks for the logged-in user
@app.get("/tasks", response_model=List[schemas.TaskResponse])
def get_tasks(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(models.Task).filter(models.Task.owner_id == current_user.id).all()


# READ — a single task by id
@app.get("/tasks/{task_id}", response_model=schemas.TaskResponse)
def get_task(
    task_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_owned_task(task_id, current_user, db)


# UPDATE — partial update (title, category, priority, due_date, and/or status)
@app.patch("/tasks/{task_id}", response_model=schemas.TaskResponse)
def update_task(
    task_id: int,
    task_update: schemas.TaskUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = get_owned_task(task_id, current_user, db)

    for field, value in task_update.dict(exclude_unset=True).items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


# DELETE — a single task
@app.delete("/tasks/{task_id}", status_code=status.HTTP_200_OK)
def delete_task(
    task_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = get_owned_task(task_id, current_user, db)

    db.delete(task)
    db.commit()
    return {"message": "Task deleted successfully"}


# =========================================================
# AI ASSISTANT (rule-based demo assistant — swap in a real
# LLM API call here later if you want it to be smarter)
# =========================================================
@app.post("/ai", response_model=schemas.AIResponse)
def ai_assistant(
    data: schemas.AIPrompt,
    current_user: models.User = Depends(get_current_user),
):
    prompt = data.prompt.lower().strip()

    if any(greeting in prompt for greeting in ("hello", "hii", "hi")):
        reply = f"Hello {current_user.username}! How can I help you with your tasks today?"
    elif "task" in prompt:
        reply = "You can view, add, edit, and delete tasks right from the dashboard. Want help planning one?"
    else:
        reply = f'Got it — you said: "{data.prompt}". Ask me about your tasks anytime!'

    return {"response": reply}