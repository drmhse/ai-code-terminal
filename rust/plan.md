# Project Migration Plan: Node.js to Rust

This document outlines the plan for migrating the AI Code Terminal backend from Node.js to Rust, and simultaneously transforming the frontend into a fully independent, static Single-Page Application (SPA) using Vue.js.

The new architecture will consist of two decoupled components:
1.  **A Static Vue.js Frontend:** A modern, interactive web application deployable to any static hosting service (Netlify, Vercel, S3, etc.).
2.  **A Lightweight Rust Backend:** A high-performance, self-contained binary serving a pure JSON API and a WebSocket server for real-time terminal communication.

This approach fully embraces the project's philosophy of sovereignty and resource efficiency, resulting in a more robust, scalable, and flexible system.

---

## 1. Core Objectives

-   **Full Decoupling:** Separate the frontend and backend into independently deployable units.
-   **Maximum Performance:** Leverage Rust for a minimal-footprint, highly concurrent backend.
-   **Enhanced Reliability:** Utilize Rust's compile-time safety and `sqlx`'s compile-time query checking to eliminate entire classes of runtime errors.
-   **Modern Frontend:** Evolve the UI into a stateful, responsive Vue 3 SPA with a superior developer experience.
-   **Simplified Deployment:** The backend compiles to a single, portable binary. The frontend is a set of static files.

---

## 2. Technology Stack

### Backend

| Category | Recommended Rust Crate(s) | Justification |
| :--- | :--- | :--- |
| **Async Runtime** | `tokio` | The de-facto standard for asynchronous Rust, required by the entire web stack. |
| **Web Framework** | `axum` | A highly ergonomic and modular framework for building the JSON API. |
| **Real-time Layer** | `socketioxide` | A direct Socket.IO protocol implementation that integrates seamlessly with `axum`. |
| **Database Toolkit** | `sqlx` & `sqlx-cli` | Provides compile-time checked SQL queries against the database, ensuring correctness and performance without a heavy ORM. `sqlx-cli` will be used for managing migrations. |
| **Terminal Emulation** | `portable-pty` | The standard, cross-platform library for creating and managing pseudo-terminals. |
| **Authentication** | `jsonwebtoken` & `oauth2` | The standard crates for handling JWTs and the GitHub OAuth2 flow. |
| **Configuration** | `figment` & `serde` | A powerful configuration framework that merges environment variables and `.env` files into strongly-typed Rust structs. |
| **Logging** | `tracing` | A modern, structured, and async-aware logging framework. |
| **Error Handling** | `thiserror` & `anyhow` | The idiomatic pair for creating specific, library-level errors and handling general application-level errors, respectively. |

### Frontend

| Category | Recommended Library | Justification |
| :--- | :--- | :--- |
| **Framework** | Vue 3 (with Vite) | A progressive, high-performance framework. The existing frontend code already uses Vue, making this a natural evolution. |
| **Language** | TypeScript | Ensures type safety and improves maintainability of the growing frontend codebase. |
| **Routing** | `vue-router` | The official router for Vue.js, necessary for a multi-view SPA. |
| **State Management** | `pinia` | The official, lightweight, and intuitive state management library for Vue 3. |
| **Real-time Client** | `socket.io-client` | The official client library for connecting to the `socketioxide` backend. |

---

## 3. Project Structure

The project will be a Cargo Workspace for the backend, with the frontend as a separate, standard Vite project.

```
rust/
├── Cargo.toml                   # Workspace definition for backend crates
├── crates/
│   ├── act-server/              # Main application crate (the binary)
│   │   ├── migrations/          # [NEW] SQLx database migration files
│   │   └── src/
│   │       ├── main.rs
│   │       ├── routes/          # API route handlers
│   │       ├── socket.rs        # WebSocket handlers
│   │       ├── services/        # Business logic (PTY, Workspace, etc.)
│   │       ├── models.rs        # Database model structs (`sqlx::FromRow`)
│   │       ├── middleware.rs
│   │       └── config.rs
│   └── act-core/                # Shared library crate (optional, good practice)
│       └── src/
│           ├── db.rs            # Database connection pool setup
│           └── error.rs
├── frontend/                    # A standard Vite + Vue 3 + TS project
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/          # Reusable Vue components (e.g., modals, buttons)
│   │   ├── views/             # Page-level components (e.g., Login.vue, Dashboard.vue)
│   │   ├── services/          # API and WebSocket client logic
│   │   ├── router/            # Vue Router configuration
│   │   ├── stores/            # Pinia state stores
│   │   ├── App.vue
│   │   └── main.ts
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── Dockerfile                   # Multi-stage Dockerfile for the Rust backend
└── .env.example
```

---

## 4. Migration Plan

### Phase 1: Frontend Migration (Decoupling)

This phase focuses on transforming the EJS-based views into a self-sufficient Vue SPA.

1.  **Scaffold New Project:** Initialize a new `vite-vue-ts` project inside the `frontend/` directory.
2.  **Componentization:** Convert the existing EJS partials into Vue components.
    -   `views/layout.ejs` -> `src/App.vue` (main application shell).
    -   `views/partials/login.ejs` -> `src/views/Login.vue`.
    -   `views/partials/main-app.ejs` -> `src/views/Dashboard.vue`.
    -   `views/partials/sidebar.ejs`, `modals.ejs`, `status-bar.ejs`, etc. -> Reusable components in `src/components/`.
