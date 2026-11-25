"""
AlgaeAI API.

Routes live in app/routers; this module only assembles the application so
`uvicorn main:app` keeps working on Railway and in Docker.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db import DatabaseNotConfigured
from app.routers import admin, identify, me, species, submissions

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

settings = get_settings()

app = FastAPI(
    title="AlgaeAI API",
    description="AI-assisted algae identification and an open, reviewed algae database.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DatabaseNotConfigured)
async def database_not_configured(_: Request, exc: DatabaseNotConfigured):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.get("/")
def root():
    return {"name": "AlgaeAI API", "version": app.version, "docs": "/docs"}


@app.get("/healthz")
def health():
    return {"ok": True}


for module in (identify, species, submissions, admin, me):
    app.include_router(module.router)
