from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import uvicorn
import os
from pathlib import Path

from src.config import settings
from src.core.logging import setup_logging
from src.core.database import database_manager
from src.core.storage import storage_manager
from src.api.routers import analysis, files, health, databases
from src.core.exceptions import setup_exception_handlers
from src.jobs.celery_app import celery_app

# Setup logging
logger = setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting eDNA ML Pipeline...")

    # Initialize database connection
    await database_manager.connect()
    logger.info("Database connected")

    # Initialize storage connection
    await storage_manager.connect()
    logger.info("Storage connected")

    # Create necessary directories
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.blast_db_path).mkdir(parents=True, exist_ok=True)
    Path(settings.models_dir).mkdir(parents=True, exist_ok=True)
    logger.info("Directories created")

    # Check BLAST installation
    try:
        import subprocess
        result = subprocess.run(['blastn', '-version'], capture_output=True, text=True)
        logger.info(f"BLAST version: {result.stdout.split()[2]}")
    except (subprocess.CalledProcessError, FileNotFoundError):
        logger.warning("BLAST not found. Please install NCBI BLAST+ toolkit.")

    yield

    # Shutdown
    logger.info("Shutting down eDNA ML Pipeline...")
    await database_manager.disconnect()
    await storage_manager.disconnect()
    logger.info("Shutdown complete")

# Create FastAPI application
app = FastAPI(
    title="eDNA ML Pipeline API",
    description="Machine learning pipeline for environmental DNA biodiversity analysis",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Setup exception handlers
setup_exception_handlers(app)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Include routers
app.include_router(health.router, prefix="/api/v1", tags=["Health"])
app.include_router(analysis.router, prefix="/api/v1", tags=["Analysis"])
app.include_router(files.router, prefix="/api/v1", tags=["Files"])
app.include_router(databases.router, prefix="/api/v1", tags=["Databases"])

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "eDNA ML Pipeline API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/health"
    }

@app.get("/api/v1/info")
async def get_info():
    """Get application information"""
    return {
        "name": "eDNA ML Pipeline",
        "version": "1.0.0",
        "environment": settings.environment,
        "debug": settings.debug,
        "features": {
            "blast": True,
            "ml_classification": True,
            "quality_control": True,
            "export_formats": ["csv", "json", "biom", "newick"]
        }
    }

# Celery status endpoint
@app.get("/api/v1/celery/status")
async def get_celery_status():
    """Get Celery worker status"""
    try:
        inspect = celery_app.control.inspect()
        stats = inspect.stats()
        active = inspect.active()

        return {
            "status": "healthy" if stats else "no_workers",
            "workers": list(stats.keys()) if stats else [],
            "active_tasks": sum(len(tasks) for tasks in active.values()) if active else 0,
            "celery_version": celery_app.__version__
        }
    except Exception as e:
        logger.error(f"Error getting Celery status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get Celery status")

if __name__ == "__main__":
    uvicorn.run(
        "src.api.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info",
        access_log=True
    )