### Journey 1: User Onboarding and First Login

**Goal:** A new user authenticates with the application for the first time using their GitHub account.

**Preconditions:**
*   The user is not authenticated.
*   The browser does not have a valid JWT in `localStorage`.
*   The Rust backend is running and configured with GitHub OAuth credentials.

**Steps:**
1.  **Landing on the App:**
    *   **Frontend:** The user navigates to the root URL. The Vue Router directs them to the `Dashboard.vue` view.
    *   The `useAppCore` composable in `Dashboard.vue` is initialized. It calls `authStore.checkAuthStatus()`.
    *   `stores/auth.ts`: The store finds no JWT in `localStorage`. The `isAuthenticated` computed property returns `false`.
    *   **UI:** `Dashboard.vue` renders its "unauthenticated" state, showing the `Login.vue` component content, which prompts the user to log in.

2.  **Initiating GitHub OAuth Flow:**
    *   **Frontend:** The user clicks the "Login with GitHub" button.
    *   This action triggers a call to `authStore.getGitHubAuthUrl()`. The store constructs the appropriate GitHub authorization URL, including the `client_id`, `redirect_uri`, and a CSRF `state` token, which is saved to `localStorage`.
    *   **Browser:** The browser redirects the user to the GitHub authorization page.

3.  **Authorizing the Application:**
    *   **GitHub:** The user reviews the requested permissions and authorizes the application.
    *   **Browser:** GitHub redirects the user back to the application's configured callback URL (`/auth/callback`), including an authorization `code` and the original `state` parameter in the URL.

4.  **Handling the OAuth Callback and Token Exchange:**
    *   **Frontend:** The Vue Router loads the `AuthCallback.vue` component.
    *   `AuthCallback.vue`: On mount, it extracts the `code` and `state` from the URL. It validates the `state` against the value in `localStorage` to prevent CSRF attacks. It then makes a GET request to the backend endpoint: `/api/v1/auth/github/callback`.
    *   **Backend:**
        *   `routes/auth.rs`: The `handle_github_callback` handler receives the request.
        *   It calls `domain_services.auth_service.handle_oauth_callback`.
        *   `domain/auth_service.rs`: The `AuthService` uses its `GitHubAuthService` implementation (`services/auth.rs`) to exchange the `code` for a GitHub access token by making a server-to-server request to GitHub's token endpoint.
        *   The `AuthService` validates that the authenticated GitHub username is in the allowed tenant list (`config.auth.tenant_github_usernames`).
        *   It then uses the `AuthRepository` (`persistence/auth_repository.rs`) to check if a user with this `github_id` exists in the `users` table.
            *   If not, it calls `create_user` to insert a new record.
            *   If yes, it calls `update_user` to refresh their details (username, avatar, etc.).
        *   It stores the encrypted GitHub access and refresh tokens in the `user_settings` table, associated with the internal user ID.
        *   It uses the `JwtService` (`services/auth.rs`) to generate a new, short-lived JWT for the application, containing the internal user ID and GitHub username.
        *   The backend responds to the frontend with the newly generated JWT and user information.

5.  **Finalizing Login on the Frontend:**
    *   **Frontend:** `AuthCallback.vue` receives the successful response containing the JWT.
    *   It calls `authStore.setToken()`.
    *   `stores/auth.ts`: The store saves the JWT and user info to `localStorage`, updates its internal state (`token`, `user`), and establishes a WebSocket connection using the new token.
    *   **UI:** The `AuthCallback.vue` component shows a "Success" message.
    *   **Browser:** The component redirects the user to the `/dashboard` route. The `Dashboard.vue` component now sees that `authStore.isAuthenticated` is `true` and renders the main application layout.

**Postconditions:**
*   The user is authenticated.
*   A valid JWT is stored in the browser's `localStorage`.
*   The user's information is stored in the backend's `users` table.
*   The user's GitHub OAuth tokens are securely stored in the `user_settings` table.
*   A persistent WebSocket connection is established.

**Key Components Involved:**
*   **Frontend:** `Dashboard.vue`, `AuthCallback.vue`, `stores/auth.ts`, `services/api.ts`, `services/socket.ts`.
*   **Backend:** `routes/auth.rs`, `domain/auth_service.rs`, `services/auth.rs`, `services/github.rs`, `persistence/auth_repository.rs`.

