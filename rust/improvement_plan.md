This refinement will provide a core architectural philosophy and a more detailed, strategic breakdown of how to evolve the project.

The guiding principle we will use is a variant of the **Ports and Adapters (Hexagonal) Architecture**. Your goal—to extract backend logic into reusable tools—is the textbook use case for this pattern.

**The Core Philosophy:** `act-server` should not be an application that *contains* business logic. It should be a thin **adapter** that translates web requests (HTTP/WebSocket) into calls to a pure, self-contained, and completely web-agnostic **domain core**.

---

### I. The Backend Philosophy: Ports and Adapters in Practice

Imagine your application logic as a central hexagon. The outside world can only interact with it through "ports" (which in Rust are simply traits). Everything else—the web server, the database, the PTY system—are "adapters" that plug into these ports.

#### 1. The Core (The Hexagon)

This is your business logic, completely isolated. It will be composed of the new crates.

*   **`act-core` (The True Core):**
    *   **What it contains:** `Error` and `Result` types for the entire domain. The `*Repository` traits (the "Ports"). Core domain models (`Workspace`, `Session`, `PtyEvent`, etc.) that are pure data structures with no external dependencies.
    *   **What it MUST NOT contain:** Any mention of `axum`, `socketioxide`, `sqlx`, `serde_json::Value` (use strongly-typed structs instead), HTTP status codes, or web-specific DTOs like `ApiResponse`.

*   **`act-pty` (PTY Domain Crate):**
    *   **Purpose:** A standalone library for managing pseudo-terminals.
    *   **Input Port (Trait):** A simple `PtyService` trait defined in `act-core`.
        ```rust
        // In act-core/src/pty.rs
        pub enum PtyEvent {
            Output(Vec<u8>),
            Closed,
        }

        #[async_trait]
        pub trait PtyService {
            fn create_session(&self, config: PtyConfig) -> Result<(SessionId, mpsc::Receiver<PtyEvent>)>;
            async fn send_input(&self, session_id: &SessionId, data: &[u8]) -> Result<()>;
            async fn resize(&self, session_id: &SessionId, size: PtySize) -> Result<()>;
            async fn kill_session(&self, session_id: &SessionId) -> Result<()>;
        }
        ```
    *   **Implementation:** This crate provides a concrete `TokioPtyService` that implements the trait. It correctly uses `tokio::task::spawn_blocking` for blocking I/O and `tokio::sync::mpsc` channels. It knows nothing about databases or web sockets; it just spawns processes and streams `PtyEvent`s.

*   **`act-vfs` (Virtual File System Domain Crate):**
    *   **Purpose:** A secure, sandboxed file system interface.
    *   **Input Port (Trait):** A `FileSystem` trait in `act-core`.
    *   **Implementation:** The current logic from `services/filesystem.rs` moves here. Its constructor takes a `root_path: PathBuf`. All path resolution and security checks (preventing `..` traversal) live here. It returns `Result<Vec<FileItem>, CoreError>`, not `Json<ApiResponse<...>>`.

#### 2. The Adapters (Plugging into the Core)

*   **`act-server` (The Primary Driving Adapter):**
    *   Its job is to be the **translator**.
    *   **HTTP Routes:** A route's only job is to:
        1.  Parse the incoming `Request` (e.g., `Json<CreateWorkspaceRequest>`).
        2.  Call the relevant domain service (e.g., `workspace_service.create(...)`).
        3.  Take the `Result<Workspace, CoreError>` from the service.
        4.  Translate it into an HTTP `Response` (e.g., `(StatusCode::CREATED, Json(ApiResponse::success(workspace)))` or an error response).
    *   **WebSocket Handlers:** A socket handler's only job is to:
        1.  Parse an incoming socket event (`Data<TerminalCreateRequest>`).
        2.  Call the relevant domain service (`pty_service.create_session(...)`).
        3.  Listen on the returned `mpsc::Receiver<PtyEvent>`.
        4.  Translate each `PtyEvent` into an outgoing socket event (`socket.emit("terminal:output", ...)`).
    *   **AppState:** This is where you perform dependency injection. It holds `Arc`s of the *trait objects* (`Arc<dyn PtyService>`), not the concrete types.

