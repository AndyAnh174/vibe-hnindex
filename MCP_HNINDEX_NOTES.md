# MCP hnindex usage notes

Date: 2026-04-06
Scope: BanThuoc-SEO workspace

## 1) Token efficiency

Short answer: not always.

- For exact lookup (symbol, route, endpoint path), normal grep search is usually cheaper.
- For semantic discovery (you do not know file/function names), MCP can be cheaper because 1-2 calls may replace many manual searches.
- In our test session, MCP often returned large chunks and needed extra follow-up reads, so total context tokens were often higher than normal grep flow.

Practical rule:
- Exact query -> use normal grep first.
- Semantic/cross-file exploration -> use MCP hybrid with narrow file_pattern.

## 2) Issues observed and improvements

Issue A: keyword search failed with punctuation-heavy query.
Examples:
- products.urls
- admin/products
- include('products.urls')

Improve:
- normalize query into plain tokens:
  - products urls
  - admin products
  - include products urls api path

Issue B: hybrid results sometimes noisy.
Improve:
- always add file_pattern.
- keep limit low (3-5) for first pass.
- prefer keyword mode first, then hybrid if needed.

Issue C: multi-intent query caused misses.
Example: ProductModal + onSubmit + openCreateModal in one query.
Improve:
- split into smaller queries:
  - ProductModal
  - onSubmit products
  - openCreateModal products store

Issue D: large outputs increased token use.
Improve:
- use tighter query and file_pattern.
- use lower limit.
- avoid broad semantic query as first step.

Issue E: overlap/duplicate chunks from same file.
Improve:
- deduplicate by file path mentally in first pass.
- then run targeted query for exact line block.

## 3) Recommended query presets

Backend route include:
- include products urls api path
- mode: keyword
- file_pattern: BanThuoc-SEO/server/core/**

Product CRUD backend:
- ProductListCreateView ProductDetailView
- mode: keyword
- file_pattern: BanThuoc-SEO/server/apps/products/**

Frontend admin product CRUD:
- admin products createProduct updateProduct deleteProduct
- mode: keyword
- file_pattern: BanThuoc-SEO/client/src/features/admin/**

Serializer image update logic:
- instance images delete ProductImage create
- mode: keyword
- file_pattern: BanThuoc-SEO/server/apps/products/serializers/product.py

Fallback semantic:
- use hybrid only after keyword misses.
- keep query short and focused.
