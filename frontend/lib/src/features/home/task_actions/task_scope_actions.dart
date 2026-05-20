part of '../act_home_page.dart';
// ignore_for_file: invalid_use_of_protected_member

extension _ActHomeTaskActions on _ActHomePageState {
  Future<void> _expireAuthSession(String message) async {
    await _settingsStore.clearToken();
    await _settingsStore.clearCachedWorkspaces();
    await _executionStartedSub?.cancel();
    await _executionStatusSub?.cancel();
    await _socketOutputSub?.cancel();
    await _socketErrorSub?.cancel();
    _codexRefreshTimer?.cancel();
    _codexRefreshTimer = null;
    _taskRefreshTimer?.cancel();
    _taskRefreshTimer = null;
    _socketClient?.dispose();
    if (!mounted) {
      return;
    }
    _cacheFileBrowserStateForCurrentWorkspace();
    setState(() {
      _authToken = '';
      _refreshToken = '';
      _socketClient = null;
      _socketKey = null;
      _user = null;
      _linkedAccounts = null;
      _runnerReadiness = null;
      _tasks = const [];
      _selectedTask = null;
      _tasksWorkspaceId = null;
      _executionStatus = null;
      _workspaces = const [];
      _collections = const [];
      _codexSessions = const [];
      _codexEvents = const [];
      _selectedCodexSessionId = null;
      _codexError = null;
      _isComposingNewCodexChat = false;
      _activeTerminalSessionId = null;
      _isLoadingCodex = false;
      _isLaunchingCodex = false;
      _isRefreshingWorkspaces = false;
      _workspaceRefreshError = null;
      _sessions = const [];
      _fileBrowserSnapshots.clear();
      _resetFileBrowserState();
      _selectedWorkspace = null;
      _selectedCollection = null;
      _selectedFile = null;
      _selectedFileContent = null;
      _showMobileEditor = false;
      _sessionBuffers = const {};
      _statusMessage = message;
    });
  }

  Future<void> _selectWorkspace(
    Workspace workspace, {
    WorkspaceCollection? collectionOverride,
    bool selectContainingCollection = true,
  }) async {
    final collection =
        collectionOverride ??
        (selectContainingCollection
            ? _collections.cast<WorkspaceCollection?>().firstWhere(
                (candidate) =>
                    candidate?.containsWorkspace(workspace.id) == true,
                orElse: () => null,
              )
            : null);
    _cacheFileBrowserStateForCurrentWorkspace();
    _workspaceDetailsGeneration += 1;
    setState(() {
      _selectedWorkspace = workspace;
      _selectedCollection = collection;
      if (collectionOverride != null) {
        _taskScopeType = 'collection';
        _taskScopeId = collectionOverride.id;
      } else {
        _taskScopeType = 'workspace';
        _taskScopeId = workspace.id;
      }
      _isLoadingFileContent = false;
      _isSavingFileContent = false;
      _showMobileEditor = false;
      _restoreFileBrowserStateForWorkspace(workspace);
      _mobileIndex = 0;
    });

    unawaited(_refreshWorkspaceDetails(workspace));
    unawaited(_refreshCodexSessions(silent: true));
  }

  Future<void> _selectCollection(WorkspaceCollection collection) async {
    final primaryWorkspaceId =
        collection.defaultWorkspaceId ??
        (collection.members.isEmpty
            ? null
            : collection.members.first.workspaceId);
    final workspace = primaryWorkspaceId == null
        ? null
        : _workspaces.cast<Workspace?>().firstWhere(
                (candidate) => candidate?.id == primaryWorkspaceId,
                orElse: () => null,
              ) ??
              collection.members
                  .map((member) => member.workspace)
                  .cast<Workspace?>()
                  .firstWhere(
                    (candidate) => candidate != null,
                    orElse: () => null,
                  );
    setState(() {
      _selectedCollection = collection;
      _taskScopeType = 'collection';
      _taskScopeId = collection.id;
      _codexWorkspaceFilterId = null;
      _codexCollectionFilterId = null;
    });
    if (workspace != null) {
      await _selectWorkspace(workspace, collectionOverride: collection);
    } else {
      unawaited(_refreshCodexSessions(silent: true));
    }
  }

