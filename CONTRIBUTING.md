# Contributing to Project Yggdrasil

Thank you for your interest in contributing! This document provides guidelines and standards for contributing to Project Yggdrasil.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Testing Requirements](#testing-requirements)
6. [Documentation](#documentation)
7. [Pull Request Process](#pull-request-process)
8. [Issue Guidelines](#issue-guidelines)

---

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the project
- Show empathy towards other contributors

### Unacceptable Behavior

- Harassment or discriminatory language
- Publishing others' private information
- Trolling or insulting/derogatory comments
- Other unprofessional conduct

---

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- Git
- Basic understanding of the OWASP Top 10

### Setup

```bash
# Fork the repository
# Clone your fork
git clone https://github.com/YOUR_USERNAME/project_yggdrasil.git
cd project_yggdrasil

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/project_yggdrasil.git

# Single command to setup AND start everything
make yggdrasil

# Run tests
make test
```

> **Alternative:** You can also run `make setup` then `make up` separately if you prefer.

---

## Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `refactor/` - Code refactoring
- `test/` - Test additions or fixes
- `chore/` - Maintenance tasks

**Examples:**
```sh
feature/add-bifrost-landing-page
fix/niflheim-exception-handling
docs/update-asgard-realm-guide
refactor/gatekeeper-auth-service
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```sh
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

**Examples:**
```sh
feat(gatekeeper): add CSRF protection to flag submission

fix(asgard): correct IDOR vulnerability in document access

docs(readme): update installation instructions

test(niflheim): add unit tests for pressure validation
```

### Making Changes

1. **Create branch:**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes:**
   - Follow coding standards (see below)
   - Add/update tests
   - Update documentation

3. **Test locally:**
   ```bash
   make test
   ./scripts/smoke-test.sh
   ```

4. **Commit changes:**
   ```bash
   git add .
   git commit -m "feat(service): add new feature"
   ```

5. **Push to fork:**
   ```bash
   git push origin feature/my-feature
   ```

6. **Create Pull Request** on GitHub

---

## Coding Standards

### General Principles

- **DRY (Don't Repeat Yourself)**: Extract common logic into reusable functions
- **KISS (Keep It Simple, Stupid)**: Prefer simple solutions over complex ones
- **YAGNI (You Aren't Gonna Need It)**: Don't add functionality until necessary
- **Separation of Concerns**: Clear boundaries between layers

### TypeScript/JavaScript

**Style:**
- Use TypeScript strict mode
- 2-space indentation
- Single quotes for strings
- Semicolons required
- Trailing commas in multi-line

**Example:**
```typescript
// Good
export async function validateFlag(
  userId: string,
  flag: string
): Promise<ValidationResult> {
  if (!userId || !flag) {
    return { valid: false, error: 'Missing parameters' };
  }
  
  const result = await this.validator.validate(flag);
  return result;
}

// Avoid
export async function validateFlag(userId,flag){
  if(!userId||!flag){return {valid:false,error:'Missing parameters'};}
  const result=await this.validator.validate(flag);return result
}
```

**Naming Conventions:**
- `camelCase` for variables and functions
- `PascalCase` for classes and types
- `UPPER_SNAKE_CASE` for constants
- Descriptive names (avoid abbreviations)

**Structure:**
```
src/
├── routes/          # HTTP route handlers
├── services/        # Business logic
├── repositories/    # Data access
├── models/          # Data models/types
├── middleware/      # Express middleware
├── utils/           # Utility functions
└── config/          # Configuration
```

### Error Handling

**Always:**
- Use try-catch in async functions
- Log errors with context
- Return generic messages to users
- Never expose stack traces in responses

**Example:**
```typescript
router.post('/endpoint', async (req, res) => {
  try {
    const result = await someService.doSomething();
    res.json({ status: 'success', data: result });
  } catch (error) {
    logger.error('Error in endpoint', { error, userId: req.user?.id });
    res.status(500).json({ status: 'error', message: 'Internal error' });
  }
});
```

### Intentional Vulnerabilities

**CRITICAL:** Do not "fix" intentional vulnerabilities!

- Each realm has documented vulnerabilities
- These are the training content
- Changes must preserve exploit paths
- Test exploits after any realm modifications

**Before modifying a realm:**
1. Read `.docs/realms/XX-realmname.md`
2. Understand the intended vulnerability
3. Test exploit before and after changes
4. Update documentation if behavior changes

---

## Testing Requirements

### Test Coverage

**Minimum Requirements:**
- Gatekeeper: ≥70% line coverage
- Flag Oracle: ≥70% line coverage
- Realms: Coverage for non-challenge code only

### Test Pyramid

```
     E2E Tests (Few)
   Integration Tests (Some)
 Unit Tests (Many)
```

### Writing Tests

**Unit Tests:**
```typescript
// gatekeeper/src/services/__tests__/auth-service.test.ts
import { AuthService } from '../auth-service';

describe('AuthService', () => {
  let authService: AuthService;
  
  beforeEach(() => {
    authService = new AuthService(mockRepository);
  });
  
  it('should authenticate valid credentials', async () => {
    const result = await authService.authenticate('user', 'pass');
    expect(result).toBeDefined();
    expect(result.username).toBe('user');
  });
  
  it('should reject invalid credentials', async () => {
    await expect(
      authService.authenticate('user', 'wrong')
    ).rejects.toThrow('Invalid credentials');
  });
});
```

**Integration Tests:**
```bash
# scripts/test-realm.sh
#!/bin/bash
set -e

# Test realm accessibility
response=$(curl -s http://localhost:8080/realm/realm-name/)
if echo "$response" | grep -q "expected-content"; then
  echo "✅ Realm accessible"
else
  echo "❌ Realm not accessible"
  exit 1
fi

# Test exploit
# ... exploit steps ...

# Verify flag
if echo "$response" | grep -q "YGGDRASIL"; then
  echo "✅ Flag retrieved"
else
  echo "❌ Flag not found"
  exit 1
fi
```

### Running Tests

**Before submitting PR:**
```bash
# Run all tests
make test

# Run specific tests
cd gatekeeper && npm test
cd flag-oracle && npm test
./scripts/test-niflheim.sh

# Check coverage
npm test -- --coverage
```

---

## Documentation

### What to Document

**Always document:**
- New features or endpoints
- API changes
- Configuration changes
- Breaking changes
- Migration procedures

**Update when changing:**
- Environment variables → `.env.example`, `QUICK_REFERENCE.md`
- API endpoints → `QUICK_REFERENCE.md`, OpenAPI spec (if exists)
- Realm behavior → `.docs/realms/XX-realm.md`

### Documentation Standards

**Markdown:**
- Use headers for structure
- Code blocks with language specification
- Tables for comparisons
- Links to related docs

**Example:**
```markdown
# Feature Name

## Overview
Brief description of the feature.

## Usage

**Endpoint:** `POST /api/endpoint`

**Request:**
```json
{
  "param": "value"
}
```

**Response:**
```json
{
  "status": "success"
}
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `VAR_NAME` | Description | `default` |
```

---

## Pull Request Process

### Before Submitting

**Checklist:**
- [ ] Code follows style guidelines
- [ ] All tests pass locally
- [ ] New tests added for new functionality
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] No secrets or credentials in code
- [ ] Exploit paths still work (if realm modified)

### PR Description Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe how you tested your changes.

## Checklist
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No linting errors
- [ ] Follows coding standards

## Related Issues
Fixes #123
```

### Review Process

1. **Automated Checks:**
   - CI pipeline runs
   - Tests must pass
   - Linting must pass
   - Coverage must meet threshold

2. **Code Review:**
   - At least one approval required
   - Address all comments
   - No "LGTM" without review

3. **Merge:**
   - Squash commits (if many small commits)
   - Rebase onto main
   - Delete branch after merge

### CI/CD Pipeline

**Automated Checks:**
- Linting (ESLint, Prettier)
- Unit tests with coverage
- Integration tests
- Security tests
- Docker build validation

**If CI Fails:**
- Check logs
- Fix issues
- Push fixes
- Wait for re-run

---

## Issue Guidelines

### Reporting Bugs

**Template:**

```
## Bug Description
Clear description of the bug.

## Steps to Reproduce
1. Step one
2. Step two
3. ...

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Environment
- OS: [e.g., Ubuntu 22.04]
- Docker version: [e.g., 24.0.0]
- Node version: [e.g., 18.16.0]

## Logs
Relevant log output (if any).

## Screenshots
If applicable.

```

### Feature Requests

**Template:**

```
## Feature Description
Clear description of the proposed feature.

## Use Case
Why is this feature needed?

## Proposed Solution
How should it work?

## Alternatives Considered
Other approaches you've thought about.

## Additional Context
Any other relevant information.
```

### Security Issues

**DO NOT create public issues for security vulnerabilities!**

Instead:
- Email kirumachi@proton.me
- Use private disclosure
- Follow responsible disclosure

---

## Additional Resources

- **Developer Guide:** `.docs/DEVELOPER_ONBOARDING.md`
- **Operator Guide:** `.docs/workflows/OPERATOR_GUIDE.md`
- **Quick Reference:** `.docs/workflows/QUICK_REFERENCE.md`
- **Realm Docs:** `.docs/realms/`

---

## Questions?

- Check documentation first
- Search existing issues
- Ask in discussions
- Reach out to maintainers

---

**Thank you for contributing to Project Yggdrasil!**

**Last Updated:** 2025-12-11
