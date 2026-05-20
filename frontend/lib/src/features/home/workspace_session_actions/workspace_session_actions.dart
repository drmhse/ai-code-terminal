part of '../act_home_page.dart';
// ignore_for_file: invalid_use_of_protected_member

extension _ActHomeWorkspaceSessionActions on _ActHomePageState {
  Future<void> _showCloneRepositoryDialog() async {
    if (_isPreparingGitHubClone) {
      return;
    }
    setState(() {
      _isPreparingGitHubClone = true;
      _statusMessage = 'Opening GitHub...';
    });
    try {
      await _grantExistingProviderAccess(
        AuthOsProvider.github,
        _requiredGitHubScopes,
        silent: true,
      );
      var status = await _api.githubProviderStatus(
        redirectUri: defaultAuthOsRedirectUri(),
      );
      if (status.actionRequired &&
          status.reauthUrl?.isNotEmpty == true &&
          _hasToken) {
        final completedExistingGrant = await _authOs
            .completeProviderTokenRequestWithExistingAccount(
              status.reauthUrl!,
              accessToken: _authToken,
            );
        if (completedExistingGrant) {
          await _loadLinkedAccounts(force: true, silent: true);
          status = await _api.githubProviderStatus(
            redirectUri: defaultAuthOsRedirectUri(),
          );
        }
      }
      if (status.actionRequired && status.reauthUrl?.isNotEmpty == true) {
        if (!mounted) {
          return;
        }
        setState(() => _isPreparingGitHubClone = false);
        final missing = status.missingScopes.isEmpty
            ? status.actionCode ?? 'repository access'
            : status.missingScopes.join(', ');
        await _showGitHubAccessDialog(
          title: 'GitHub needs authorization',
          message:
              'Authorize GitHub for ACT, then try again. Missing access: $missing.',
          canReconnect: true,
          reauthUrl: status.reauthUrl,
        );
        setState(() => _statusMessage = 'GitHub authorization required');
        return;
      }
      if (!status.available || !status.hasAccessToken) {
        if (!mounted) {
          return;
        }
        setState(() => _isPreparingGitHubClone = false);
        await _showGitHubAccessDialog(
          title: 'GitHub needs reconnect',
          message:
              'Reconnect GitHub, then try cloning again. ACT could not confirm an active GitHub connection for this session.',
          canReconnect: true,
          reauthUrl: status.reauthUrl,
        );
        setState(() => _statusMessage = 'GitHub needs reconnect');
        return;
      }
      final missingScopes = _missingScopes(
        status.scopes,
        _requiredGitHubScopes,
      );
      if (missingScopes.isNotEmpty) {
        if (!mounted) {
          return;
        }
        setState(() => _isPreparingGitHubClone = false);
        await _showGitHubAccessDialog(
          title: 'GitHub needs reconnect',
          message:
              'Reconnect GitHub, then try cloning again. ACT could not confirm repository access for this session.',
          canReconnect: true,
          reauthUrl: status.reauthUrl,
        );
        setState(() => _statusMessage = 'GitHub needs reconnect');
        return;
      }

      final repositories = await _api.githubRepositoriesPage();
      if (!mounted) {
        return;
      }
      setState(() => _isPreparingGitHubClone = false);
      final workspace = await showGitHubCloneDialog(
        context: context,
        status: status,
        initialPage: repositories,
        onSearch: (query, page) =>
            _api.githubRepositoriesPage(search: query, page: page),
        onClone: (repository) => _api.cloneGitHubRepository(
          repository,
          collectionId: _selectedCollection?.id,
        ),
      );
      if (workspace == null) {
        setState(() => _statusMessage = 'Connected');
        return;
      }

      _cacheFileBrowserStateForCurrentWorkspace();
      setState(() {
        _selectedWorkspace = workspace;
        _restoreFileBrowserStateForWorkspace(workspace);
        _mobileIndex = 0;
        _statusMessage = 'Workspace ready';
      });
      await _refreshAll();
    } catch (error) {
      if (mounted) {
        final statusCode = error is ActApiException ? error.statusCode : null;
        final isBackendError =
            error is ActApiException &&
            (statusCode == null || statusCode >= 500);
        await _showGitHubAccessDialog(
          title: isBackendError
              ? 'ACT backend unavailable'
              : 'GitHub repositories unavailable',
          message: isBackendError
              ? 'ACT could not load repositories right now. Refresh the app after the backend is healthy.'
              : 'Reconnect GitHub, then try cloning again. ACT could not load repositories for this session.',
          canReconnect: !isBackendError,
        );
      }
      setState(() => _statusMessage = 'GitHub clone failed');
    } finally {
      if (mounted && _isPreparingGitHubClone) {
        setState(() => _isPreparingGitHubClone = false);
      }
    }
  }