  Future<void> _refreshTasksForWorkspace(
    Workspace? workspace, {
    bool showLoading = true,
  }) async {
    final scopeType = _taskScopeType;
    final scopeId = _taskScopeId;
    if (!_hasToken) {
      return;
    }
    final scopeKey = _taskScopeKey(scopeType, scopeId);
    final scopeWorkspace = scopeType == 'workspace'
        ? _workspaceForTaskScope(scopeId)
        : null;
    final scopeCollection = scopeType == 'collection'
        ? _collectionForTaskScope(scopeId)
        : null;

    final previousTaskId = _selectedTask?.id;
    if (showLoading) {
      setState(() {
        _isLoadingTasks = true;
        _tasks = const [];
        _tasksWorkspaceId = scopeKey;
      });
    }

    try {
      final readiness = await _api.runnerReadiness();
      final allTasks = await _api.nativeTasks(
        workspaceId: scopeType == 'workspace' ? scopeId : null,
        scopeType: scopeType == 'collection' ? 'collection' : null,
        scopeId: scopeType == 'collection' ? scopeId : null,
      );
      final tasks = allTasks
          .where(
            (task) => _taskMatchesScope(
              task,
              workspace: scopeWorkspace,
              collection: scopeCollection,
            ),
          )
          .toList(growable: false);
      if (!mounted) {
        return;
      }
      if (_taskScopeKey(_taskScopeType, _taskScopeId) != scopeKey) {
        return;
      }
      setState(() {
        _runnerReadiness = readiness;
        _tasks = tasks;
        _selectedTask = tasks.cast<NativeTask?>().firstWhere(
          (task) => task?.id == previousTaskId,
          orElse: () => tasks.isEmpty ? null : tasks.first,
        );
        _tasksWorkspaceId = scopeKey;
        _isLoadingTasks = false;
        if (!_hasActiveNativeTasks(tasks)) {
          _executionStatus = null;
        }
      });
      _syncTaskRefreshTimer();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _isLoadingTasks = false;
        _statusMessage = 'Task refresh failed: $error';
      });
    }
  }

  void _syncTaskRefreshTimer() {
    final hasActiveTasks = _hasActiveNativeTasks(_tasks);
    if (!hasActiveTasks || !_hasToken) {
      _taskRefreshTimer?.cancel();
      _taskRefreshTimer = null;
      return;
    }
    _taskRefreshTimer ??= Timer.periodic(const Duration(seconds: 4), (_) {
      if (!_hasToken || !_hasActiveNativeTasks(_tasks)) {
        _taskRefreshTimer?.cancel();
        _taskRefreshTimer = null;
        return;
      }
      unawaited(
        _refreshTasksForWorkspace(_selectedWorkspace, showLoading: false),
      );
    });
  }

  bool _hasActiveNativeTasks(List<NativeTask> tasks) {
    return tasks.any((task) {
      final taskStatus = task.status.toLowerCase();
      final runStatus = task.latestRun?.status.toLowerCase();
      return _activeNativeTaskStatus(taskStatus) ||
          (runStatus != null && _activeNativeTaskStatus(runStatus));
    });
  }

  bool _activeNativeTaskStatus(String status) {
    return status == 'queued' ||
        status == 'starting' ||
        status == 'running' ||
        status == 'finalizing' ||
        status == 'interrupting';
  }

  Future<void> _runTask(NativeTask task) async {
    if (!_canOperateHost) {
      setState(() => _statusMessage = 'Operator access required');
      return;
    }
    final scopeKey = _taskScopeKey(_taskScopeType, _taskScopeId);
    if (_tasksWorkspaceId != scopeKey ||
        !_tasks.any((candidate) => candidate.id == task.id)) {
      setState(() => _statusMessage = 'Refresh tasks before starting work.');
      return;
    }

    try {
      final run = await _api.startNativeTaskRun(task.id);
      final runAgent = CodingAgents.byId(run.agentProvider);
      setState(() {
        _selectedTask = task;
        if (run.codexSessionId?.trim().isNotEmpty == true) {
          _selectedCodexSessionId = run.codexSessionId;
          _codexWorkspaceFilterId = null;
          _codexCollectionFilterId = null;
          _isComposingNewCodexChat = false;
        }
        _executionStatus = run.queuePosition > 0
            ? 'Queued ${task.title} for ${runAgent.label} at position ${run.queuePosition}'
            : 'Running ${task.title} with ${runAgent.label}';
      });
      _syncTaskRefreshTimer();
      await Future<void>.delayed(const Duration(milliseconds: 700));
      await _refreshTasksForWorkspace(_selectedWorkspace);
      unawaited(_refreshCodexSessions(silent: true));
    } catch (error) {
      setState(() => _statusMessage = 'Task run failed: $error');
    }
  }

  Future<void> _updateTask(NativeTask task, TaskUpdateDraft draft) async {
    if (_selectedWorkspace == null && _selectedCollection == null) {
      return;
    }

    try {
      final updated = await _api.updateNativeTask(
        taskId: task.id,
        title: draft.title,
        description: draft.description.isEmpty
            ? draft.title
            : draft.description,
        workspaceIds: draft.workspaceIds,
        collectionIds: draft.collectionIds,
        finalReportInstructions: draft.finalReportInstructions,
        executionMode: draft.executionMode,
        approvalMode: draft.approvalMode,
        evidencePreference: draft.evidencePreference,
        agentProvider: draft.agentProvider,
        providerModel: draft.providerModel,
        providerThinkingLevel: draft.providerThinkingLevel,
      );
      if (!mounted) {
        return;
      }
      _replaceNativeTask(updated);
      setState(() {
        _statusMessage = 'Updated ${updated.title}';
      });
      await _refreshTasksForWorkspace(_selectedWorkspace);
    } catch (error) {
      if (mounted) {
        setState(() => _statusMessage = 'Task update failed: $error');
      }
    }
  }

  Future<void> _openTaskCodexSession(String sessionId) async {
    setState(() {
      _mobileIndex = 3;
      _selectedCodexSessionId = sessionId;
      _codexWorkspaceFilterId = null;
      _codexCollectionFilterId = null;
      _isComposingNewCodexChat = false;
      _codexEvents = const [];
    });
    await _refreshCodexEvents(sessionId: sessionId);
    unawaited(_refreshCodexSessions(silent: true));
  }

  Future<NativeTaskArtifactContent> _loadTaskArtifact(
    NativeTask task,
    NativeTaskRun run,
    NativeTaskArtifact artifact,
  ) {
    return _api.nativeTaskRunArtifact(
      taskId: task.id,
      runId: run.id,
      artifactId: artifact.id,
    );
  }

  Future<void> _finalizeTaskRun(NativeTask task, NativeTaskRun run) async {
    if (!_canOperateHost) {
      setState(() => _statusMessage = 'Operator access required');
      return;
    }
    try {
      final updated = await _api.finalizeNativeTaskRun(
        taskId: task.id,
        runId: run.id,
      );
      if (!mounted) {
        return;
      }
      _replaceNativeTask(updated);
      setState(() => _statusMessage = 'Finalized ${updated.title}');
    } catch (error) {
      if (mounted) {
        setState(() => _statusMessage = 'Finalize failed: $error');
      }
    }
  }

  Future<void> _createTaskPullRequests(
    NativeTask task,
    NativeTaskRun run,
  ) async {
    if (!_canOperateHost) {
      setState(() => _statusMessage = 'Operator access required');
      return;
    }
    try {
      await _grantExistingProviderAccess(
        AuthOsProvider.github,
        _requiredGitHubScopes,
        silent: true,
      );
      final updated = await _api.createNativeTaskRunPullRequests(
        taskId: task.id,
        runId: run.id,
      );
      if (!mounted) {
        return;
      }
      _replaceNativeTask(updated);
      setState(() => _statusMessage = 'Updated PR state for ${updated.title}');
    } catch (error) {
      if (mounted) {
        setState(() => _statusMessage = 'PR creation failed: $error');
      }
    }
  }

  bool _canCreatePullRequestsForCodexSession(CodexSessionSummary session) {
    final match = _taskRunForCodexSession(session);
    if (match == null) {
      return false;
    }
    return !_nativeRunIsActive(match.run);
  }

  Future<void> _createPullRequestsForCodexSession(
    CodexSessionSummary session,
  ) async {
    final match = _taskRunForCodexSession(session);
    if (match == null) {
      setState(() => _statusMessage = 'No linked ACT task run found.');
      return;
    }
    await _createTaskPullRequests(match.task, match.run);
    unawaited(_refreshCodexSessions(silent: true));
  }

  ({NativeTask task, NativeTaskRun run})? _taskRunForCodexSession(
    CodexSessionSummary session,
  ) {
    for (final task in _tasks) {
      for (final run in task.runs) {
        if (_taskRunMatchesCodexSession(run, session)) {
          return (task: task, run: run);
        }
      }
    }
    return null;
  }

  bool _taskRunMatchesCodexSession(
    NativeTaskRun run,
    CodexSessionSummary session,
  ) {
    final sessionIds = {
      session.id,
      if (session.runtimeSessionId != null) session.runtimeSessionId!,
      if (session.providerSessionId != null) session.providerSessionId!,
    };
    return [
      run.codexSessionId,
      run.providerSessionId,
    ].whereType<String>().any(sessionIds.contains);
  }

  bool _nativeRunIsActive(NativeTaskRun run) {
    return const {
      'queued',
      'starting',
      'running',
      'finalizing',
    }.contains(run.status);
  }

  Future<void> _cloneTask(NativeTask task) async {
    if (_selectedWorkspace == null && _selectedCollection == null) {
      return;
    }
    try {
      final cloned = await _api.createNativeTask(
        title: 'Copy of ${task.title}',
        description: task.description.isEmpty ? task.title : task.description,
        workspaceIds: task.workspaces
            .map((taskWorkspace) => taskWorkspace.workspaceId)
            .toList(growable: false),
        collectionIds: task.sourceCollections
            .map((collection) => collection.collectionId)
            .where((id) => id.isNotEmpty)
            .toList(growable: false),
        finalReportInstructions: task.finalReportInstructions ?? '',
        executionMode: task.executionMode,
        approvalMode: task.approvalMode,
        evidencePreference: task.evidencePreference,
        agentProvider: task.agentProvider,
        providerModel: task.providerModel ?? '',
        providerThinkingLevel: task.providerThinkingLevel ?? '',
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _tasks = [
          cloned,
          ..._tasks.where((candidate) => candidate.id != cloned.id),
        ];
        _selectedTask = cloned;
        _statusMessage = 'Cloned ${task.title}';
      });
      await _refreshTasksForWorkspace(_selectedWorkspace);
    } catch (error) {
      if (mounted) {
        setState(() => _statusMessage = 'Task clone failed: $error');
      }
    }
  }

  void _replaceNativeTask(NativeTask updated) {
    final workspace = _selectedWorkspace;
    final collection = _selectedCollection;
    setState(() {
      _selectedTask = updated;
      _tasks = _tasks
          .map((candidate) => candidate.id == updated.id ? updated : candidate)
          .where(
            (candidate) => _taskMatchesScope(
              candidate,
              workspace: collection == null ? workspace : null,
              collection: collection,
            ),
          )
          .toList(growable: false);
    });
  }
}
