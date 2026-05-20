part of 'act_home_page.dart';
// ignore_for_file: invalid_use_of_protected_member

extension _ActHomeWorkspaceBuilder on _ActHomePageState {
  Widget _buildWorkspace(double width) {
    final sidebar = SidebarPanel(
      workspaces: _workspaces,
      collections: _collections,
      files: _files,
      selectedWorkspace: _selectedWorkspace,
      selectedCollection: _selectedCollection,
      selectedFile: _selectedFile,
      isLoadingWorkspaces: _isRefreshingWorkspaces,
      workspaceError: _workspaceRefreshError,
      directoryChildren: _directoryChildren,
      expandedDirectories: _expandedDirectories,
      loadingDirectoryPaths: _loadingDirectoryPaths,
      directoryErrors: _directoryLoadErrors,
      fileSearchQuery: _fileSearchQuery,
      fileSearchResults: _fileSearchResults,
      isIndexingFiles: _isIndexingFiles,
      isPreparingClone: _isPreparingGitHubClone,
      onFileSearchChanged: _handleFileSearchChanged,
      fileListKey: PageStorageKey('files-${_selectedWorkspace?.id ?? 'none'}'),
      onWorkspaceSelected: _selectWorkspace,
      onCollectionSelected: _selectCollection,
      onManageCollections: _showCollectionManager,
      onFileSelected: _selectFile,
      onDirectoryToggled: _toggleDirectory,
      onCreateWorkspace: _showCreateWorkspaceDialog,
      onCloneRepository: _showCloneRepositoryDialog,
      showWorkspaceHeader: width >= 760,
    );
    final terminal = TerminalWorkspace(
      workspace: _selectedWorkspace,
      workspaces: _workspaces,
      sessions: _sessions,
      buffers: _sessionBuffers,
      socketClient: _socketClient,
      onActiveSessionChanged: _handleActiveTerminalChanged,
      focusedSessionId: _activeTerminalSessionId,
      focusMode: _terminalFocusMode,
      controlsExpanded: _terminalControlsExpanded,
      onControlsExpandedChanged: _setTerminalControlsExpanded,
      isCreatingSession: _isCreatingTerminal,
      onCreateSession: _createSession,
      onTerminateSession: _terminateSession,
      onSessionUnavailable: _discardStaleSession,
      onSaveLayout: _saveCurrentTerminalLayout,
    );
    final editor = EditorPreview(
      file: _selectedFile,
      content: _selectedFileContent,
      isLoading: _isLoadingFileContent,
      isSaving: _isSavingFileContent,
      hasUnsavedDraft: _selectedFileHasLocalDraft,
      onChanged: _cacheSelectedFileDraft,
      onSave: _saveSelectedFile,
    );
    final mobileEditor = EditorPreview(
      file: _selectedFile,
      content: _selectedFileContent,
      isLoading: _isLoadingFileContent,
      isSaving: _isSavingFileContent,
      hasUnsavedDraft: _selectedFileHasLocalDraft,
      onChanged: _cacheSelectedFileDraft,
      onSave: _saveSelectedFile,
      onClose: _closeMobileEditor,
    );
    final tasks = TaskPanel(
      readiness: _runnerReadiness,
      availableWorkspaces: _workspaces,
      availableCollections: _collections,
      selectedCollection: _selectedCollection,
      taskScopeType: _taskScopeType,
      taskScopeId: _taskScopeId,
      agentProvider: _selectedAgentProvider,
      tasks: _tasks,
      selectedTask: _selectedTask,
      isLoading: _isLoadingTasks,
      executionStatus: _executionStatus,
      onRefresh: () => _refreshTasksForWorkspace(_selectedWorkspace),
      onTaskScopeChanged: _setTaskScopeFilter,
      onTaskCleared: () => setState(() => _selectedTask = null),
      onTaskSelected: (task) => setState(() => _selectedTask = task),
      onRunTask: _runTask,
      onUpdateTask: _updateTask,
      onOpenCodexSession: _openTaskCodexSession,
      onLoadArtifact: _loadTaskArtifact,
      onFinalizeRun: _finalizeTaskRun,
      onCreatePullRequests: _createTaskPullRequests,
      onCloneTask: _cloneTask,
      onCreateTask: _showCreateTaskDialog,
      showHeader: width >= 760,
    );
    final codex = CodexSessionPanel(
      workspace: _selectedWorkspace,
      workspaces: _workspaces,
      collections: _collections,
      selectedCollection: _selectedCollection,
      workspaceFilterId: _codexWorkspaceFilterId,
      collectionFilterId: _codexCollectionFilterId,
      sessions: _codexSessions,
      events: _codexEvents,
      selectedSessionId: _selectedCodexSessionId,
      isLoading: _isLoadingCodex,
      error: _codexError,
      reloadPiNextPrompt:
          _selectedCodexSessionId != null &&
          _piReloadNextPromptSessionIds.contains(_selectedCodexSessionId),
      canLaunch:
          _hasToken &&
          _canOperateHost &&
          (_selectedWorkspace != null || _selectedCollection != null),
      isLaunching: _isLaunchingCodex,
      agentProvider: _selectedAgentProvider,
      onLaunch: _launchCodexSession,
      onNewChat: _startNewCodexChat,
      onWorkspaceFilterChanged: _setCodexWorkspaceFilter,
      onCollectionFilterChanged: _setCodexCollectionFilter,
      onManageCollections: _showCollectionManager,
      onSessionSelected: _selectCodexSession,
      onOpenLinkedTerminal: (sessionId) =>
          unawaited(_openLinkedCodexTerminal(sessionId)),
      onPreviewChanges: _previewCodexSessionChanges,
      canCreatePullRequests: _canCreatePullRequestsForCodexSession,
      onCreatePullRequests: _createPullRequestsForCodexSession,
      onSendText: _sendCodexMessage,
      onInterruptAndSend: (text) =>
          _sendCodexMessage(text, mode: 'interrupt_and_send'),
      onInterrupt: () => unawaited(_interruptCodexSession()),
      onExtensionUiResponse: _respondCodexExtensionUi,
      showThreadActions: width >= 760,
    );

    if (width < 760) {
      final files = Stack(
        children: [
          Positioned.fill(child: sidebar),
          if (_showMobileEditor)
            Positioned.fill(
              child: Material(
                color: AppColors.page(context),
                child: mobileEditor,
              ),
            ),
        ],
      );
      return IndexedStack(
        index: _mobileIndex.clamp(0, 3),
        children: [files, terminal, tasks, codex],
      );
    }

    if (width < 1100) {
      return Row(
        children: [
          SizedBox(width: 300, child: sidebar),
          Expanded(child: terminal),
        ],
      );
    }

    return Row(
      children: [
        SizedBox(width: 310, child: sidebar),
        Expanded(flex: 7, child: terminal),
        SizedBox(
          width: 380,
          child: DefaultTabController(
            key: ValueKey('desktop-side-panel-$_desktopSidePanelIndex'),
            length: 3,
            initialIndex: _desktopSidePanelIndex,
            child: Column(
              children: [
                Material(
                  color: AppColors.chrome(context),
                  child: TabBar(
                    onTap: (index) =>
                        setState(() => _desktopSidePanelIndex = index),
                    labelColor: AppColors.primaryText(context),
                    unselectedLabelColor: AppColors.mutedText(context),
                    indicatorColor: AppColors.accent(context),
                    tabs: [
                      const Tab(icon: Icon(Icons.task_alt), text: 'Tasks'),
                      Tab(
                        icon: Icon(
                          CodingAgents.byId(_selectedAgentProvider).icon,
                        ),
                        text: 'Agent',
                      ),
                      const Tab(icon: Icon(Icons.edit_note), text: 'Editor'),
                    ],
                  ),
                ),
                Expanded(child: TabBarView(children: [tasks, codex, editor])),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
