# API Documentation

## Overview

The eDNA Biodiversity Platform provides a comprehensive RESTful API for environmental DNA analysis, species identification, and biodiversity monitoring.

### Base URL

- **Development**: `http://localhost:5000/api`
- **Production**: `https://api.edna-platform.com/api`

### Authentication

Most API endpoints require authentication using JWT (JSON Web Tokens).

#### Authentication Methods

1. **Email/Password**: Traditional login with email and password
2. **OAuth**: Sign in with Google, ORCID, or GitHub
3. **API Keys**: For programmatic access (coming soon)

#### JWT Token Format

```http
Authorization: Bearer <jwt_token>
```

### API Versioning

The API uses URL versioning:

```
/api/v1/resource
```

Current version: `v1`

### Rate Limiting

- **Authenticated users**: 100 requests per 15 minutes
- **Unauthenticated users**: 30 requests per 15 minutes
- **File uploads**: 10 uploads per hour

### Error Handling

The API uses standard HTTP status codes and returns errors in a consistent format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "validation error"
  }
}
```

### Response Format

Success responses follow this format:

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Optional success message"
}
```

Paginated responses include pagination metadata:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Core Endpoints

### Authentication (`/api/v1/auth`)

#### Register User
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "institution": "University of Example"
}
```

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

#### Refresh Token
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh_token_here"
}
```

#### OAuth URLs
```http
GET /api/v1/auth/oauth/google/url
GET /api/v1/auth/oauth/orcid/url
GET /api/v1/auth/oauth/github/url
```

### Projects (`/api/v1/projects`)

#### List Projects
```http
GET /api/v1/projects?page=1&limit=20&search=keyword
Authorization: Bearer <token>
```

#### Create Project
```http
POST /api/v1/projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "River Sample Analysis",
  "description": "eDNA samples from river ecosystem",
  "visibility": "private"
}
```

#### Get Project
```http
GET /api/v1/projects/{projectId}
Authorization: Bearer <token>
```

#### Update Project
```http
PUT /api/v1/projects/{projectId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Project Name",
  "description": "Updated description"
}
```

#### Delete Project
```http
DELETE /api/v1/projects/{projectId}
Authorization: Bearer <token>
```

#### Share Project
```http
POST /api/v1/projects/{projectId}/share
Authorization: Bearer <token>
Content-Type: application/json

{
  "emails": ["collaborator@example.com"]
}
```

### Files (`/api/v1/files`)

#### Upload File
```http
POST /api/v1/files/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary_file_data>
projectId: project_uuid
```

#### Get File Metadata
```http
GET /api/v1/files/{fileId}
Authorization: Bearer <token>
```

#### Download File
```http
GET /api/v1/files/{fileId}/download
Authorization: Bearer <token>
```

#### Delete File
```http
DELETE /api/v1/files/{fileId}
Authorization: Bearer <token>
```

#### Validate File
```http
POST /api/v1/files/validate
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary_file_data>
```

### Analysis (`/api/v1/analysis`)

#### Start Analysis
```http
POST /api/v1/analysis/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "projectId": "project_uuid",
  "fileIds": ["file1_uuid", "file2_uuid"],
  "parameters": {
    "qualityThreshold": 20,
    "minLength": 50,
    "maxLength": 1000,
    "targetDatabase": "nt",
    "confidenceThreshold": 0.95
  }
}
```

#### Get Analysis Status
```http
GET /api/v1/analysis/{analysisId}
Authorization: Bearer <token>
```

#### Get Analysis Results
```http
GET /api/v1/analysis/{analysisId}/results
Authorization: Bearer <token>
```

#### Cancel Analysis
```http
POST /api/v1/analysis/{analysisId}/cancel
Authorization: Bearer <token>
```

#### Get Analysis Logs
```http
GET /api/v1/analysis/{analysisId}/logs
Authorization: Bearer <token>
```

### Results (`/api/v1/results`)

