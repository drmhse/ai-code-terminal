### Executive Summary: The Strategic Way Forward

Our new strategy refines the application's core architecture to achieve a stateful, real-time, and truly multi-device experience, akin to modern collaborative tools like Figma or Google Docs, but for a terminal environment.

1.  **State Management Revolution:** We are moving from a database-centric model for session state to a purely **in-memory, real-time state management system** on the backend. The database will only store persistent, user-generated artifacts (workspaces, layouts, user settings), while the live state of terminals and connections will reside in memory, managed by the Rust application. This is the key to achieving instantaneous multi-device synchronization and eliminating architectural anti-patterns.

2.  **User Experience (UX) North Star:** Our UX will be guided by two principles:
    *   **Interaction Model:** The speed, fluidity, and pane management of editors like **Zed and VS Code**.
    *   **Visual Design & Clarity:** The clean, intuitive, and task-oriented presentation of **Atlassian products**.

3.  **Cohesive Feature Set:** We will eliminate redundant or incomplete features, focusing on a core set of functionalities that are fully implemented and polished. This includes standardizing on a single editor paradigm, enabling the creation of empty workspaces, and implementing a native-feeling file explorer context menu.

4.  **Total Theming:** Every visual component will be fully themeable via a robust CSS variable system. No hardcoded colors will be permitted. All themes will be vetted for accessibility and contrast.

This plan will trim architectural fat, fix critical gaps in the user journey, and align the entire system with a clear, ambitious vision.

---

### Part 1: The New State of Events - A Strategic Refinement

This section details the refined architectural philosophy based on your directives.

#### 1.1. The Database: The Source of Truth for *Persistent* Data

The database's role is now clarified: it is the durable store for user-generated configuration and assets, not for live, ephemeral state.

*   **What Belongs in the Database:**
    *   `users`: Core user identity.
    *   `user_settings`: GitHub tokens, theme preferences.
    *   `workspaces`: The definition of a workspace (name, path, git repo).
    *   `terminal_layouts`: The user's saved pane structures, including the last known terminal buffer content for session restoration.
    *   `background_tasks`: The *definitions* of long-running tasks (command, name, cwd), but not their live status (PID, memory usage).

*   **What is Being Removed from the Database:**
    *   **`sessions` Table:** This is the most significant change. PTY sessions are live OS processes; their state is inherently ephemeral. Storing PIDs and socket IDs in a database is an anti-pattern that leads to state synchronization nightmares, especially with server restarts or scaling. This table will be completely removed.

#### 1.2. In-Memory State: The Source of Truth for *Live* Data

To achieve seamless multi-device continuity, the backend must maintain the live state of all user activity in memory.

*   **The In-Memory State Store:** We will implement a global, thread-safe structure in the Rust backend's `AppState`, likely a `RwLock<HashMap<UserId, UserLiveState>>`.
*   **`UserLiveState` Struct:** This struct will hold everything related to a user's active session:
    *   A map of their active PTY processes (`HashMap<SessionId, PtySession>`).
    *   A map of their connected WebSocket clients (`HashMap<ConnectionId, WebSocketClient>`).
*   **The Multi-Device Sync Logic:**
    1.  When a user connects from **Device A**, a WebSocket connection is added to their `UserLiveState`. If they create a terminal tab with `sessionId: "abc"`, a PTY process is spawned and stored in the in-memory map against `"abc"`.
    2.  When the user connects from **Device B**, another WebSocket connection is added. The frontend for Device B will load the saved `terminal_layouts` and request to "reconnect" to `sessionId: "abc"`.
    3.  The backend sees that a PTY for `"abc"` is already running in memory. It does **not** create a new one. It simply adds Device B's WebSocket as another listener for the output of that PTY.
    4.  If the user types `ls` on **Device A**, the input is sent to the single PTY process. The output is captured and broadcast to the WebSockets for **both Device A and Device B**. Both screens update simultaneously.
    5.  If **Device B reloads**, it reconnects and repeats step 2. The backend re-establishes the output stream. The frontend uses the terminal buffer persisted in the `terminal_layouts` JSON to instantly repaint the terminal's history, making the reload appear seamless.

#### 1.3. The UI/UX Philosophy: Atlassian Clarity, Zed Fluidity

