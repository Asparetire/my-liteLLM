# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Setup and Installation
- `make bootstrap` - Provision a fresh clone/worktree, install dependencies, generate Prisma client
- `make install-dev` - Install development dependencies (uv sync --inexact --frozen)
- `make install-proxy-dev` - Install proxy development dependencies only
- `make install-test-deps` - Install full local test environment
- `make install-hooks` - Install git hooks for Conventional Commits + Branches

### Development Workflow
- `make bootstrap` or `make install-dev` before first use
- `make format` - Apply ruff code formatting (120-char line limit)
- `make format-check` - Check formatting only
- `make lint` - Run all linting: Ruff, basedpyright budgets, circular imports, import safety
- `make lint-dev` - Faster local linting for changed files only
- `make check` - CI-equivalent check on staged changes or diff vs base branch

### Testing
- `make test` - Run all tests (tests/)
- `make test-unit` - Run unit tests (tests/test_litellm) with pytest
- `make test-unit-llms` - LLM provider tests (~225 files in tests/test_litellm/llms)
- `make test-unit-proxy-guardrails` - Proxy guardrails + management endpoints (~51 files)
- `make test-unit-proxy-core` - Auth, client, DB, hooks tests (~52 files)
- `make test-unit-proxy-misc` - Miscellaneous proxy features (~77 files)
- `make test-unit-integrations` - Integration tests (~60 files)
- `make test-unit-core-utils` - Core utils tests (~32 files)
- `make test-unit-other` - Other tests: caching, responses, etc. (~69 files)
- `make test-proxy-unit-a` - Proxy unit tests a-o
- `make test-proxy-unit-b` - Proxy unit tests p-z
- Run single test file directly: `uv run --no-sync pytest -xvs path/to/test_file.py`

### Linting Details
- `make lint-ruff` - Ruff linting only (TID, FLY, etc.)
- `make lint-basedpyright` - Strict type checking with per-rule error budgets
- `make lint-e2e-basedpyright` - Type checks for tests/e2e only (zero errors)
- `make lint-type-discipline` - Mutable collections, casts, type guards, kwargs, suppressions
- `make lint-test-quality` - Test quality rules: zero-assert limits, mock-echo, raw env writes
- `make lint-budget-update` - Ratchet all budgets down by what this branch fixed

### Proxy Server Commands
- Run proxy backend (dev mode): `uv run python litellm/proxy/proxy_cli.py --model gpt-4o --use_verbose_proxy_logging --reload --detailed_debug`
- Run dashboard: `cd ui/litellm-dashboard && npm run dev`
- Start dependent services: `docker-compose up db prometheus`

## Architecture

### Repository Structure
- `litellm/` - Core Python SDK module
  - Provider adapters in `litellm/providers/` for each LLM endpoint
  - Routing logic in `litellm/router_strategy/`
  - Caching implementations in `litellm/caching/`
  - Cost calculation in `litellm/cost_calculator.py`
- `litellm/proxy/` - Proxy server (FastAPI backend)
  - Endpoint handlers per feature (guardrails, auth, spend tracking, etc.)
  - `litellm/proxy/ui_crud_endpoints/` - Admin dashboard API layer
  - `litellm/proxy/spend_tracking/` - Cost management and virtual keys
- `tests/test_litellm/` - SDK unit tests (parallel structure to litellm/)
- `tests/proxy_unit_tests/` - Proxy-specific unit tests, split alphabetically
- `tests/e2e/` - End-to-end integration tests requiring running proxy instance
- `deploy/` - Deployment configurations and Terraform modules

### Key Architecture Patterns
1. **Provider adapters** in litellm/providers follow a common pattern:
   - Parse incoming request to provider-specific format
   - Transform response back to OpenAI-compatible format
   - Handle streaming via async iteration with optional `stream_options` passthrough

2. **Routing** via RouterStrategy abstraction in litellm/router_strategy/:
   - Implement per-strategy (auto_router, load_balancer, etc.)
   - Router manages multiple endpoint deployments with retry/fallback logic

3. **Caching** via Cache abstraction in litellm/caching/:
   - Implementations: memory, disk, Redis, S3, Azure Blob, GCS
   - Supports both key-based LRU and semantic embedding caches (Qdrant)

4. **Guardrails** implemented as middleware hooks:
   - Pre-prompt injection points for moderation
   - Post-response validation for output filtering
   - Enterprise features support configurable policy enforcement

## Coding Guidelines

### Code Quality Standards
- Follow Google Python Style Guide (120-char max line length)
- Composition over inheritance; use tagged unions + match
- Dependency injection preferred over subclassing
- No mutation of function parameters, globals, or module-level variables
- Prefer tuples/frozen dataclasses/MappingProxyType for immutable data

