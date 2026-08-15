from typing import Optional
from typing_extensions import Literal
from pydantic import BaseModel, Field

CategoryType = Literal["WORK", "CODE", "DESIGN", "AI-BOT"]
PriorityType = Literal["HIGH", "MEDIUM", "LOW"]
StatusType = Literal["Pending", "In Progress", "Completed"]


class UserAuth(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---- Task CRUD schemas ----

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    category: Optional[CategoryType] = "WORK"
    priority: Optional[PriorityType] = "MEDIUM"
    due_date: Optional[str] = None  # ISO date string, e.g. "2026-08-20"


class TaskUpdate(BaseModel):
    """All fields optional so PATCH can update status only, fields only, or both."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[CategoryType] = None
    priority: Optional[PriorityType] = None
    due_date: Optional[str] = None
    status: Optional[StatusType] = None


class TaskResponse(BaseModel):
    id: int
    title: str
    category: str
    priority: str
    due_date: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


class AIPrompt(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=500)


class AIResponse(BaseModel):
    response: str