*   **Atlassian Inspiration:** This applies to the overall layout, information hierarchy, and component design. We will use clear headers, consistent button styles, intuitive modals, and organized sidebars. The Command Palette is a perfect example of this.
*   **Zed/VS Code Inspiration:** This applies to the *feel* of the core editor and terminal experience. This means fluid, draggable pane resizing, seamless tab management (including dragging between panes), and highly responsive keyboard shortcuts.
*   **Total Theming:** The Atlassian-inspired structure provides the "bones" of the UI. The theme system provides the "skin." Every color, from the main background to a button's hover state border, will be defined as a CSS variable in `global.css` and applied via the `useTheme` composable. This ensures that any theme can completely transform the application's look while the excellent UX structure remains intact. We will audit all components to eliminate hardcoded colors.

---

### Part 2: The Way Forward - An Exhaustive Action Plan

This is a step-by-step guide to implementing the new strategy.

#### Section 1: Core Architecture & State Management Refactor

**1.1. Consolidate Database Schema**
*   **Problem:** The current migrations are incremental and contain remnants of old designs (like the `sessions` table).
*   **Solution:** Create a single, definitive `0001_consolidated_schema.sql` file that reflects our new architecture.
*   **Implementation Details:**
    1.  Delete all existing files in the `migrations` directory.
    2.  Create a new migration file (provided at the end of this document) containing the final schemas for `users`, `user_settings`, `workspaces`, `terminal_layouts`, `background_tasks`, and `metric_events`.
    3.  Run `sqlx migrate run` to apply the new, clean schema.
*   **Impact:** Establishes a clean, intentional database structure that perfectly matches the refined architecture. Eliminates technical debt.

**1.2. Implement In-Memory Backend State**
*   **Problem:** The backend is stateless regarding PTY sessions, relying on a flawed database model. It cannot support multi-device sync.
*   **Solution:** Create a centralized, in-memory state manager within the `AppState`.
*   **Implementation Details:**
    1.  **`app_state.rs`:** Add a new field: `live_state: Arc<RwLock<HashMap<UserId, UserLiveState>>>`.
    2.  **Create `UserLiveState` Struct:** This struct will contain `pty_sessions: HashMap<SessionId, Arc<Mutex<PtySession>>>` and `web_sockets: HashMap<ConnectionId, WebSocketSender>`.
    3.  **Refactor `socket_handlers.rs`:**
        *   On `terminal:create`, check the `UserLiveState` for the user. If a PTY for the given `sessionId` already exists, do not create a new one. Instead, just start forwarding its output to the new socket.
        *   If it doesn't exist, spawn the PTY via `PtyService` and store the `PtySession` object in the in-memory map.
        *   On `terminal:data`, route the input to the correct in-memory `PtySession`.
        *   Refactor the PTY output handling loop in `act-pty/service.rs`. Instead of sending to a single channel, it should iterate through all registered WebSocket senders in the `UserLiveState` for that session and broadcast the output.
        *   On WebSocket disconnect, remove the corresponding `WebSocketSender` from the `UserLiveState`. Do **not** kill the PTY process.
*   **Impact:** This is the core architectural change that enables seamless multi-device continuity and fixes the flawed persistence of live state.

**1.3. Persist Terminal Buffers in Layouts**
*   **Problem:** For a seamless reload experience, the terminal's visible content must be restored instantly.
*   **Solution:** Persist the terminal buffer content within the `TerminalTab` object, which is part of the `PaneNode` tree stored in the `terminal_layouts` table.
*   **Implementation Details:**
    1.  **`domain/session_service.rs`:** In the `handle_pty_output` task, in addition to broadcasting output, also append it to an in-memory buffer associated with the `TerminalTab` state.
    2.  **`stores/terminal-tree.ts`:** Periodically (e.g., every 30 seconds) or on significant events (like closing a tab), the frontend will send the current layout state (including the updated buffers) to the backend.
    3.  **`routes/layouts.rs`:** The `update_layout` handler will receive this JSON and persist it to the `tree_structure` column in the `terminal_layouts` table.
    4.  **Frontend on Reload:** When the frontend initializes, it fetches the layout. The `PaneTreeNode.vue` component will use the `buffer` property from its `TerminalTab` prop to immediately `.write()` the history to the `xterm.js` instance upon creation.
