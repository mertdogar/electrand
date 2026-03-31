# Electrand

A modern desktop application for managing projects, built with Electron and React.

![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Project Management** -- Create, open, and organize projects with persistent metadata
- **Custom Titlebar** -- Native-feeling window controls with platform-aware styling (macOS traffic lights, Windows controls)
- **Command Palette** -- Quick navigation and actions via `Cmd/Ctrl+K`
- **Preferences** -- Theme switching (dark/light), font size, configurable data directory
- **Local Storage** -- Projects stored as JSON files, app state in SQLite (WAL mode)
- **Resizable Panels** -- Flexible sidebar and content layout

## Tech Stack

| Layer | Tools |
|-------|-------|
| **Desktop** | Electron 41, Electron Forge |
| **Frontend** | React 19, TanStack Router (file-based), TanStack Query |
| **Styling** | Tailwind CSS 4, shadcn/ui, Radix UI |
| **Database** | better-sqlite3 |
| **Validation** | Zod |
| **Build** | Vite 8 |
| **Quality** | oxlint, oxfmt, Vitest |

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm

### Install & Run

```bash
npm install
npm start
```

### Build

```bash
npm run make       # Create distributable packages
npm run package    # Create unpacked app directory
```

### Code Quality

```bash
npm run lint           # Lint with oxlint
npm run format         # Format with oxfmt
npm run format:check   # Check formatting
npm test               # Run tests
```

## Project Structure

```
src/
  main/              Electron main process
    handlers/        IPC handlers (projects, preferences, app state, window)
    db.ts            SQLite database operations
    projects.ts      File system project management
  renderer/          React frontend
    components/      UI components (titlebar, sidebar, command palette)
    hooks/           Custom hooks (projects, preferences, IPC invalidation)
    routes/          File-based routes (TanStack Router)
  shared/            Shared Zod schemas and types
```

## Architecture

**IPC Bridge** -- Type-safe communication between main and renderer processes with typed invoke/push payloads.

**Data Layer** -- Projects are stored as JSON files in the user's home directory (one UUID-named folder per project). App state and preferences live in a SQLite database with WAL mode enabled.

**Query Invalidation** -- React Query caches are invalidated via IPC push events from the main process, keeping UI in sync across windows.

**Security** -- Electron Fuses enabled for cookie encryption and ASAR integrity.

## License

MIT
