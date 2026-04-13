# Changelog

All notable changes to @foxhound-ai/sdk will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-04-13

### Fixed
- Updated all documentation URLs to correct domains:
  - Documentation: https://docs.foxhound.caleb-love.com
  - Homepage: https://foxhound.caleb-love.com
  - Email: foxhound@caleb-love.com
- Added `homepage` and `bugs` fields to package.json

## [0.2.0] - 2026-04-13

### Added

#### Prompt Management
- **`fox.prompts.get({ name, label })`** - Resolve prompts by name and label with automatic client-side caching
- Support for production/staging/custom labels
- Configurable 5-minute TTL cache (default)
- Cache invalidation API via `fox.prompts.invalidate()`

#### Agent Intelligence APIs
- **Cost Budgets** - Set spending limits per agent with alert thresholds
  - `fox.budgets.set({ agentId, costBudgetUsd, costAlertThresholdPct, budgetPeriod })`
  - `fox.budgets.get(agentId)` - Get current budget configuration
  - `fox.budgets.list()` - List all budgets
  - `fox.budgets.delete(agentId)` - Remove budget
- **SLA Monitoring** - Define performance contracts for agents
  - `fox.slas.set({ agentId, maxDurationMs, minSuccessRate, evaluationWindowMs })`
  - `fox.slas.get(agentId)` - Get SLA configuration
  - `fox.slas.list()` - List all SLAs
  - `fox.slas.delete(agentId)` - Remove SLA
- **Regression Detection** - Compare agent versions to detect behavioral regressions
  - `fox.regressions.compare({ agentId, versionA, versionB })`
  - `fox.regressions.baselines(agentId)` - Get all baseline versions
  - `fox.regressions.deleteBaseline({ agentId, version })`
- **Budget Exceeded Callback** - Real-time notifications when agents exceed cost budgets
  - `onBudgetExceeded` callback option in client constructor
  - Receives `{ agentId, currentCost, budgetLimit }` on budget breach

#### Datasets & Experiments
- **Datasets** - Create golden test sets for agent evaluation
  - `fox.datasets.create({ name, description })`
  - `fox.datasets.addItems(datasetId, items)` - Add test cases manually
  - `fox.datasets.fromTraces(datasetId, { traceIds })` - Build datasets from production traces
  - `fox.datasets.list()`, `fox.datasets.get(id)`, `fox.datasets.delete(id)`
- **Experiments** - Run evaluations against datasets and compare results
  - `fox.experiments.create({ datasetId, name, config })`
  - `fox.experiments.compare(experimentIds)` - Compare multiple runs
  - `fox.experiments.list({ datasetId })`, `fox.experiments.get(id)`, `fox.experiments.delete(id)`

#### Trace Propagation
- **`fox.getPropagationHeaders({ correlationId, parentAgentId })`** - Generate headers for distributed tracing across agent boundaries

### Changed
- Improved type exports for `BudgetExceededInfo` and `ResolvedPrompt`
- Enhanced client initialization with new optional configuration

## [0.1.0] - 2026-04-08

### Added
- Initial SDK release
- Core trace collection and span recording
- OpenTelemetry bridge via `FoxhoundSpanProcessor`
- Claude Agent SDK integration
- Mastra framework support
- Score creation API via `fox.scores.create()`
- Session replay support via trace metadata

### Features
- TypeScript-first with full type safety
- Auto-batching and flush management
- Flexible span attributes and metadata
- Framework-agnostic design with OTel compatibility

## [0.0.1] - 2026-04-08

### Added
- Initial package scaffold
- Basic client structure
