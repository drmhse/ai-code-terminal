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
    final workbench = _WorkbenchPane(
      terminal: terminal,
      editorTabs: _editorTabsForWorkspace(_selectedWorkspace),
      activeTabKey: _activeWorkbenchTabKey,
      onTabSelected: _activateWorkbenchTab,
      onEditorClosed: _closeEditorTab,
      onEditorChanged: _cacheEditorTabDraft,
      onEditorSaved: (tab, content) => unawaited(_saveEditorTab(tab, content)),
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
          Expanded(child: workbench),
        ],
      );
    }

    return Row(
      children: [
        SizedBox(width: 310, child: sidebar),
        Expanded(flex: 7, child: workbench),
        SizedBox(
          width: 380,
          child: DefaultTabController(
            length: 2,
            child: Column(
              children: [
                Material(
                  color: AppColors.chrome(context),
                  child: TabBar(
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
                    ],
                  ),
                ),
                Expanded(child: TabBarView(children: [tasks, codex])),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _WorkbenchPane extends StatelessWidget {
  const _WorkbenchPane({
    required this.terminal,
    required this.editorTabs,
    required this.activeTabKey,
    required this.onTabSelected,
    required this.onEditorClosed,
    required this.onEditorChanged,
    required this.onEditorSaved,
  });

  final Widget terminal;
  final List<_OpenEditorTab> editorTabs;
  final String activeTabKey;
  final ValueChanged<String> onTabSelected;
  final ValueChanged<_OpenEditorTab> onEditorClosed;
  final void Function(_OpenEditorTab tab, String content) onEditorChanged;
  final void Function(_OpenEditorTab tab, String content) onEditorSaved;

  @override
  Widget build(BuildContext context) {
    final normalizedActiveKey =
        activeTabKey == 'terminal' ||
            editorTabs.any((tab) => tab.key == activeTabKey)
        ? activeTabKey
        : 'terminal';
    return Container(
      color: AppColors.field(context),
      child: Column(
        children: [
          _WorkbenchTabStrip(
            editorTabs: editorTabs,
            activeTabKey: normalizedActiveKey,
            onTabSelected: onTabSelected,
            onEditorClosed: onEditorClosed,
          ),
          Expanded(
            child: normalizedActiveKey == 'terminal'
                ? terminal
                : _EditorTabDeck(
                    editorTabs: editorTabs,
                    activeTabKey: normalizedActiveKey,
                    onEditorChanged: onEditorChanged,
                    onEditorSaved: onEditorSaved,
                  ),
          ),
        ],
      ),
    );
  }
}

class _WorkbenchTabStrip extends StatelessWidget {
  const _WorkbenchTabStrip({
    required this.editorTabs,
    required this.activeTabKey,
    required this.onTabSelected,
    required this.onEditorClosed,
  });

  final List<_OpenEditorTab> editorTabs;
  final String activeTabKey;
  final ValueChanged<String> onTabSelected;
  final ValueChanged<_OpenEditorTab> onEditorClosed;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 38,
      decoration: BoxDecoration(
        color: AppColors.chrome(context),
        border: Border(bottom: BorderSide(color: AppColors.line(context))),
      ),
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _WorkbenchTabButton(
            icon: Icons.terminal,
            label: 'Terminal',
            active: activeTabKey == 'terminal',
            onPressed: () => onTabSelected('terminal'),
          ),
          for (final tab in editorTabs)
            _WorkbenchTabButton(
              icon: tab.hasUnsavedDraft
                  ? Icons.edit_outlined
                  : Icons.description_outlined,
              label: tab.file.name,
              active: activeTabKey == tab.key,
              busy: tab.isLoading || tab.isSaving,
              onPressed: () => onTabSelected(tab.key),
              onClose: () => onEditorClosed(tab),
            ),
        ],
      ),
    );
  }
}

class _WorkbenchTabButton extends StatelessWidget {
  const _WorkbenchTabButton({
    required this.icon,
    required this.label,
    required this.active,
    required this.onPressed,
    this.busy = false,
    this.onClose,
  });

  final IconData icon;
  final String label;
  final bool active;
  final bool busy;
  final VoidCallback onPressed;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? AppColors.field(context) : Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        child: Container(
          constraints: const BoxConstraints(minWidth: 118, maxWidth: 220),
          padding: const EdgeInsets.only(left: 10, right: 5),
          decoration: BoxDecoration(
            border: Border(
              right: BorderSide(color: AppColors.line(context)),
              top: BorderSide(
                color: active ? AppColors.accent(context) : Colors.transparent,
                width: 2,
              ),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (busy)
                const SizedBox.square(
                  dimension: 13,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                Icon(
                  icon,
                  size: 16,
                  color: active
                      ? AppColors.accent(context)
                      : AppColors.mutedText(context),
                ),
              const SizedBox(width: 7),
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: active
                        ? AppColors.primaryText(context)
                        : AppColors.secondaryText(context),
                    fontSize: 12,
                    fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                    letterSpacing: 0,
                  ),
                ),
              ),
              if (onClose != null) ...[
                const SizedBox(width: 4),
                IconButton(
                  tooltip: 'Close file',
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints.tightFor(
                    width: 24,
                    height: 24,
                  ),
                  onPressed: onClose,
                  icon: const Icon(Icons.close, size: 14),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _EditorTabDeck extends StatelessWidget {
  const _EditorTabDeck({
    required this.editorTabs,
    required this.activeTabKey,
    required this.onEditorChanged,
    required this.onEditorSaved,
  });

  final List<_OpenEditorTab> editorTabs;
  final String activeTabKey;
  final void Function(_OpenEditorTab tab, String content) onEditorChanged;
  final void Function(_OpenEditorTab tab, String content) onEditorSaved;

  @override
  Widget build(BuildContext context) {
    final activeTab = editorTabs.firstWhere(
      (tab) => tab.key == activeTabKey,
      orElse: () => editorTabs.first,
    );
    final width = MediaQuery.sizeOf(context).width;
    final splitTabs = width >= 1400
        ? [
            activeTab,
            ...editorTabs.where((tab) => tab.key != activeTab.key).take(2),
          ]
        : [activeTab];

    return Row(
      children: [
        for (var index = 0; index < splitTabs.length; index++) ...[
          if (index > 0)
            VerticalDivider(width: 1, color: AppColors.line(context)),
          Expanded(child: _buildEditor(splitTabs[index])),
        ],
      ],
    );
  }

  Widget _buildEditor(_OpenEditorTab tab) {
    return EditorPreview(
      key: ValueKey('editor-preview-${tab.key}'),
      file: tab.file,
      content: tab.visibleContent,
      isLoading: tab.isLoading,
      isSaving: tab.isSaving,
      hasUnsavedDraft: tab.hasUnsavedDraft,
      onChanged: (content) => onEditorChanged(tab, content),
      onSave: (content) => onEditorSaved(tab, content),
    );
  }
}
