from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db_session
from services import history as history_service

router = APIRouter()

HistoryMode = Literal["analyze", "compare", "recommend", "research", "quantdocs"]


class HistoryWriteRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    display_prompt: str | None = Field(default=None, max_length=2000)
    mode: HistoryMode
    timestamp: int | None = Field(default=None, ge=0)


class HistoryImportRequest(BaseModel):
    entries: list[HistoryWriteRequest] = Field(default_factory=list, max_length=100)


class HistoryEntryResponse(BaseModel):
    id: str
    prompt: str
    display_prompt: str | None = None
    mode: HistoryMode
    timestamp: int


class HistoryListResponse(BaseModel):
    entries: list[HistoryEntryResponse]
    has_more: bool


class HistoryImportResponse(BaseModel):
    imported_count: int


def _require_user_id(user: dict) -> str:
    user_id = user.get("sub")
    if not isinstance(user_id, str) or not user_id.strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authenticated user id missing")
    return user_id


@router.get("/history", response_model=HistoryListResponse)
async def get_history(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    user_id = _require_user_id(_user)
    entries, has_more = await history_service.list_history_entries(
        session,
        user_id=user_id,
        limit=limit,
        offset=offset,
    )
    return HistoryListResponse(
        entries=[history_service.serialize_history_entry(entry) for entry in entries],
        has_more=has_more,
    )


@router.post("/history", response_model=HistoryEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_history(
    request: HistoryWriteRequest,
    _user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    user_id = _require_user_id(_user)
    try:
        entry, _created = await history_service.create_history_entry(
            session,
            user_id=user_id,
            prompt=request.prompt,
            display_prompt=request.display_prompt,
            mode=request.mode,
            timestamp_ms=request.timestamp,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return HistoryEntryResponse(**history_service.serialize_history_entry(entry))


@router.post("/history/import", response_model=HistoryImportResponse)
async def import_history(
    request: HistoryImportRequest,
    _user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    user_id = _require_user_id(_user)
    try:
        imported_count = await history_service.import_history_entries(
            session,
            user_id=user_id,
            entries=[entry.model_dump() for entry in request.entries],
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return HistoryImportResponse(imported_count=imported_count)


@router.delete("/history/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_history(
    entry_id: str,
    _user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    user_id = _require_user_id(_user)
    deleted = await history_service.delete_history_entry(session, user_id=user_id, entry_id=entry_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="History entry not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)