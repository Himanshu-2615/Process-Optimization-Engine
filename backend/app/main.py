"""Process Optimization API - FastAPI application."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routes.processes import router as processes_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup."""
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Process Optimization & Impact Simulation API",
    description="Business analytics system for workflow modeling, bottleneck detection, and optimization simulation",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(processes_router)


@app.get("/")
def root():
    """API health check."""
    return {"status": "ok", "message": "Process Optimization API v2.0", "docs": "/docs"}


@app.get("/health")
def health():
    """Detailed health check."""
    return {"status": "healthy", "version": "2.0.0"}
