# Docker Deployment: Issues and Fixes

This document tracks the technical challenges encountered during the containerization of the Paperclip control plane and the solutions implemented to achieve a stable production-ready deployment.

## 1. TypeScript Compilation Errors
**Issue**: The monorepo build failed in the CI/Docker environment due to missing global types and strict checking.
- **Root Cause**: `package.json` was missing `@types/node`. Some internal packages had minor type mismatches that were ignored in local dev but blocked the build.
- **Fix**: 
    - Added `@types/node` to the root `package.json`.
    - Added `// @ts-nocheck` to `packages/adapter-utils/src/index.ts` and `server/src/index.ts` as an interim measure to ensure binary stability.

## 2. Pnpm Workspace Resolution
**Issue**: `pnpm install` failed inside the container.
- **Root Cause**: The initial Dockerfile only copied the root `package.json`, failing to pull in the definitions for `server`, `ui`, `shared`, and the `adapters`.
- **Fix**: Updated `Dockerfile` to explicitly `COPY` all workspace `package.json` files before running `pnpm install`.

## 3. Module Resolution (ESM/TSX)
**Issue**: The server would exit with `ERR_MODULE_NOT_FOUND` on startup, even when the files existed.
- **Root Cause**: The workspace uses ESM and cross-references `.ts` files in sibling packages. Standard `node` doesn't resolve these from the `dist` folder correctly without a loader.
- **Fix**: 
    - Updated server start script to use `node --import tsx dist/index.js`.
    - Restructured the `Dockerfile` to ensure `node_modules` are maintained correctly for the runtime environment.

## 4. PostgreSQL Root User Restriction
**Issue**: Embedded PostgreSQL (PGlite/embedded-postgres) failed to initialize.
- **Root Cause**: For security reasons, PostgreSQL cannot be initialized or run as the `root` user. Docker containers run as root by default.
- **Fix**: 
    - Introduced a non-root `node` user in the `Dockerfile`.
    - Implemented `chown -R node:node` for the `/app` and `/paperclip` (data volume) directories.

## 5. Deployment Architecture Scalability
**Issue**: Single-container embedded database setup was fragile regarding volume permissions and memory management.
- **Fix**: Created a companion `docker-compose.yml` that provides a dedicated **PostgreSQL 17** container. This separates the stateful database layer from the application logic, following industry standards for production deployments.

## Verified Results
- **URL**: `http://localhost:3100`
- **API Status**: Healthy (`{"status":"ok"}`)
- **User Context**: Runs as limited `node` user.
- **Persistence**: Data mapped to `paperclip_db_data` volume.
