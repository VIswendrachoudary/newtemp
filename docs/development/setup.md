# Development Setup Guide

This guide will help you set up the eDNA Biodiversity Platform for local development.

## Prerequisites

### Required Software

- **Node.js** (v18 or higher)
- **Python** (v3.11 or higher)
- **Docker** and **Docker Compose**
- **PostgreSQL** (v15 or higher) - can use Docker
- **Redis** (v7 or higher) - can use Docker
- **Git**

### Development Tools (Recommended)

- **VS Code** with these extensions:
  - TypeScript and JavaScript Language Features
  - Prisma
  - Python
  - Docker
  - Thunder Client (for API testing)

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd edna-biodiversity-platform
```

### 2. Environment Configuration

Copy the environment template and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your local configuration:

```bash
# Database
DATABASE_URL=postgresql://edna_user:edna_password@localhost:5432/edna_platform

# Redis
REDIS_URL=redis://localhost:6379

# JWT Keys (generate secure keys for production)
JWT_SECRET=your-super-secret-jwt-key
REFRESH_TOKEN_SECRET=your-refresh-token-secret

# Frontend URLs
FRONTEND_URL=http://localhost:3000
VITE_API_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000

# Storage (MinIO - for local development)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

### 3. Using Docker (Recommended)

The fastest way to get started is using Docker Compose:

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker-compose.dev.yml down
```

This will start:
- PostgreSQL database
- Redis cache
- MinIO object storage
- Elasticsearch
- All application services

### 4. Manual Setup (Alternative)

#### Database Setup

```bash
# Start PostgreSQL and Redis using Docker
docker run -d --name postgres \
  -e POSTGRES_DB=edna_platform \
  -e POSTGRES_USER=edna_user \
  -e POSTGRES_PASSWORD=edna_password \
  -p 5432:5432 \
  postgres:15-alpine

docker run -d --name redis \
  -p 6379:6379 \
  redis:7-alpine
```

#### Install Dependencies

```bash
# Install root dependencies
npm install

# Install all service dependencies
npm run install:all
```

#### Database Migration

```bash
# Generate Prisma client
cd backend && npx prisma generate

# Run database migrations
npm run migrate

# Seed database (optional)
npm run seed
```

#### Start Services

```bash
# Start all services in development mode
npm run dev

# Or start individual services:
npm run dev:backend    # Backend API (port 5000)
npm run dev:frontend   # Frontend app (port 3000)
npm run dev:ml-pipeline # ML pipeline (port 8000)
```

## Development Workflow

### 1. Code Structure

```
edna-biodiversity-platform/
├── frontend/          # React + TypeScript frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   └── package.json
├── backend/           # Node.js + Express API
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── middleware/
│   │   └── services/
│   └── package.json
├── ml-pipeline/       # Python + FastAPI ML service
│   ├── src/
│   │   ├── api/
│   │   ├── preprocessing/
│   │   ├── classification/
│   │   └── databases/
│   └── requirements.txt
└── database/          # Database schema and migrations
    └── schema/
```

### 2. Making Changes

#### Frontend Changes

1. Navigate to `frontend/`
2. Make changes to React components
3. The development server will automatically reload

#### Backend Changes

1. Navigate to `backend/`
2. Make changes to TypeScript files
3. Nodemon will automatically restart the server

#### Database Changes

1. Modify `backend/prisma/schema.prisma`
2. Generate migration: `npx prisma migrate dev --name <migration-name>`
3. Generate client: `npx prisma generate`

### 3. Testing

```bash
# Run all tests
npm test

# Run tests for specific services
npm run test:frontend
npm run test:backend
npm run test:ml-pipeline

# Run tests with coverage
npm run test:coverage
```

### 4. Linting and Formatting

```bash
# Lint all code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code (uses Prettier/Black/isort)
npm run format
```

## Database Management

### Using Prisma

```bash
# Generate Prisma client
npx prisma generate

# View database in Prisma Studio
npx prisma studio

# Reset database (development only)
npx prisma migrate reset

# Deploy migrations to production
npx prisma migrate deploy
```

### Direct Database Access

```bash
# Connect to PostgreSQL
psql -h localhost -U edna_user -d edna_platform

# View all tables
\dt

# View table schema
\d table_name
```

## BLAST Database Setup

### 1. Download Reference Databases

```bash
# Navigate to ML pipeline data directory
cd ml-pipeline/data/blast

# Download NCBI NT database (large - use with caution)
wget ftp://ftp.ncbi.nlm.nih.gov/blast/db/nt.00.tar.gz
tar -xzf nt.00.tar.gz

# Download UNITE database for fungi
wget https://unite.ut.ee/sh_files/sh_dynamic_02.02.2023.fasta.gz
gunzip sh_dynamic_02.02.2023.fasta.gz

# Make BLAST database from UNITE
makeblastdb -in sh_dynamic_02.02.2023.fasta -dbtype nucl -out unite_dynamic
```

### 2. Configure BLAST Path

Ensure BLAST+ is installed and in your system PATH, or update the configuration:

```bash
# In backend .env
BLAST_EXEC_PATH=/usr/local/bin  # or your BLAST installation path

# In ml-pipeline .env
BLAST_EXEC_PATH=/usr/bin
```

## MinIO Setup (Local Storage)

### 1. Start MinIO

```bash
docker run -d --name minio \
  -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  -v minio_data:/data \
  minio/minio server /data --console-address ":9001"
```

### 2. Access MinIO Console

- URL: http://localhost:9001
- Username: `minioadmin`
- Password: `minioadmin`

### 3. Create Bucket

Create a bucket named `edna-files` for file storage.

## Troubleshooting

### Common Issues

1. **Port conflicts**
   - Change ports in `.env` or `docker-compose.yml`
   - Kill existing processes: `lsof -ti:5000 | xargs kill`

2. **Database connection errors**
   - Check PostgreSQL is running: `docker ps | grep postgres`
   - Verify connection string in `.env`
   - Check database exists: `psql -h localhost -U edna_user -l`

3. **Permission errors**
   - Fix Docker volume permissions: `sudo chown -R $USER:$USER ./uploads`
   - Check Redis permissions: `sudo chown -R redis:redis /var/lib/redis`

4. **BLAST not found**
   - Install BLAST+: `sudo apt-get install ncbi-blast+`
   - Or use Docker with BLAST pre-installed

### Debug Mode

Enable debug logging by setting:

```bash
# In .env
LOG_LEVEL=debug
NODE_ENV=development
```

### Health Checks

Check service health:

```bash
# Backend
curl http://localhost:5000/health

# Frontend
curl http://localhost:3000/health

# ML Pipeline
curl http://localhost:8000/api/v1/health
```

## Production Deployment

For production deployment, see [Deployment Guide](./deployment.md).

### Key Differences

1. Use `docker-compose.prod.yml` instead of dev version
2. Set `NODE_ENV=production`
3. Use proper SSL certificates
4. Configure external database and storage
5. Set up proper secrets and keys
6. Enable monitoring and logging

## Getting Help

- Check the [API Documentation](../api/)
- Review [Issues](https://github.com/your-org/edna-biodiversity-platform/issues)
- Join our [Discord Community](https://discord.gg/your-invite)
- Email: support@edna-platform.com