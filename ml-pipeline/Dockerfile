# Multi-stage build for Python ML pipeline
FROM python:3.11-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install BLAST+
RUN apt-get update && apt-get install -y \
    ncbi-blast+ \
    && rm -rf /var/lib/apt/lists/*

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Builder stage
FROM base AS builder
WORKDIR /app

# Copy requirements and install all dependencies (including dev)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Production stage
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN useradd --create-home --shell /bin/bash --uid 1001 mluser

# Copy Python packages from deps stage
COPY --from=deps /root/.local /home/mluser/.local

# Copy application code
COPY --chown=mluser:mluser . .

# Create necessary directories
RUN mkdir -p uploads logs models data/blast && \
    chown -R mluser:mluser uploads logs models data

# Set environment variables
ENV PATH=/home/mluser/.local/bin:$PATH
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Switch to non-root user
USER mluser

# Create directories in user home
RUN mkdir -p /home/mluser/uploads /home/mluser/logs /home/mluser/models /home/mluser/data

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Start the application
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]