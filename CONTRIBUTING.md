# Contributing to eDNA Biodiversity Platform

Thank you for your interest in contributing to the eDNA Biodiversity Platform! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to ensure a welcoming environment for all contributors.

## Getting Started

### Prerequisites

- Node.js 18+ and Python 3.11+
- Docker and Docker Compose
- Git
- A code editor (VS Code recommended)

### Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/edna-biodiversity-platform.git`
3. Navigate to the project: `cd edna-biodiversity-platform`
4. Set up your development environment following the [Development Setup Guide](docs/development/setup.md)

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-fix-name
```

### 2. Make Changes

- Follow the coding standards outlined below
- Write tests for new functionality
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run linting
npm run lint

# Check code formatting
npm run format:check
```

### 4. Commit Changes

Follow our [commit message conventions](#commit-messages):

```bash
git add .
git commit -m "feat: add new species identification feature"
```

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub.

## Coding Standards

### General Guidelines

- Write clean, readable, and maintainable code
- Follow language-specific conventions
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

### Frontend (React + TypeScript)

- Use TypeScript for all new code
- Follow React best practices
- Use functional components with hooks
- Prefer composition over inheritance
- Use our custom UI components when possible

```tsx
// Good ✅
import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export function UploadButton({ onUpload }: { onUpload: (file: File) => void }) {
  const [isLoading, setIsLoading] = useState(false)

  const handleUpload = async (file: File) => {
    setIsLoading(true)
    try {
      await onUpload(file)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleUpload}
      disabled={isLoading}
      loading={isLoading}
    >
      Upload File
    </Button>
  )
}
```

### Backend (Node.js + TypeScript)

- Use async/await for asynchronous operations
- Implement proper error handling
- Use dependency injection
- Follow RESTful API principles
- Validate all inputs

```typescript
// Good ✅
import { Request, Response } from 'express'
import { z } from 'zod'
import { projectService } from '@/services'

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  visibility: z.enum(['private', 'shared', 'public']).default('private'),
})

export async function createProject(req: Request, res: Response) {
  try {
    const validatedData = createProjectSchema.parse(req.body)
    const project = await projectService.create(validatedData, req.user.id)

    res.status(201).json({
      success: true,
      data: project,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      })
    }

    next(error)
  }
}
```

### Python (FastAPI)

- Use type hints everywhere
- Follow PEP 8 style guidelines
- Use Pydantic for data validation
- Write async functions when possible
- Include proper docstrings

```python
# Good ✅
from typing import List, Optional
from fastapi import HTTPException, Depends
from pydantic import BaseModel, Field

class AnalysisParameters(BaseModel):
    quality_threshold: float = Field(20.0, ge=0, le=100)
    min_sequence_length: int = Field(50, ge=1)
    max_sequence_length: int = Field(1000, ge=1)
    confidence_threshold: float = Field(0.95, ge=0, le=1)

async def run_analysis(
    analysis_id: str,
    parameters: AnalysisParameters,
    db: Database = Depends(get_database)
) -> AnalysisResult:
    """Run species identification analysis on uploaded sequences."""
    try:
        # Validate analysis exists
        analysis = await db.get_analysis(analysis_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")

        # Run analysis pipeline
        result = await analysis_pipeline.run(analysis, parameters)
        return result

    except Exception as e:
        logger.error(f"Analysis {analysis_id} failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Analysis failed")
```

## Testing Guidelines

### Test Coverage

- Aim for >80% code coverage
- Write unit tests for all new functions
- Write integration tests for API endpoints
- Test error cases and edge cases

### Frontend Testing

```tsx
// Example component test
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UploadButton } from '@/components/UploadButton'

describe('UploadButton', () => {
  it('should upload file when clicked', async () => {
    const mockOnUpload = jest.fn()
    render(<UploadButton onUpload={mockOnUpload} />)

    const file = new File(['test'], 'test.fasta', { type: 'text/plain' })
    const input = screen.getByRole('button')

    fireEvent.click(input)

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith(file)
    })
  })
})
```

### Backend Testing

```typescript
// Example API test
import request from 'supertest'
import { app } from '@/index'
import { prisma } from '@/database'

describe('Projects API', () => {
  beforeEach(async () => {
    await prisma.project.deleteMany()
    await prisma.user.deleteMany()
  })

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const user = await createTestUser()
      const token = generateTestToken(user)

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Project',
          description: 'Test Description',
        })
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.name).toBe('Test Project')
    })
  })
})
```

### Python Testing

```python
# Example test
import pytest
from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)

def test_create_analysis():
    """Test creating a new analysis job."""
    response = client.post(
        "/api/v1/analysis",
        json={
            "project_id": "test-project-id",
            "parameters": {
                "quality_threshold": 20,
                "confidence_threshold": 0.95
            }
        }
    )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "queued"
    assert "id" in data
```

## Documentation

### Code Documentation

- Write clear docstrings for all functions and classes
- Document API endpoints with OpenAPI/Swagger
- Include examples in documentation

### README Updates

- Update feature lists
- Add new configuration options
- Document breaking changes

### API Documentation

- Use OpenAPI specifications
- Include request/response examples
- Document error codes

## Pull Request Process

### Before Submitting

1. **Code Review**: Self-review your code
2. **Testing**: Ensure all tests pass
3. **Documentation**: Update relevant documentation
4. **Formatting**: Run code formatters

### PR Template

Use this template for your pull requests:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] All tests pass
- [ ] New tests added
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated Checks**: CI/CD pipeline runs tests and linting
2. **Code Review**: At least one maintainer must review
3. **Approval**: Required approval from maintainers
4. **Merge**: Squash and merge to main branch

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting (no functional changes)
- `refactor`: Code refactoring
- `test`: Test additions or changes
- `chore`: Maintenance tasks

### Examples

```bash
feat(auth): add OAuth login support
fix(analysis): resolve memory leak in large file processing
docs(api): update authentication documentation
refactor(database): optimize query performance
test(upload): add file validation tests
```

## Issue Reporting

### Bug Reports

Use the bug report template:

```markdown
**Bug Description**
Clear description of the bug

**Steps to Reproduce**
1. Go to...
2. Click on...
3. See error

**Expected Behavior**
What you expected to happen

**Actual Behavior**
What actually happened

**Environment**
- OS: [e.g. macOS 13.0]
- Browser: [e.g. Chrome 119]
- Version: [e.g. v1.2.3]
```

### Feature Requests

Use the feature request template:

```markdown
**Feature Description**
Clear description of the feature

**Problem Statement**
What problem does this solve?

**Proposed Solution**
How should this work?

**Alternatives Considered**
Other approaches you've considered
```

## Getting Help

- **Discord**: Join our community Discord
- **Discussions**: Use GitHub Discussions for questions
- **Email**: dev@edna-platform.com for developer support

## License

By contributing, you agree that your contributions will be licensed under the MIT License.