  List<String> _missingScopes(List<String> scopes, List<String> required) {
    final granted = scopes.map((scope) => scope.trim().toLowerCase()).toSet();
    return required
        .where((scope) => !granted.contains(scope.toLowerCase()))
        .toList(growable: false);
  }

  Future<void> _showGitHubAccessDialog({
    required String title,
    required String message,
    required bool canReconnect,
    String? reauthUrl,
  }) async {
    final action = await showDialog<_GitHubAccessAction>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () =>
                Navigator.pop(context, _GitHubAccessAction.dismiss),
            child: const Text('Close'),
          ),
          if (canReconnect)
            FilledButton.icon(
              onPressed: () =>
                  Navigator.pop(context, _GitHubAccessAction.reconnect),
              icon: const Icon(Icons.login),
              label: const Text('Reconnect GitHub'),
            ),
        ],
      ),
    );
    if (action == _GitHubAccessAction.reconnect) {
      if (reauthUrl?.isNotEmpty == true && _hasToken) {
        await _authOs.launchProviderTokenRequestLink(
          reauthUrl!,
          accessToken: _authToken,
        );
      } else {
        _startProviderLink(AuthOsProvider.github);
      }
    }
  }

  Future<void> _showLinkedAccountsDialog() async {
    if (!_hasToken) {
      return;
    }

    final linkedAccounts = await _loadLinkedAccounts(force: true);
    if (!mounted) {
      return;
    }

    final provider = await showDialog<AuthOsProvider>(
      context: context,
      builder: (dialogContext) => _LinkedAccountsDialog(
        linkedAccounts: linkedAccounts ?? _linkedAccounts,
        onProviderSelected: (provider) =>
            Navigator.pop(dialogContext, provider),
      ),
    );
    if (provider != null) {
      await _startProviderLink(provider);
    }
  }

  Future<void> _createSession() async {
    if (!_canOperateHost) {
      setState(() => _statusMessage = 'Operator access required');
      return;
    }
    if (_isCreatingTerminal) {
      return;
    }
    final workspace = _selectedWorkspace;
    if (workspace == null) {
      setState(() => _statusMessage = 'Select a workspace first');
      return;
    }

    setState(() {
      _isCreatingTerminal = true;
      _mobileIndex = 1;
      _statusMessage = 'Starting terminal...';
    });
    try {
      final session = await _api.createSession(workspace.id);
      final buffer = await _api.sessionBuffer(session.id);
      _sessionMutationVersion += 1;
      setState(() {
        _sessions = [session, ..._sessions];
        _sessionBuffers = {..._sessionBuffers, session.id: buffer};
        _activeTerminalSessionId = session.id;
        _mobileIndex = 1;
        _statusMessage = 'Started ${session.sessionName}';
      });
    } catch (error) {
      setState(() => _statusMessage = 'Session creation failed: $error');
    } finally {
      if (mounted) {
        setState(() => _isCreatingTerminal = false);
      }
    }
  }

  Future<void> _terminateSession(TerminalSession session) async {
    _sessionMutationVersion += 1;
    final workspaceId = session.workspaceId;
    setState(() {
      _sessions = _sessions
          .where((candidate) => candidate.id != session.id)
          .toList(growable: false);
      if (_activeTerminalSessionId == session.id) {
        _activeTerminalSessionId = null;
      }
      _sessionBuffers = _sessionBuffersWithout(session.id);
      _statusMessage = 'Closing ${session.sessionName}...';
    });
    try {
      _socketClient?.terminateTerminal(session.id);
      await _api.terminateSession(session.id);
      List<TerminalSession>? sessions;
      Map<String, String> sessionBuffers = const {};
      try {
        sessions = await _api.sessions();
        sessionBuffers = await _loadSessionBuffers(sessions);
      } catch (_) {}
      setState(() {
        if (sessions != null) {
          _sessions = sessions;
          _sessionBuffers = _reconcileSessionBuffers(sessions, sessionBuffers);
          if (workspaceId != null) {
            _selectFocusedTerminalForWorkspace(workspaceId, sessions);
          }
        } else {
          _sessionBuffers = _sessionBuffersWithout(session.id);
        }
        _statusMessage = 'Closed ${session.sessionName}';
      });
    } catch (error) {
      if (_isSessionNotFound(error, session.id)) {
        setState(() {
          _sessionBuffers = _sessionBuffersWithout(session.id);
          _statusMessage = 'Removed stale ${session.sessionName}';
        });
        return;
      }
      setState(() {
        _statusMessage = 'Terminal close did not confirm: $error';
      });
    }
  }

  void _discardStaleSession(TerminalSession session) {
    if (!_sessions.any((candidate) => candidate.id == session.id)) {
      return;
    }
    _sessionMutationVersion += 1;
    setState(() {
      _sessions = _sessions
          .where((candidate) => candidate.id != session.id)
          .toList(growable: false);
      if (_activeTerminalSessionId == session.id) {
        _activeTerminalSessionId = null;
      }
      _sessionBuffers = _sessionBuffersWithout(session.id);
      _statusMessage = 'Removed stale ${session.sessionName}';
    });
  }

  bool _isSessionNotFound(Object error, String sessionId) {
    final message = error.toString().toLowerCase();
    return message.contains(sessionId.toLowerCase()) &&
        message.contains('not found');
  }

  Future<void> _saveCurrentTerminalLayout() async {
    final workspace = _selectedWorkspace;
    if (workspace == null) {
      return;
    }
    final count = _sessions
        .where((session) => session.workspaceId == workspace.id)
        .length;
    if (count == 0) {
      setState(() => _statusMessage = 'Create a terminal before saving layout');
      return;
    }

    try {
      await _api.saveTerminalLayout(
        workspaceId: workspace.id,
        paneCount: count,
      );
      setState(() => _statusMessage = 'Saved terminal layout');
    } catch (error) {
      setState(() => _statusMessage = 'Layout save failed: $error');
    }
  }

  Workspace? _nextSelectedWorkspace(List<Workspace> workspaces) {
    if (workspaces.isEmpty) {
      return null;
    }
    return workspaces.firstWhere(
      (workspace) => workspace.id == _selectedWorkspace?.id,
      orElse: () => workspaces.first,
    );
  }

  WorkspaceCollection? _nextSelectedCollection(
    List<WorkspaceCollection> collections,
    Workspace? selectedWorkspace,
  ) {
    if (collections.isEmpty) {
      return null;
    }
    final current = collections.cast<WorkspaceCollection?>().firstWhere(
      (collection) => collection?.id == _selectedCollection?.id,
      orElse: () => null,
    );
    if (current != null) {
      return current;
    }
    if (selectedWorkspace != null) {
      return collections.cast<WorkspaceCollection?>().firstWhere(
        (collection) =>
            collection?.containsWorkspace(selectedWorkspace.id) == true,
        orElse: () => null,
      );
    }
    return null;
  }

  ActApi get _api {
    return ActApi(
      client: _client,
      baseUrl: _normalizedBaseUrl,
      token: _authToken,
    );
  }

  AuthOsClient get _authOs {
    return AuthOsClient(client: _client, config: _authOsConfig);
  }

  AuthOsConfig get _authOsConfig {
    return AuthOsConfig(
      baseUrl: _normalizedAuthOsBaseUrl,
      orgSlug: _authOsOrgSlug,
      serviceSlug: _authOsServiceSlug,
      clientId: _authOsClientId,
    );
  }
}
