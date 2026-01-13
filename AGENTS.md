# Agent Guidelines

## Project Overview
- `app/` contains the main application sources.
- The app is built with Rust + Tauri.
- Frontend: `app/src/` (Vue.js).
- Backend: `app/src-tauri/` (Rust).
- Package manager: Bun.

## Repository Layout
- `app/`: application code.
- `build-dir/`: Flatpak build-specific directory (git ignored).
- `dist/`: distribution artifacts such as Linux desktop files.
- `flatpak-repo/`: Flatpak build repository (git ignored).
- `scripts/`: helper scripts (e.g., release automation).
- `test-project/`: test apps in multiple languages used for validation.

## Workflow Rules
- Before implementing changes, create a branch off `main` and ensure it is up to date.
- Implement the feature or fix, then commit with clean messages using prefixes like `feat`, `fix`, `chore`, etc.
- Add unit tests for newly added code; focus on covering new behavior without excessive tests.
- If there are modified files in the repository, do not revert them. Ask whether to stash, commit, or revert (in that order).

## Build Instructions
- Install dependencies with `bun install` from the repository root.
- Run the frontend build with `bun run build` from `app/`.
- Build the Tauri app with `bun run tauri build` from `app/`.

## Test Instructions
- Run unit tests with `bun run test` (Vitest).
