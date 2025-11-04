# 🚀 eDNA Platform Deployment Guide

## ✅ Fully Implemented & Ready to Deploy!

The eDNA Biodiversity Monitoring System is 100% complete and production-ready.

## 📋 What's Included

- ✅ **Frontend**: React 18 + TypeScript + Vite
- ✅ **Backend**: Node.js + Express + TypeScript + Prisma
- ✅ **ML Pipeline**: Python + FastAPI + PyTorch
- ✅ **Database**: PostgreSQL + Redis + MinIO storage
- ✅ **Authentication**: JWT + OAuth (Google, ORCID, GitHub)
- ✅ **Real-time**: WebSocket communication
- ✅ **File Processing**: FASTA, FASTQ, SAM, BAM support
- ✅ **Analysis**: BLAST integration for species ID
- ✅ **Visualization**: Interactive charts and dashboards
- ✅ **Export**: Multiple formats (CSV, Excel, JSON, BIOM)

## 🚀 Quick Deploy (5 Minutes)

### Prerequisites
- Docker & Docker Compose
- 4GB+ RAM available
- Ports: 3000, 5000, 8000, 9000, 9001, 5432, 6379

### 1. Install Docker
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh | sh
sudo usermod -aG docker $USER
newgrp docker

# CentOS/RHEL/Fedora
sudo yum install -y docker-ce docker-ce-cli containerd.io

# macOS
# Download Docker Desktop from docker.com
```

### 2. Deploy the System
```bash
git clone <your-repo-url>
cd edna-biodiversity-platform

# Configure environment
cp .env.production .env

# Deploy!
chmod +x deploy.sh
./deploy.sh
```

### 3. Access Your Platform
- 🌐 **Frontend**: http://localhost:3000
- 🔌 **API**: http://localhost:5000
- 📊 **API Docs**: http://localhost:5000/api/docs
- 🧬 **ML Pipeline**: http://localhost:8000
- 💾 **MinIO Console**: http://localhost:9001

**Default Login**: minioadmin / minioadmin

## 🔧 Manual Docker Commands

If you prefer manual deployment:

```bash
# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop services
docker-compose -f docker-compose.prod.yml down

# Rebuild
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Nginx (Load Balancer)                    │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React)  │  Backend (Node.js)  │  ML Pipeline (Python)   │
│  Port: 3000      │  Port: 5000        │  Port: 8000           │
└─────────────────┬─────────────────────┬─────────────────────┘
                  │                       │
├─────────────────┴─────────────────────┴─────────────────────┐
│           PostgreSQL (5432)  Redis (6379)  MinIO (9000)      │
│           Database            Cache      Object Storage   │
└──────────────────────────────────────────────────────────────┘
```

## 🔐 Production Configuration

### Environment Variables
Edit `.env` file:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Security
JWT_SECRET=your-super-secret-key
REFRESH_TOKEN_SECRET=your-refresh-secret

# OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### SSL Configuration (Production)
```bash
# Use certbot for Let's Encrypt
sudo apt-get install certbot
sudo certbot certonly --standalone -d yourdomain.com
```

## 📊 Production Features

### Real-time Monitoring
- Live analysis progress updates
- WebSocket-based notifications
- Real-time file upload progress

### Scalability
- Horizontal scaling support
- Load balancing ready
- Container orchestration compatible

### Security
- JWT-based authentication
- OAuth integration
- Row-level security
- Rate limiting
- HTTPS support

### Data Management
- Automated backups
- Data integrity checks
- File versioning
- Export capabilities

## 🛠️ Troubleshooting

### Common Issues

**Port Conflicts:**
```bash
# Check port usage
netstat -tulpn | grep :3000

# Kill conflicting processes
sudo kill -9 <PID>
```

**Permission Issues:**
```bash
# Fix Docker permissions
sudo chown -R $USER:$USER /var/run/docker.sock
sudo chmod -R 777 /var/run/docker.sock
```

**Memory Issues:**
```bash
# Increase Docker memory
sudo sysctl -w vm.max_map_count=262144
```

**Service Not Starting:**
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs [service]

# Restart specific service
docker-compose -f docker-compose.prod.yml restart [service]
```

## 📚 API Documentation

Once deployed, visit:
- **Interactive API Docs**: http://localhost:5000/api/docs
- **OpenAPI Spec**: http://localhost:5000/docs/json

## 🔄 Updates & Maintenance

### Update Application
```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Backup Data
```bash
# Backup volumes
docker run --rm -v postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data
docker run --rm -v minio_data:/data -v $(pwd):/backup alpine tar czf /backup/minio-backup.tar.gz /data
```

## 🎯 Success Metrics

Your eDNA Platform is successfully deployed when:

- ✅ All containers are running (`docker ps`)
- ✅ Frontend loads at http://localhost:3000
- ✅ API responds at http://localhost:5000/health
- ✅ ML Pipeline is healthy at http://localhost:8000/api/v1/health
- ✅ MinIO console accessible at http://localhost:9001
- ✅ Users can register and login
- ✅ File uploads work correctly
- ✅ Analysis jobs process successfully

## 🆘 Support

- **Documentation**: [docs/development/setup.md](docs/development/setup.md)
- **API Reference**: [docs/api/overview.md](docs/api/overview.md)
- **Issues**: Report on GitHub Issues
- **Community**: Join our Discord community

---

🎉 **Your eDNA Biodiversity Platform is now live and ready for research!** 🧬🔬📊