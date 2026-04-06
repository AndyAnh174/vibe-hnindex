# MCP HNINDEX Bug Report and Optimization Backlog

## Scope

This file contains detailed, actionable bug reports and optimization priorities extracted from `MCP_HNINDEX_NOTES.md`.

## MCP-BUG-001: keyword search fails on punctuation-heavy exact query

Severity: High

Repro:
- products.urls
- include('products.urls')
- admin/products

Expected:
- return relevant files containing exact punctuation patterns.

Actual:
- No results found (keyword search failed).

Suspected root cause:
- tokenizer/parser drops punctuation or fails to normalize punctuation tokens in keyword mode.

Fix ideas:
- add query normalization pipeline before keyword search:
  - replace punctuation with spaces
  - generate token variants automatically
- optional: maintain a secondary exact-text index for punctuation/path queries.

## MCP-BUG-002: keyword query with multiple intent terms can under-return

Severity: Medium

Repro:
- ProductModal onSubmit (scoped to admin/components)

Expected:
- at least product-modal.tsx result.

Actual:
- sometimes no result, while split query works:
  - product modal
  - onSubmit product modal

Suspected root cause:
- boolean matching too strict in combined query (all tokens hard-required without relaxation).

Fix ideas:
- use staged retrieval:
  - strict AND first
  - fallback to soft OR + rerank when empty
- add query expansion with term proximity boosting.

## MCP-BUG-003: semantic/hybrid can rank noisy generated/vendor-like files too high

Severity: High

Repro:
- where update product images logic (hybrid)

Expected:
- prioritize app source files with update logic.

Actual:
- large/noisy hits can appear (example: bundled/static code chunks), reducing precision.

Suspected root cause:
- path-level quality weighting not strong enough; generated assets not sufficiently down-ranked.

Fix ideas:
- apply default path penalties/denylist for generated assets:
  - **/.next/**
  - **/dist/**
  - **/build/**
  - **/staticfiles/**
- boost likely source folders (src, app, server/apps).

## MCP-BUG-004: oversized result payload increases token cost

Severity: Medium

Repro:
- broad hybrid query returns very large content.txt outputs.

Expected:
- concise snippet around matched lines.

Actual:
- long chunks requiring additional trimming/reads.

Suspected root cause:
- chunk/window size too large by default for chat workflows.

Fix ideas:
- cap snippet length per hit.
- return focused excerpts (matched lines +/- small context).
- expose small/medium/large output profiles.

## MCP-BUG-005: occasional immediate "project not found" after successful index

Severity: Low-Medium

Repro:
- call project_stats right after index_codebase completion.

Expected:
- stats available immediately.

Actual:
- one-off "Project not found" can occur, retry succeeds.

Suspected root cause:
- commit/visibility race between index completion and metadata read path.

Fix ideas:
- ensure index_codebase returns only after metadata transaction is fully committed and visible.
- or provide "index_ready" handshake/status.

## Optimization priorities (recommended order)

Priority 1 (highest impact):
- robust query normalization for keyword mode (punctuation/slash/dot tolerant).
- fallback strategy when strict query yields zero hits.

Priority 2:
- ranking improvements with path-quality weights and generated-file down-rank.
- better dedup and source-first scoring.

Priority 3:
- output-size control to reduce token usage.
- compact snippet mode as default for chat.

Priority 4:
- post-index readiness guarantee to remove transient not-found race.

## v0.3.2 — partial mitigations (tracked items)

- **002** — OR fallback after zero-hit AND when ≥2 tokens (`buildFtsOrQuery` + second `searchKeyword`).
- **003** — path-quality multiplier on `dist/`, `.next/`, `build/`, `coverage/`, `*.min.js`, `node_modules` (toggle `deprioritize_generated_paths`).
- **004** — default `content_mode: compact` + `max_content_chars` / Unicode-safe truncate.
- **005** — `getProjectWithRetry` in `project_stats`.

## Extra .hnindexignore suggestions for this workspace

Add if not needed for search:
- **/.next/**
- **/staticfiles/**
- **/static/**
- **/*.min.js
- **/*.map

Reason:
- improve precision and reduce indexing/storage cost.