#### Get Results
```http
GET /api/v1/results/{analysisId}
Authorization: Bearer <token>
```

#### Export Results
```http
GET /api/v1/results/{analysisId}/export/{format}
Authorization: Bearer <token>

# Formats: csv, tsv, excel, json, biom, newick, pdf
```

#### Get Visualization Data
```http
GET /api/v1/results/{analysisId}/visualizations/{vizId}
Authorization: Bearer <token>
```

#### Share Results
```http
POST /api/v1/results/{analysisId}/share
Authorization: Bearer <token>
Content-Type: application/json

{
  "emails": ["researcher@example.com"]
}
```

## WebSocket API

Real-time updates are available through WebSocket connections.

### Connection

```javascript
const socket = io('ws://localhost:5000', {
  auth: {
    token: 'jwt_token_here'
  }
});
```

### Events

#### Analysis Progress
```javascript
socket.on('analysis_progress', (data) => {
  console.log('Analysis progress:', data);
  // { analysisId, progress, status, message }
});
```

#### Analysis Completed
```javascript
socket.on('analysis_completed', (data) => {
  console.log('Analysis completed:', data);
  // { analysisId, results }
});
```

#### File Upload Progress
```javascript
socket.on('file_upload_progress', (data) => {
  console.log('Upload progress:', data);
  // { uploadId, progress, bytesLoaded, totalBytes }
});
```

## Data Models

### User
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "orcidId": "0000-0000-0000-0000",
  "institution": "University",
  "role": "researcher",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Project
```json
{
  "id": "uuid",
  "name": "Project Name",
  "description": "Project description",
  "visibility": "private",
  "ownerId": "uuid",
  "fileCount": 5,
  "analysisCount": 2,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### File
```json
{
  "id": "uuid",
  "filename": "sample.fasta",
  "originalName": "river_sample.fasta",
  "fileSize": 1048576,
  "fileType": "fasta",
  "uploadStatus": "completed",
  "metadata": {
    "sequenceCount": 1000,
    "averageLength": 250
  },
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Analysis Job
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "status": "completed",
  "progress": 100,
  "parameters": {
    "qualityThreshold": 20,
    "confidenceThreshold": 0.95
  },
  "startedAt": "2024-01-01T00:00:00Z",
  "completedAt": "2024-01-01T01:00:00Z",
  "results": { ... }
}
```

### Species Identification
```json
{
  "id": "uuid",
  "scientificName": "Salmo trutta",
  "commonName": "Brown trout",
  "taxonomy": {
    "kingdom": "Animalia",
    "phylum": "Chordata",
    "class": "Actinopterygii",
    "order": "Salmoniformes",
    "family": "Salmonidae",
    "genus": "Salmo",
    "species": "trutta"
  },
  "abundance": 45,
  "relativeAbundance": 0.23,
  "confidence": 0.98
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `AUTH_001` | Invalid credentials |
| `AUTH_002` | Token expired |
| `AUTH_003` | Insufficient permissions |
| `FILE_001` | File too large |
| `FILE_002` | Invalid file format |
| `FILE_003` | File not found |
| `PROJECT_001` | Project not found |
| `PROJECT_002` | Access denied |
| `ANALYSIS_001` | Analysis not found |
| `ANALYSIS_002` | Analysis failed |
| `RATE_LIMIT` | Rate limit exceeded |
| `VALIDATION_ERROR` | Input validation failed |

## SDK Libraries

We provide official SDKs for popular languages:

- [JavaScript/TypeScript](https://github.com/your-org/edna-js-sdk)
- [Python](https://github.com/your-org/edna-python-sdk)
- [R](https://github.com/your-org/edna-r-sdk)

## Support

- **API Documentation**: Interactive docs at `/api/docs`
- **Issues**: [GitHub Issues](https://github.com/your-org/edna-biodiversity-platform/issues)
- **Email**: api-support@edna-platform.com
- **Status**: [API Status Page](https://status.edna-platform.com)