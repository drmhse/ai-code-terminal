part of '../act_home_page.dart';
// ignore_for_file: invalid_use_of_protected_member

extension _ActHomeWorkspaceRefresh on _ActHomePageState {
  Future<void> _refreshAll({bool allowTokenRefresh = true}) async {
    if (_isLoading) {
      return;
    }

    _cacheFileBrowserStateForCurrentWorkspace();
    final hadSelectedWorkspace = _selectedWorkspace != null;
    setState(() {
      _isRefreshingWorkspaces = true;
      _workspaceRefreshError = null;
      _statusMessage = _hasToken
          ? _workspaces.isEmpty
                ? 'Loading workspaces...'
                : 'Refreshing workspaces...'
          : 'Checking ACT connection...';
    });

    try {
      HealthStatus? health;
      UserProfile? user;
      AuthOsLinkedAccounts? linkedAccounts;
      List<Workspace> workspaces = const [];
      List<WorkspaceCollection> collections = const [];
      Workspace? selected;
      WorkspaceCollection? selectedCollection;

      if (_hasToken) {
        _ensureSocketClient();
        try {
          health = await _api.health();
        } catch (_) {
          health = _health;
        }
        user = await _api.me();
        linkedAccounts = await _loadLinkedAccounts(silent: true);
        workspaces = await _api.workspaces();
        collections = await _api.collections();
        selected = _nextSelectedWorkspace(workspaces);
        selectedCollection = _nextSelectedCollection(collections, selected);
      } else {
        health = await _api.health();
      }

      setState(() {
        _health = health ?? _health;
        _user = user;
        _linkedAccounts = linkedAccounts;
        _workspaces = workspaces;
        _collections = collections;
        _isRefreshingWorkspaces = false;
        _workspaceRefreshError = null;
        _selectedWorkspace = selected;
        _selectedCollection = selectedCollection;
        _restoreFileBrowserStateForWorkspace(selected);
        _showMobileEditor = false;
        _isLoadingFileContent = false;
        _isSavingFileContent = false;
        if (!_hasToken) {
          _linkedAccounts = null;
          _sessionBuffers = const {};
        }
        if (!_hasToken || !hadSelectedWorkspace) {
          _mobileIndex = 0;
        }
        _statusMessage = _hasToken ? 'Connected' : 'Workspace service ready';
      });
      if (_hasToken) {
        unawaited(_settingsStore.saveCachedWorkspaces(workspaces));
      }
      if (_hasToken) {
        unawaited(_refreshCodexSessions());
      }
      if (_hasToken && selected != null) {
        unawaited(_refreshWorkspaceDetails(selected));
      }
    } catch (error) {
      if (allowTokenRefresh &&
          error is ActApiException &&
          error.statusCode == 401 &&
          _refreshToken.isNotEmpty) {
        try {
          final tokens = await _authOs.refreshToken(_refreshToken);
          await _persistTokens(tokens);
          await _refreshAll(allowTokenRefresh: false);
          return;
        } catch (_) {
          await _expireAuthSession(
            'AuthOS session expired. Please sign in again.',
          );
          return;
        }
      }
      if (error is ActApiException && error.statusCode == 401) {
        await _expireAuthSession(
          'AuthOS session expired. Please sign in again.',
        );
        return;
      }
      final message = _hasToken
          ? 'Could not refresh the workspace.'
          : 'Workspace service is not reachable.';
      final detail = error is ActApiException
          ? error.message
          : error.toString();
      setState(() {
        _isRefreshingWorkspaces = false;
        _workspaceRefreshError = _hasToken
            ? 'Workspace refresh failed: $detail'
            : message;
        _statusMessage = _hasToken ? 'Workspace refresh failed' : message;
      });
    }
  }

  Future<void> _refreshWorkspaceDetails(Workspace selected) async {
    final generation = ++_workspaceDetailsGeneration;
    final sessionVersion = _sessionMutationVersion;
    List<TerminalSession>? sessions;
    SystemStats? stats;
    List<FileItem>? files;
    Map<String, String> sessionBuffers = const {};
    RunnerReadiness? runnerReadiness;
    List<NativeTask> tasks = const [];
    String? detailsError;

    final sessionsLoad = _captureLoad(_api.sessions());
    final statsLoad = _captureLoad(_api.systemStats());
    final filesLoad = _captureLoad(_api.workspaceFiles(selected.id));

    final sessionsResult = await sessionsLoad;
    if (sessionsResult.error == null) {
      sessions = sessionsResult.value;
    } else {
      detailsError ??= _workspaceDetailsError(
        'terminal sessions',
        sessionsResult.error!,
      );
    }

    final statsResult = await statsLoad;
    stats = statsResult.value;

    final filesResult = await filesLoad;
    if (filesResult.error == null) {
      files = filesResult.value?.items;
    } else {
      detailsError ??= _workspaceDetailsError(
        'workspace files',
        filesResult.error!,
      );
    }

    final canApplySessions = sessionVersion == _sessionMutationVersion;
    if (sessions != null && canApplySessions) {
      sessionBuffers = await _loadSessionBuffers(sessions);
    }

    try {
      runnerReadiness = await _api.runnerReadiness();
      final scopeType = _taskScopeType;
      final scopeId = _taskScopeId;
      final scopeWorkspace = scopeType == 'workspace'
          ? _workspaceForTaskScope(scopeId)
          : null;
      final scopeCollection = scopeType == 'collection'
          ? _collectionForTaskScope(scopeId)
          : null;
      final loadedTasks = await _api.nativeTasks(
        workspaceId: scopeType == 'workspace' ? scopeId : null,
        scopeType: scopeType == 'collection' ? 'collection' : null,
        scopeId: scopeType == 'collection' ? scopeId : null,
      );
      tasks = loadedTasks
          .where(
            (task) => _taskMatchesScope(
              task,
              workspace: scopeWorkspace,
              collection: scopeCollection,
            ),
          )
          .toList(growable: false);
    } catch (error) {
      detailsError ??= _workspaceDetailsError('ACT tasks', error);
    }

    if (!mounted ||
        generation != _workspaceDetailsGeneration ||
        _selectedWorkspace?.id != selected.id) {
      return;
    }

    setState(() {
      if (sessions != null && sessionVersion == _sessionMutationVersion) {
        _sessions = sessions;
        _sessionBuffers = _reconcileSessionBuffers(sessions, sessionBuffers);
        _selectFocusedTerminalForWorkspace(selected.id, sessions);
      }
      if (stats != null) {
        _systemStats = stats;
      }
      if (files != null) {
        _files = files;
        _seedFileIndex(files);
      }
      _runnerReadiness = runnerReadiness;
      _tasks = tasks;
      _selectedTask = tasks.isEmpty ? null : tasks.first;
      _tasksWorkspaceId = _taskScopeKey(_taskScopeType, _taskScopeId);
      _workspaceRefreshError = detailsError;
      if (detailsError != null) {
        _statusMessage = detailsError;
      }
      _cacheCurrentFileBrowserStateIfSelected(selected);
    });
    if (detailsError != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(detailsError),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
    if (files != null) {
      unawaited(_hydrateFileIndexForWorkspace(selected));
    }
  }

  String _workspaceDetailsError(String area, Object error) {
    final detail = error is ActApiException ? error.message : error.toString();
    return 'Could not load $area for ${_selectedWorkspace?.name ?? 'workspace'}: $detail';
  }
}