---

### Journey 2: Cloning a Repository to Create a Workspace

**Goal:** An authenticated user finds a repository from their GitHub account and clones it, creating a new workspace in the application.

**Preconditions:**
*   The user is authenticated.
*   The user has granted the application access to their repositories on GitHub.

**Steps:**
1.  **Opening the Repositories Modal:**
    *   **UI:** The user is on the dashboard. In `Sidebar.vue`, they click the "Add Workspace" or "Clone Repository" button.
    *   **Frontend:** This action calls `workspaceStore.openRepositoriesModal()`. The `RepositoriesModal.vue` component becomes visible.

2.  **Fetching and Displaying Repositories:**
    *   **Frontend:** `RepositoriesModal.vue` mounts and calls `workspaceStore.loadRepositories()`.
    *   `stores/workspace.ts`: The store calls `apiService.getRepositories()`.
    *   **Backend:**
        *   `routes/github.rs`: The `list_repositories` handler is invoked. It uses the `AuthenticatedUser` middleware to verify the JWT and extract the user's internal ID.
        *   It calls `domain_services.github_service.list_user_repositories`.
        *   `domain/github_service.rs`: The `GitHubService` retrieves the user's stored (and encrypted) GitHub access token from the database via the `AuthRepository`.
        *   It then uses this token to make an authenticated request to the GitHub API (`/user/repos`) to fetch the list of repositories.
        *   The list of repositories is returned to the frontend.
    *   **UI:** The `RepositoriesModal.vue` component receives the list and renders it, allowing the user to search and scroll.

3.  **Initiating the Clone Operation:**
    *   **UI:** The user finds the desired repository in the list and clicks the "Clone" button.
    *   **Frontend:** This triggers `workspaceStore.cloneRepository(repository)`.
    *   `stores/workspace.ts`: The store updates its state to show a cloning progress indicator and calls `apiService.cloneRepository()`.
    *   **Backend:**
        *   `routes/github.rs`: The `clone_repository` handler is invoked. It gets the user ID from the JWT.
        *   It calls `domain_services.workspace_service.clone_repository`.
        *   `domain/workspace_service.rs`: The `WorkspaceService` performs the main logic:
            1.  It checks via `WorkspaceRepository` if a workspace for this repo already exists for the user to prevent duplicates.
            2.  It generates a unique ID for the new workspace and constructs a sandboxed local path (e.g., `/app/workspaces/<uuid>`).
            3.  It uses the `FileSystem` trait (`act-vfs/filesystem.rs`) to create this new directory on the server.
            4.  It calls the `GitService` trait (`act-domain/git_service.rs`), which uses the local `git` command-line tool to execute `git clone` with the user's GitHub token for authentication, pulling the repository into the newly created directory.
            5.  Upon successful cloning, it calls `WorkspaceRepository` (`persistence/workspace_repository.rs`) to create a new record in the `workspaces` table, linking the workspace name, repo URL, and local path to the user.
        *   The newly created `Workspace` object is returned in the API response.

4.  **Finalizing the Workspace Creation:**
    *   **Frontend:** `stores/workspace.ts` receives the new workspace object.
    *   It adds the new workspace to its `workspaces` array.
    *   It closes the repositories modal and clears any cloning-related state (progress, errors).
    *   **UI:** The `Sidebar.vue` component reactively updates to show the new workspace in the list.

**Postconditions:**
*   A new directory containing the cloned repository exists on the server's file system.
*   A new entry for the workspace is created in the `workspaces` database table, associated with the user.
*   The frontend's workspace list is updated.

**Key Components Involved:**
*   **Frontend:** `Sidebar.vue`, `RepositoriesModal.vue`, `stores/workspace.ts`, `services/api.ts`.
*   **Backend:** `routes/github.rs`, `domain/workspace_service.rs`, `domain/git_service.rs`, `persistence/workspace_repository.rs`, `act-vfs/filesystem.rs`.

---

### Journey 3: Using the Terminal

**Goal:** The user opens a terminal for a selected workspace, runs a command (e.g., `ls -l`), and sees the output.

**Preconditions:**
*   User is authenticated.
*   At least one workspace exists and is selected.