*   **`act-persistence` (The Driven Adapter):**
    *   This crate implements the `*Repository` traits from `act-core` using `sqlx`. It's the only place in your entire backend that should know what a database is.

This structure makes your core logic infinitely more reusable. You could write a new `act-cli` adapter that uses the *exact same* `act-pty` and `act-vfs` crates to provide a local command-line tool.

---

### II. Concrete Backend Refinements

#### 1. `services/pty.rs` -> `act-pty` Crate Migration (Immediate Action)

This is your highest-risk area due to the blocking I/O bug. Refactor this first.

*   **Define the `PtyEvent` Stream:** The `mpsc::UnboundedReceiver<String>` is not ideal. It doesn't signal process closure. The `PtyEvent` enum (shown above) is far more robust. The receiver channel should live as long as the underlying process.
*   **Fix Blocking I/O:** Use `tokio::task::spawn_blocking` for the `reader.read()` loop. This is non-negotiable for a healthy Tokio application.
*   **Use `tokio::sync::Mutex`:** Replace `std::sync::Mutex` around your sessions map with `tokio::sync::Mutex`.
*   **Result:** You will have a new, standalone `act-pty` crate that is independently testable and correct.

#### 2. Refactor Services to be Domain-Centric

Your services currently live in `act-server` and are too web-aware. They should be part of the core domain.

**Example: `WorkspaceService`**

**Current (Implicitly):**
```rust
// in routes/workspaces.rs
pub async fn create_workspace(...) -> Result<Json<ApiResponse<Workspace>>, StatusCode> {
    // ... logic to build workspace ...
    let result = workspace_service.create_workspace(workspace).await; // Service does DB work
    // ... handle result and return web response
}
```

**Improved:**
```rust
// In a new `act-domain/src/workspace_service.rs`
pub struct WorkspaceService {
    repo: Arc<dyn WorkspaceRepository>,
    vfs: Arc<dyn FileSystem>, // Inject dependencies
}

impl WorkspaceService {
    pub async fn create_workspace(&self, name: &str, owner_id: &str) -> Result<Workspace, CoreError> {
        // 1. Business logic (validation, etc.)
        if name.is_empty() { return Err(CoreError::Validation("Name is empty")); }

        // 2. Use the VFS port to create a directory
        let workspace_id = Uuid::new_v4().to_string();
        let path = self.vfs.create_dir(&workspace_id).await?;

        // 3. Create domain model
        let new_workspace = Workspace { id: workspace_id, path, ... };

        // 4. Use the repository port to save it
        self.repo.save(&new_workspace).await?;

        Ok(new_workspace)
    }
}
```
Notice how the service now orchestrates other domain components via traits, contains actual business logic, and returns a domain `Result`, not a web type. The route handler becomes trivial.

---

### III. Frontend Refinements: Enforcing a Reactive Data Flow

Your frontend is solid, but the data flow can be made more robust and predictable, eliminating the "global event bus" pattern.

#### 1. The Socket Service: A State Machine, Not an Event Bus

The `socketService` should manage the connection *state* and expose typed data streams, not fire-and-forget global events.

**`services/socket.ts` (Refined):**
```typescript
import { ref } from 'vue';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs'; // Or a simple event emitter

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

class SocketService {
    public state = ref<ConnectionState>('disconnected');

    // Use RxJS Subjects or a simple typed event emitter for robust, typed events
    public onTerminalOutput$ = new Subject<{ sessionId: string; output: string }>();
    public onStats$ = new Subject<AppStats>();

    // ...

    connect(): Promise<void> {
        this.state.value = 'connecting';
        // ... connection logic
        this.socket.on('connect', () => { this.state.value = 'connected'; });
        this.socket.on('disconnect', () => { this.state.value = 'disconnected'; });

        // Pipe socket events to Subjects
        this.socket.on('terminal:output', (data) => this.onTerminalOutput$.next(data));
        this.socket.on('stats', (data) => this.onStats$.next(data));
    }
}

export const socketService = new SocketService();
```

#### 2. Pinia Stores: The Exclusive Subscribers

