# Deployment Guide

## Quick Deployment

### Prerequisites
- Docker and Docker Compose installed
- Available ports: 3000, 5000, 8000, 9000, 9001, 5432, 6379
- At least 4GB RAM

### Docker Installation

#### Ubuntu/Debian:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh | sh
sudo usermod -aG docker $USER
```

#### CentOS/RHEL:
```bash
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
```

#### macOS:
Download Docker Desktop from https://docker.com/products/docker-desktop/

### Deployment Steps

1. **Clone and navigate:**
```bash
git clone <repository-url>
cd edna-biodiversity-platform
```

2. **Configure environment:**
```bash
cp .env.production .env
# Edit .env with your values
```

3. **Deploy:**
```bash
chmod +x deploy.sh
./deploy.sh
```

### Access Points
- Frontend: http://localhost:3000
- API: http://localhost:5000
- API Docs: http://localhost:5000/api/docs
- ML Pipeline: http://localhost:8000
- MinIO Console: http://localhost:9001

### Default Credentials
- MinIO: minioadmin / minioadmin

## Production Considerations

1. **SSL Certificates**: Use Let's Encrypt
2. **Security**: Change all default passwords
3. **Backups**: Configure automated backups
4. **Monitoring**: Set up monitoring and alerting
5. **Scaling**: Adjust resources based on load