import os
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import List, Dict

from app.database import get_db
from app.models.attempt import ExamAttempt, ExamEvent, AttemptStatus
from app.models.user import User
from app.schemas.attempt import ExamEventCreate, ExamEventOut
from app.services.auth_utils import get_current_user, require_teacher
from app.services import face_service

router = APIRouter()

active_connections: Dict[int, List[WebSocket]] = {}


@router.post("/events", response_model=ExamEventOut)
async def log_event(
    event_in: ExamEventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == event_in.attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    evidence_url = None
    if event_in.evidence_base64:
        try:
            evidence_url = face_service.save_image_to_disk(event_in.evidence_base64, "evidence")
        except Exception:
            pass

    event = ExamEvent(
        attempt_id=event_in.attempt_id,
        event_type=event_in.event_type,
        severity=event_in.severity,
        description=event_in.description,
        evidence_url=evidence_url,
    )
    db.add(event)

    if event_in.severity.value == "hard":
        attempt.integrity_strike_count = (attempt.integrity_strike_count or 0) + 1
        if attempt.integrity_strike_count >= 3 and attempt.status == AttemptStatus.in_progress:
            attempt.status = AttemptStatus.locked_pending_review

    db.commit()
    db.refresh(event)

    if event_in.attempt_id in active_connections:
        msg = {
            "event_type": event_in.event_type,
            "severity": event_in.severity.value,
            "description": event_in.description,
            "timestamp": event.timestamp.isoformat() if event.timestamp else None,
            "strike_count": attempt.integrity_strike_count,
            "status": attempt.status.value,
        }
        dead = []
        for ws in active_connections[event_in.attempt_id]:
            try:
                await ws.send_text(json.dumps(msg))
            except Exception:
                dead.append(ws)
        for ws in dead:
            active_connections[event_in.attempt_id].remove(ws)

    return event


@router.get("/attempts/{attempt_id}/events", response_model=List[ExamEventOut])
def get_events(
    attempt_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    events = db.query(ExamEvent).filter(ExamEvent.attempt_id == attempt_id).order_by(ExamEvent.timestamp).all()
    return events


@router.websocket("/ws/{attempt_id}")
async def websocket_monitor(websocket: WebSocket, attempt_id: int):
    await websocket.accept()
    if attempt_id not in active_connections:
        active_connections[attempt_id] = []
    active_connections[attempt_id].append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if attempt_id in active_connections and websocket in active_connections[attempt_id]:
            active_connections[attempt_id].remove(websocket)