Only Pinia stores should subscribe to the socket service streams. Components should **never** listen to the socket directly. This centralizes state management.

**`stores/terminal.ts`:**
```typescript
import { socketService } from '@/services/socket';
import { onMounted, onUnmounted } from 'vue';

export const useTerminalStore = defineStore('terminal', () => {
    // ... state ...

    const outputSubscription = socketService.onTerminalOutput$.subscribe({
        next: (data) => {
            // Find the correct pane and call an action to append data
            appendOutput(data.sessionId, data.output);
        }
    });

    onUnmounted(() => {
        outputSubscription.unsubscribe();
    });

    // ... actions ...
    return { ... };
});
```
**Why this is better:**
*   **Predictable State:** All state changes go through Pinia actions.
*   **Decoupling:** Components are completely decoupled from the WebSocket. They only know about the terminal store.
*   **Type Safety:** The data flowing from the service to the store is strongly typed via RxJS or a similar mechanism.

#### 3. Frontend Type Cohesion: `LayoutType`
The checklist mentions a type mismatch on `LayoutType`. This is a classic frontend issue.

**Problem:** The backend probably sends `layout_type: "horizontal-split"`. The frontend might have a type `LayoutType = 'single' | 'horizontal' | 'vertical'`. A mismatch can cause runtime errors.

**Recommendation:**
*   **Shared Type Definition:** Create a `types/layout.ts` file that is the single source of truth for layout types.
    ```typescript
    // src/types/layout.ts
    export const LAYOUT_TYPES = ['single', 'horizontal-split', 'vertical-split'] as const;
    export type LayoutType = typeof LAYOUT_TYPES[number];
    ```
*   **Validation:** When receiving data from the backend, validate it against this type.
    ```typescript
    // In the service layer where you receive layout data
    import { LAYOUT_TYPES, LayoutType } from '@/types/layout';

    function isLayoutType(value: string): value is LayoutType {
        return (LAYOUT_TYPES as readonly string[]).includes(value);
    }

    // When processing API response:
    const rawLayoutType = response.data.layout_type;
    if (isLayoutType(rawLayoutType)) {
        // It's safe to use
        const layout: LayoutType = rawLayoutType;
    } else {
        // Handle error or fallback to default
        console.warn(`Invalid layout type received: ${rawLayoutType}`);
        const layout: LayoutType = 'single';
    }
    ```

---

### Refined Roadmap

1.  **Phase 1: Stabilize & Unblock.**
    *   **Action:** Fix all compilation errors in both frontend and backend.
    *   **Action:** Fix the blocking I/O in `pty.rs` using `spawn_blocking` and switch to `tokio::sync::Mutex`.
    *   **Outcome:** A working, stable application you can build upon.

2.  **Phase 2: Decouple the Web Adapters.**
    *   **Action:** Implement `IntoResponse` for your core `Error` type. Refactor all Axum routes to be thin translators that call services and handle the `Result`.
    *   **Action:** Refactor `socket.rs`. Move the core PTY logic into its own service/module. Make the socket handlers thin translators that call this service. Use `socketioxide` extensions for auth state.
    *   **Action (Frontend):** Refactor `socket.ts` to use a reactive state (`ConnectionState`) and typed event streams (e.g., RxJS Subjects). Make Pinia stores the sole subscribers.
    *   **Outcome:** The "seams" between your web layer and business logic are now clean and well-defined, even if the logic still lives within the `act-server` crate.

3.  **Phase 3: Extract the Domain Core.**
    *   **Action:** Physically move the now-decoupled logic into the new domain crates (`act-pty`, `act-vfs`, etc.).
    *   **Action:** Define the `Repository` traits in `act-core` and create the `act-persistence` crate with the `sqlx` implementations.
    *   **Action:** Update `act-server`'s `AppState` to inject the trait objects (`Arc<dyn ...>`).
    *   **Outcome:** Your primary goal is achieved. You have a suite of powerful, independent Rust libraries with a web server being just one of their consumers.

This refined plan provides a clear architectural vision and a pragmatic, step-by-step path to achieve it. It directly addresses the goal of future extractability by establishing strong domain boundaries from the outset.