**Steps:**
1.  **Creating a New Terminal Tab/Pane:**
    *   **UI:** The user is in the `TerminalPanes-tree.vue` view. If no terminal exists, they click "Create Terminal". If one exists, they can click the "+" button in a pane's tab bar.
    *   **Frontend:** This action calls `terminalStore.createTerminal()` or `terminalStore.createTabInPane()`.
    *   `stores/terminal-tree.ts`: The store updates its internal layout state, creating a new tab object with a unique, frontend-generated `sessionId`. It then calls `socketService.createTerminal()`.
    *   `services/socket.ts`: The service emits a `terminal:create` event over WebSocket to the backend, sending the `workspaceId` and the frontend-generated `sessionId`.

2.  **Backend Spawns a Pseudo-Terminal (PTY):**
    *   **Backend:** `socket_handlers.rs` receives the `terminal:create` event.
    *   It calls `domain_services.session_service.create_session`.
    *   `domain/session_service.rs`: The `SessionService` performs several actions:
        1.  It creates a new session record in the `sessions` table via the `SessionRepository`.
        2.  It calls the `PtyService` (`act-pty/service.rs`).
        3.  `act-pty`: The `TokioPtyService` uses the `portable-pty` library to spawn a new pseudo-terminal process (e.g., `/bin/bash`) within the workspace's local directory.
        4.  It sets up tasks to read from the PTY's output and write to its input asynchronously.
        5.  `session_service`: It creates an `OutputForwarder` and starts a task (`handle_pty_output`) to listen to events from the PTY.
    *   The backend emits a `terminal:created` event back to the client, confirming the session creation and providing the server-side process ID (PID).

3.  **User Types a Command:**
    *   **UI:** The `TerminalPane.vue` component, which contains an `xterm.js` instance, is now active. The user types `ls -l` and presses Enter.
    *   **Frontend:** The `xterm.js` instance captures this input and fires its `onData` event.
    *   This event bubbles up through the component hierarchy to `TerminalPanes-tree.vue`, which calls `terminalStore.sendInput()`.
    *   `stores/terminal-tree.ts`: The store finds the active tab's `sessionId` and calls `socketService.sendTerminalData()`.
    *   `services/socket.ts`: It emits a `terminal:data` event over WebSocket with the `sessionId` and the input string.

4.  **Backend Processes the Command and Returns Output:**
    *   **Backend:** `socket_handlers.rs` receives the `terminal:data` event.
    *   It calls `domain_services.session_service.send_input`.
    *   `domain/session_service.rs`: The service finds the corresponding active PTY session and uses the `PtyService` to write the input data (`ls -l\n`) to the PTY's master file descriptor.
    *   The shell process running inside the PTY receives the command, executes it, and writes the resulting output to its `stdout`.
    *   The `handle_pty_output` task in `session_service.rs` is continuously reading from the PTY's master. It receives the output from the `ls -l` command.
    *   It forwards this output data to the `SessionWebSocketManager`.
    *   The manager finds the correct client socket and sends the data back via a `terminal:output` event.

5.  **Frontend Renders the Output:**
    *   **Frontend:** `services/socket.ts` receives the `terminal:output` event. It fires its `terminalOutput$` subject.
    *   `stores/terminal-tree.ts` is subscribed to this subject. Its `appendOutput` method is called.
    *   The store finds the correct tab by `sessionId` and appends the received data to its `buffer` property.
    *   The `onTerminalOutput` handler in `TerminalPanes-tree.vue` is triggered, which calls the `write` method on the corresponding `PaneTreeNode.vue` component instance.
    *   **UI:** `PaneTreeNode.vue` calls the `.write()` method of its `xterm.js` instance, rendering the output for the user to see.

**Postconditions:**
*   A shell process is running on the server, scoped to the user's workspace directory.
*   A new session is recorded in the database.
*   The user sees a fully interactive terminal in their browser, with command output appearing in real-time.

**Key Components Involved:**
*   **Frontend:** `TerminalPanes-tree.vue`, `PaneTreeNode.vue`, `stores/terminal-tree.ts`, `services/socket.ts`, `xterm.js`.
*   **Backend:** `socket_handlers.rs`, `domain/session_service.rs`, `act-pty/service.rs`, `persistence/session_repository.rs`.