3.  **Implement Routing:** Set up `vue-router` to handle navigation between `/login`, `/dashboard`, and a new `/auth/callback` route for handling the OAuth redirect.
4.  **Implement State Management:** Use `pinia` to manage global application state:
    -   `authStore`: Manages authentication status, JWT, and user info.
    -   `workspaceStore`: Manages the list of workspaces and the currently selected workspace.
    -   `terminalStore`: Manages terminal sessions, layouts, and active panes.
5.  **Create API & WebSocket Services:**
    -   Implement a service (`src/services/api.ts`) using `axios` or `fetch` to communicate with the (yet to be built) Rust API. It will handle adding the JWT to headers.
    -   Implement a service (`src/services/socket.ts`) to manage the `socket.io-client` connection, authentication, and event handling.
6.  **Update Authentication Flow:** The `/auth/callback` route will now be a frontend route. It will read the token from the URL, save it to local storage via the `authStore`, and redirect to the main dashboard.

### Phase 2: Backend Migration (API & Real-time Server)

This phase runs in parallel with Phase 1, building the new Rust backend.

1.  **Setup & Foundation:**
    -   Initialize the Cargo Workspace and crates (`act-server`, `act-core`).
    -   Implement configuration loading with `figment` and logging with `tracing`.
2.  **Database Migration with SQLx:**
    -   Install `sqlx-cli`.
    -   Create an initial SQL migration file (`migrations/0001_initial_schema.sql`) that defines the tables based on the old `schema.prisma`.
    -   Set up a database connection pool in `act-core` and run the migrations using `sqlx-cli`.
    -   Define Rust structs for your data models (e.g., `Workspace`, `Session`) in `act-server/src/models.rs` and derive `sqlx::FromRow` for them.
3.  **Implement API Server:**
    -   Set up the `axum` router in `main.rs`.
    -   Implement all API endpoints as pure JSON services. For example, `GET /api/workspaces` will now execute a compile-time checked SQL query and return `axum::Json<Vec<Workspace>>`.
    -   Port the GitHub OAuth and JWT logic. The callback handler will now redirect to the frontend's `/auth/callback` route.
4.  **Implement WebSocket & PTY Server:**
    -   Layer `socketioxide` onto the `axum` router.
    -   Create a stateful `PtyService` using `portable-pty` to manage shell processes. This service will be shared across WebSocket connections using `Arc<Mutex<...>>`.
    -   Port all Socket.IO event handlers from the Node.js version to Rust, delegating logic to the `PtyService`.

### Phase 3: Integration & Deployment

1.  **CORS Configuration:** Configure CORS on the `axum` backend to allow requests from the frontend's deployment domain (e.g., `https://act.example.com`).
2.  **Containerize Backend:** Finalize the multi-stage `Dockerfile` to produce a small, secure, production-ready image for the Rust binary.
3.  **Deploy:**
    -   Deploy the static `frontend/dist` directory to a service like Netlify, Vercel, or Cloudflare Pages.
    -   Deploy the backend Docker container to a service like Fly.io, Render, or any VPS.
    -   Configure the frontend's environment variables to point to the backend's API URL.

---

## 5. Key Decision-Making Strategy

This plan contains ambiguities that must be fleshed out during implementation. The following points outline key decisions and the recommended approach.

-   **Decision: Frontend Component Library?**
    -   **Context:** Should we use a UI library like PrimeVue/Quasar or build custom components?
    -   **Strategy:** **Build custom components.** The application's UI is highly specialized. Using a full library adds unnecessary bloat and complexity. Stick to the project's philosophy of being lightweight. Use a utility-class CSS framework like Tailwind CSS if needed to accelerate styling.

-   **Decision: Deployment Architecture?**
    -   **Context:** Should the Rust server also serve the static frontend files, or should they be deployed separately?
    -   **Strategy:** **Deploy separately (Recommended).** This provides the best separation of concerns, scalability, and performance. Deploy the Vue SPA to a global CDN (Netlify/Vercel) for fast initial loads, and deploy the Rust backend to a compute-optimized host (Fly.io/Render). However, the Rust server **should still include the capability to serve the static files** as a fallback for users who want to run everything from a single, simple binary on their own server.

-   **Decision: API Versioning?**
    -   **Context:** Should the API be versioned from the start (e.g., `/api/v1/...`)?
    -   **Strategy:** **Yes.** Start with `/api/v1/`. This is a best practice that costs nothing to implement initially and provides future flexibility.

-   **Decision: Database Schema Management?**
    -   **Context:** How to handle schema changes after the initial migration from Prisma?
    -   **Strategy:** **Use `sqlx-cli` for all future schema changes.** The workflow will be:
        1.  Create a new migration file: `sqlx migrate add <migration_name>`.
        2.  Write the `UP` and `DOWN` SQL in the new file.
        3.  Run the migration: `sqlx migrate run`.
        4.  Update the Rust model structs in `models.rs` to reflect the changes. `sqlx` will then verify queries against the new schema at compile time.


!CRITICAL: you must create a checklist.md file that will be used to track the progress of this migration. the document items must be checked off immediately they are completed. The document must remain concise with no stories at all. You MUST think deeply when implementing each item in the checklist.md document. NB: the editor project is a vue project that must also be ported into the vue frontend inside the rust project. We have decided to make the theming system on the rust based project frontend centric and we only use the backend for the storage of preferred theme.
