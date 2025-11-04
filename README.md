# AI-powered eDNA Biodiversity Monitoring System

A comprehensive web-based platform for environmental DNA (eDNA) biodiversity monitoring using AI/ML for species identification and analysis.

## Features

- Upload and process eDNA sequence files (FASTA, FASTQ, SAM/BAM)
- AI-powered species identification using BLAST database integration
- Interactive biodiversity visualizations and analysis
- Real-time processing status and batch job support
- Multi-method authentication (email/password, OAuth, institutional SSO)
- Comprehensive export functionality and API access

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **ML Pipeline**: Python + FastAPI + PyTorch
- **Database**: PostgreSQL + Redis
- **Storage**: MinIO/S3 compatible object storage

## Quick Start

```bash
# Clone and install dependencies
git clone https://github.com/your-username/edna-biodiversity-platform.git
cd edna-biodiversity-platform
npm install

# Start development environment
docker-compose -f docker-compose.dev.yml up -d
npm run dev
```

## 🚀 GitHub Repository

**Clone the complete platform:**
```bash
git clone https://github.com/your-username/edna-biodiversity-platform.git
```

**📋 View Repository:** [GitHub Repository](https://github.com/your-username/edna-biodiversity-platform) *(Update with actual URL after upload)*

**🔧 GitHub Upload Guide:** See [GITHUB_UPLOAD.md](./GITHUB_UPLOAD.md)

## Documentation

- [API Documentation](./docs/api/)
- [User Guide](./docs/user-guide/)
- [Deployment Guide](./docs/deployment/)

## License

MIT License - see LICENSE file for details.