### Type Discipline
- Fully typed code; ban Any and dict[str, Any]
- Use Pydantic validation in caller when relying on untyped stuff
- Annotate every variable with : Final (implicit at unpacking/walrus)
- Qualify TypedDict fields with ReadOnly[field_name], nested freely with Required/NotRequired
- Suppress mutations with # mutable-ok: <reason> only as last resort

### Test Writing Rules
- One focused regression test beats many shallow ones
- Tests must fail before fix is added, succeed only when fully working
- Target >90% mutation kill rate (tests should actually catch bugs)
- Extend existing mapped test file for bug fixes; create new file only for new features without mapping
- End-to-end tests belong in tests/e2e/ with harness conventions
- Never test implementation structure; test functional behavior

### PR Requirements
- Target repository default branch: `python scripts/default_branch.py --branch`
- Branches prefixed with litellm_, never claude/ or / in names
- Conventional commits for commit messages
- Follow rules in .github/pull_request_template.md
- Include live proof of fix: curl commands hitting localhost:4000 proxy, not mocks
- Resolve linear tickets in PR description (e.g. "Resolves LIT-1234")

### Human-Facing Text Guidelines
- No emojis
- Avoid em dashes (—); use commas, periods, conjunctions instead
- Don't use "It's not X, it's Y" pattern
- Prefer prose over bulleted lists unless explicitly requested
- No trailing "." at end of paragraphs
- Use plain engineering language; avoid arrows like →
- Keep GitHub comments to 15-25 words max

### Security Rules
- Never pipe remote scripts (curl ... | bash, wget ... | sh)
- Verify SHA-256 checksums for all downloaded binaries
- Pin external tools to specific versions with full URLs
- Docker images signed with cosign using key from commit 0112e53

### Git Branch Management (本地管理)
**分支模型（铁律）**：
- `main`：上游镜像，永不携带自有改动。保证 `git merge --ff-only upstream/main` 永远成功
- `develop`：自有改动的集成基线，所有功能分支从它切出
- `feat/*`：功能分支，命名格式 `feat/<需求编号>-<简短描述>`（如 `feat/i18n-ui`, `feat/token-billing-a`）

**日常操作**：
```bash
# 更新上游
git checkout main && git fetch upstream && git merge --ff-only upstream/main

# 开发功能
git checkout -b feat/<新需求>

# 完成后合回 develop
git checkout develop && git merge feat/<分支名> && git push origin develop --delete feat/<分支名>
```

**本地管理方案**：
- `.git-hooks/`：Git 钩子目录（pre-commit 检查）
- `docs/zh-CN/`：中文文档，独立演进待批量合并
- 不可触碰清单：API 字段、数据库列、代码标识符全部保持英文
- Prisma 迁移红线：只加 nullable 列，禁止 UPDATE/DELETE/MERGE

### Supply Chain Safety
- Prisma migrations must only change schema, never rewrite rows (no UPDATE/DELETE/MERGE)
- tests/code_coverage_tests/check_migrations_no_data_rewrites.py enforces this
- Mark bounded rewrites in migrations with -- data-migration-ok: <what bounds it>

## Terraform Modules

Production deployment stacks live in terraform/litellm/{aws,gcp}/ and are published to Terraform Registry:
- BerriAI/litellm/aws - AWS ECS Fargate + Aurora + ElastiCache + ALB
- BerriAI/litellm/google - GCP Cloud Run + Cloud SQL + Memorystore + HTTPS LB

Both include componentized architecture (gateway/backend/UI as independent services), managed Postgres/Redis/object store, auto-generated LITELLM_MASTER_KEY in cloud secret manager, and one-off migration job running prisma migrate deploy before proxy starts.

## Budget Files

Never edit these on PR branches; scheduled automation lowers default branch limits in its own PR:
- .claude/budgets/ruff-strict-budget.json
- .claude/budgets/type-discipline-budget.json  
- .claude/budgets/basedpyright-code-budget.json
- .claude/budgets/test-quality-budget.json

Run make lint-budget-update only on default branch to ratchet all budgets down by what landed.

## LLM Translation Testing

For testing model response translations, use the dedicated harness:
- `make test-llm-translation` - Run all LLM translation tests
- `make test-llm-translation-single FILE=test_filename.py` - Run single file
- See .github/scripts/run_llm_translation_tests.py for details

## Documentation

Documentation moved to BerriAI/litellm-docs repo. Open doc PRs there; docs served at docs.litellm.ai.