*   **Impact:** Creates the "as if nothing happened" reload experience the user requires.

#### Section 2: UI/UX and Feature Implementation

**2.1. Implement Draggable Pane Resizing**
*   **Problem:** Panes have fixed sizes and cannot be resized by the user.
*   **Solution:** Introduce draggable splitter components between panes.
*   **Implementation Details:**
    1.  **`PaneTreeNode.vue`:** When rendering a `container` node, insert a `Splitter.vue` component between each child.
    2.  **`Splitter.vue`:** This component will listen for `mousedown` events. On drag, it will calculate the delta and emit an `update:sizes` event with the new percentage distribution for the siblings.
    3.  **`stores/terminal-tree.ts`:** Create a new action `resizePanes(parentContainerId, newSizes)`. This action will find the container node and update the `size` property of its children, ensuring they still sum to 100. This state change will trigger a reactive UI update.
*   **Impact:** Achieves the fluid, IDE-like pane management of Zed/VS Code.

**2.2. Implement Pane Merging (Closing a Pane)**
*   **Problem:** There is no way to close a split pane and have the remaining pane(s) fill the space.
*   **Solution:** Implement the "close pane" functionality.
*   **Implementation Details:**
    1.  **`PaneTreeNode.vue`:** The "close" button will emit a `close-pane` event with its `node.id`.
    2.  **`TerminalPanes-tree.vue`:** The handler for this event will call a new action in the `terminal-tree.ts` store: `closePane(paneId)`.
    3.  **`stores/terminal-tree.ts`:** The `closePane` action will:
        *   Find the node to be closed and its parent container.
        *   Remove the node from the parent's `children` array.
        *   Kill all terminal sessions within the closed pane's tabs.
        *   Redistribute the closed pane's `size` among its siblings.
        *   If the parent container is left with only one child, "unwrap" it by replacing the container with its single child in the tree.
*   **Impact:** Completes the pane lifecycle, making layout management intuitive and powerful.

**2.3. Implement File Explorer Context Menu**
*   **Problem:** The file tree lacks a right-click context menu, a standard feature in any file explorer.
*   **Solution:** Add a fully functional, native-feeling context menu.
*   **Implementation Details:**
    1.  **`FileTreeNode.vue`:** Add a `@contextmenu.prevent="handleContextMenu"` event handler to the main node element.
    2.  **`composables/useFileOperations.ts`:** The `handleFileContextMenu` method will update the `fileStore` with the clicked file and the event's `clientX` and `clientY` coordinates.
    3.  **`Dashboard.vue`:** Conditionally render the `ContextMenu.vue` component based on `fileStore.showContextMenu`. Pass the coordinates as style props.
    4.  **`ContextMenu.vue`:** This component will render the list of actions. Each button click will call a corresponding method in the `useFileOperations` composable (e.g., `renameFile`, `deleteFile`).
    5.  The `fileStore` will have a global click listener to close the menu when the user clicks anywhere else.
*   **Impact:** Drastically improves the UX of the file explorer, bringing it in line with user expectations from native IDEs.

**2.4. Implement Empty Workspace Creation**
*   **Problem:** Workspaces can only be created by cloning a Git repository.
*   **Solution:** Allow users to create a new, empty workspace.
*   **Implementation Details:**
    1.  **`RepositoriesModal.vue`:** Add a "Create Empty Workspace" tab or button. This will present a simple form with a "Workspace Name" input.
    2.  **`stores/workspace.ts`:** Create a new action, `createEmptyWorkspace(name: string)`.
    3.  **`services/api.ts`:** Add a new method, `createWorkspace(name: string, path: string)`, which will now handle both empty and cloned workspaces. The backend will differentiate based on whether a `github_url` is provided.
    4.  **`routes/workspaces.rs`:** The `create_workspace` handler will be updated. If `github_url` is absent, it will call a new method in the `WorkspaceService`.
    5.  **`domain/workspace_service.rs`:** Add a `create_empty_workspace` method. This method will simply use the `FileSystem` trait to create a new directory and the `WorkspaceRepository` to create the database record.
*   **Impact:** Provides a fundamental feature for users who want to start projects from scratch.

