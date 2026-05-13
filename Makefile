.PHONY: lint format check

lint: ## Run linters without fixing
	cd server && uv run ruff check .
	cd client && npm run lint

format: ## Auto-fix formatting and lint issues
	cd server && uv run ruff format . && uv run ruff check --fix .
	cd client && npm run format

check: ## Check lint + formatting without fixing (use in CI)
	cd server && uv run ruff check . && uv run ruff format --check .
	cd client && npm run lint && npm run format:check
