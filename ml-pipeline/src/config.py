from pydantic_settings import BaseSettings
from typing import List, Optional
import os
from pathlib import Path

class Settings(BaseSettings):
    """Application settings"""

    # Application
    app_name: str = "eDNA ML Pipeline"
    version: str = "1.0.0"
    environment: str = "development"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000

    # Database
    database_url: str = "postgresql://edna_user:edna_password@localhost:5432/edna_platform"

    # Redis/Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # Storage (MinIO/S3)
    minio_endpoint: str = "localhost"
    minio_port: int = 9000
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_use_ssl: bool = False
    minio_bucket_name: str = "edna-files"

    # File handling
    upload_dir: str = "./uploads"
    max_file_size: int = 100 * 1024 * 1024  # 100MB
    allowed_file_types: List[str] = ["fasta", "fastq", "fq", "fa", "fas", "sam", "bam"]

    # BLAST configuration
    blast_db_path: str = "./data/blast"
    blast_exec_path: str = "/usr/bin"  # System PATH usually contains BLAST
    ncbi_api_key: Optional[str] = None
    max_blast_results: int = 100

    # ML models
    models_dir: str = "./models"
    confidence_threshold: float = 0.8
    max_sequence_length: int = 1000
    min_sequence_length: int = 50

    # Processing
    max_concurrent_jobs: int = 4
    batch_size: int = 100
    quality_threshold: float = 20.0

    # Database references
    ncbi_nt_url: str = "ftp://ftp.ncbi.nlm.nih.gov/blast/db/nt"
    unite_url: str = "https://unite.ut.ee/sh_files/sh_dynamic_02.02.2023.fasta.gz"

    # Classification
    taxonomy_levels: List[str] = ["kingdom", "phylum", "class", "order", "family", "genus", "species"]

    # Export formats
    export_formats: List[str] = ["csv", "json", "biom", "newick", "excel"]

    # Logging
    log_level: str = "INFO"
    log_file: Optional[str] = None

    # CORS
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:5000"]

    # Security
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # External APIs
    ncbi_base_url: str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    ncbi_api_rate_limit: int = 3  # requests per second

    @property
    def project_root(self) -> Path:
        """Get project root directory"""
        return Path(__file__).parent.parent.parent

    @property
    def absolute_upload_dir(self) -> Path:
        """Get absolute upload directory"""
        return self.project_root / self.upload_dir

    @property
    def absolute_blast_db_path(self) -> Path:
        """Get absolute BLAST database path"""
        return self.project_root / self.blast_db_path

    @property
    def absolute_models_dir(self) -> Path:
        """Get absolute models directory"""
        return self.project_root / self.models_dir

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

# Create settings instance
settings = Settings()

# Create directories if they don't exist
def create_directories():
    """Create necessary directories"""
    directories = [
        settings.absolute_upload_dir,
        settings.absolute_blast_db_path,
        settings.absolute_models_dir,
        settings.absolute_upload_dir / "temp",
        settings.absolute_upload_dir / "processed",
        settings.project_root / "logs",
    ]

    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)

# Create directories on import
create_directories()