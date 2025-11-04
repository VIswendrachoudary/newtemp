#!/bin/bash

# eDNA Biodiversity Platform Deployment Script
# This script deploys the complete platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="edna-platform"

echo -e "${BLUE}🚀 Deploying eDNA Biodiversity Platform${NC}"
echo -e "${BLUE}=====================================${NC}"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    echo -e "${YELLOW}Installation instructions:${NC}"
    echo -e "Ubuntu/Debian: curl -fsSL https://get.docker.com -o get-docker.sh | sh"
    echo -e "CentOS/RHEL: sudo yum install docker"
    echo -e "macOS: Download Docker Desktop from https://docker.com"
    exit 1
fi

# Check if Docker Compose is available
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_status "Using Docker Compose command: $COMPOSE_CMD"

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p backend/uploads
mkdir -p ml-pipeline/data
mkdir -p ml-pipeline/models
mkdir -p logs

# Set proper permissions
chmod 755 backend/uploads ml-pipeline/data ml-pipeline/models logs

# Copy environment file if it doesn't exist
if [ ! -f ".env" ]; then
    print_status "Creating environment file..."
    cp .env.production .env
fi

# Stop any existing containers
print_status "Stopping any existing containers..."
$COMPOSE_CMD -f docker-compose.prod.yml down

# Pull latest images
print_status "Pulling latest base images..."
docker pull postgres:15-alpine
docker pull redis:7-alpine
docker pull minio/minio:latest

# Build application images
print_status "Building application images..."
$COMPOSE_CMD -f docker-compose.prod.yml build --no-cache

# Start services
print_status "Starting production services..."
$COMPOSE_CMD -f docker-compose.prod.yml up -d

# Wait for services to start
print_status "Waiting for services to initialize..."
sleep 30

# Check service status
print_status "Checking service health..."

# Function to check if a service is running
check_service() {
    local service_name=$1
    local container_name="edna-${service_name}-prod"

    if docker ps --filter "name=$container_name" --filter "status=running" | grep -q "$container_name"; then
        print_status "✅ $service_name is running"
        return 0
    else
        print_error "❌ $service_name failed to start"
        return 1
    fi
}

# Check each service
services=("postgres" "redis" "minio" "backend" "frontend" "ml-pipeline")
failed_services=()

for service in "${services[@]}"; do
    if ! check_service "$service"; then
        failed_services+=("$service")
    fi
done

# Show logs for failed services
if [ ${#failed_services[@]} -gt 0 ]; then
    print_error "Some services failed to start. Showing logs:"
    for service in "${failed_services[@]}"; do
        echo -e "\n${RED}--- Logs for $service ---${NC}"
        $COMPOSE_CMD -f docker-compose.prod.yml logs "$service"
    done
    exit 1
fi

# Wait a bit more for services to fully initialize
print_status "Waiting for services to fully initialize..."
sleep 20

# Test connectivity
print_status "Testing service connectivity..."

# Test backend
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    print_status "✅ Backend API is responding"
else
    print_warning "Backend API not yet responding, checking logs..."
    $COMPOSE_CMD -f docker-compose.prod.yml logs backend --tail=20
fi

# Test frontend
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    print_status "✅ Frontend is responding"
else
    print_warning "Frontend not yet responding, checking logs..."
    $COMPOSE_CMD -f docker-compose.prod.yml logs frontend --tail=20
fi

# Show deployment status
echo -e "\n${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}=====================${NC}"
echo -e "${BLUE}🌐 Access URLs:${NC}"
echo -e "  Frontend: http://localhost:3000"
echo -e "  API: http://localhost:5000"
echo -e "  API Docs: http://localhost:5000/api/docs"
echo -e "  ML Pipeline: http://localhost:8000"
echo -e "  MinIO Console: http://localhost:9001"
echo -e ""
echo -e "${BLUE}🔐 Default Credentials:${NC}"
echo -e "  MinIO: minioadmin / minioadmin"
echo -e ""
echo -e "${BLUE}🛠️  Useful Commands:${NC}"
echo -e "  View logs: $COMPOSE_CMD -f docker-compose.prod.yml logs -f [service]"
echo -e "  Stop services: $COMPOSE_CMD -f docker-compose.prod.yml down"
echo -e "  Restart services: $COMPOSE_CMD -f docker-compose.prod.yml restart [service]"
echo -e "  Update services: $COMPOSE_CMD -f docker-compose.prod.yml pull && $COMPOSE_CMD -f docker-compose.prod.yml up -d"
echo -e ""
echo -e "${YELLOW}⚠️  Important Notes:${NC}"
echo -e "  1. Make sure ports 3000, 5000, 8000, 9000, 9001, 5432, 6379 are available"
echo -e "  2. Configure your OAuth applications if needed"
echo -e "  3. Set up proper SSL certificates for production use"
echo -e "  4. Configure proper backup strategy for data volumes"

echo -e "\n${GREEN}✅ eDNA Biodiversity Platform is now live!${NC}"