**2.5. Re-examine and Standardize the File Editor**
*   **Clarification:** You are correct. My initial analysis identified two editor components, but `FileEditor.vue` is unused. The only active editor is `FileEditorModal.vue`.
*   **Problem:** Using a modal for all file editing is unconventional for a development environment and can be cumbersome for multi-file workflows.
*   **Solution:** Decide on the primary editing paradigm. The most IDE-like approach is a docked editor panel.
*   **Recommendation:**
    1.  **Deprecate the Modal:** Phase out `FileEditorModal.vue`.
    2.  **Integrate the Docked Editor:** Refactor `FileEditor.vue` to be the primary editor. It should appear as a new panel, potentially splitting the view with the terminal area or taking over the main content area.
    3.  **Create an Editor Store:** The `stores/editor.ts` store is well-designed. This store should be the single source of truth for open files (as tabs), content, and modification status.
    4.  **Wire up the UI:**
        *   Clicking a file in `FileTree.vue` should call an action in the `editorStore` to open it.
        *   `MainLayout.vue` will conditionally render `FileEditor.vue` when there are open files.
        *   The editor component will render tabs based on the `editorStore` state.
*   **Impact:** This provides a professional, multi-tab editing experience that is standard in all modern IDEs and code editors.

---

### Part 3: Consolidated Database Schema (Single Migration File)

Here is the `0001_initial_schema.sql` that reflects all the architectural decisions. This should be the only file in your `migrations` directory.

```sql
-- AI Code Terminal - Consolidated Initial Schema
-- Version: 1.0
-- Date: 2025-XX-XX

-- =============================================================================
--  Users & Authentication
-- =============================================================================

-- Stores core user information, linked to their GitHub identity.
CREATE TABLE users (
    id TEXT PRIMARY KEY,                            -- Internal unique UUID for the user
    github_id TEXT NOT NULL UNIQUE,                 -- GitHub's unique user ID
    username TEXT NOT NULL,                         -- GitHub username
    email TEXT,
    avatar_url TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Stores user-specific settings, including sensitive tokens and preferences.
CREATE TABLE user_settings (
    user_id TEXT PRIMARY KEY,
    github_token TEXT,                              -- Encrypted GitHub OAuth access token
    github_refresh_token TEXT,                      -- Encrypted GitHub OAuth refresh token
    github_token_expires_at DATETIME,
    theme TEXT,                                     -- JSON string of user's ThemePreference
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);


-- =============================================================================
--  Workspaces & Layouts
-- =============================================================================

-- Defines a workspace, which is a sandboxed directory on the server.
CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    github_repo TEXT,                           -- Format: "owner/repo", can be NULL for empty workspaces
    github_url TEXT,                            -- Full Git URL, can be NULL
    local_path TEXT NOT NULL UNIQUE,            -- Absolute path on the server's file system
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- A user cannot clone the same repository twice.
CREATE UNIQUE INDEX idx_workspaces_user_repo ON workspaces(user_id, github_repo) WHERE github_repo IS NOT NULL;
CREATE INDEX idx_workspaces_user_id ON workspaces(user_id);


-- Stores user-defined terminal pane layouts for each workspace.
CREATE TABLE terminal_layouts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    -- The entire state of the pane tree, including tabs and their buffers, is stored here.
    -- This is the key to session continuity on reload.
    tree_structure TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX idx_layouts_user_workspace ON terminal_layouts(user_id, workspace_id);


-- =============================================================================
--  Background Tasks & Metrics (Formerly user_processes)
-- =============================================================================

-- Stores the DEFINITION of long-running tasks, not their live state.
CREATE TABLE background_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    command TEXT NOT NULL,
    args TEXT DEFAULT '[]',                     -- JSON array of arguments
    working_directory TEXT NOT NULL,
    auto_restart BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX idx_tasks_user_workspace ON background_tasks(user_id, workspace_id);


-- Stores analytics events for system monitoring and usage tracking.
CREATE TABLE metric_events (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    event_type TEXT NOT NULL,               -- e.g., 'command', 'session', 'workspace'
    event_name TEXT NOT NULL,               -- e.g., 'execute', 'create'
    properties TEXT DEFAULT '{}',           -- JSON blob for event-specific data
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration_ms INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_metric_events_timestamp ON metric_events(timestamp);
CREATE INDEX idx_metric_events_type_name ON metric_events(event_type, event_name);

```
