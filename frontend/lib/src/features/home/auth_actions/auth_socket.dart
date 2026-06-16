part of '../act_home_page.dart';
// ignore_for_file: invalid_use_of_protected_member

extension _ActHomeAuthSocket on _ActHomePageState {
  Future<void> _startAuth(AuthOsProvider provider) async {
    if (actMockMode) {
      setState(() {
        _authToken = 'mock-access-token';
        _statusMessage = 'Demo mode is already signed in';
      });
      unawaited(_refreshAll());
      return;
    }

    setState(() {
      _isSaving = true;
      _statusMessage = 'Opening AuthOS ${provider.label} sign-in...';
    });

    try {
      await _settingsStore.save(
        apiBaseUrl: _normalizedBaseUrl,
        authOsBaseUrl: _normalizedAuthOsBaseUrl,
        profileId: _activeProfileId,
        profileLabel: _activeProfileLabel,
        authOsOrgSlug: _authOsOrgSlug,
        authOsServiceSlug: _authOsServiceSlug,
        authOsClientId: _authOsClientId,
        requiredGitHubScopes: _requiredGitHubScopes,
        authToken: _authToken,
        refreshToken: _refreshToken,
      );
      await _authOs.launchProvider(provider);
    } catch (error) {
      setState(() => _statusMessage = 'AuthOS sign-in failed: $error');
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  Future<void> _startProviderLink(AuthOsProvider provider) async {
    if (!_hasToken) {
      await _startAuth(provider);
      return;
    }

    setState(() {
      _isSaving = true;
      _statusMessage = 'Opening AuthOS ${provider.label} connection...';
    });

    try {
      await _settingsStore.save(
        apiBaseUrl: _normalizedBaseUrl,
        authOsBaseUrl: _normalizedAuthOsBaseUrl,
        profileId: _activeProfileId,
        profileLabel: _activeProfileLabel,
        authOsOrgSlug: _authOsOrgSlug,
        authOsServiceSlug: _authOsServiceSlug,
        authOsClientId: _authOsClientId,
        requiredGitHubScopes: _requiredGitHubScopes,
        authToken: _authToken,
        refreshToken: _refreshToken,
      );
      await _authOs.launchProviderLink(provider, accessToken: _authToken);
    } catch (error) {
      setState(
        () => _statusMessage = '${provider.label} connection failed: $error',
      );
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  Future<bool> _consumeAuthCallback(Uri uri) async {
    debugPrint(
      'AuthOS callback received: path=${uri.path}, '
      'hasQuery=${uri.query.isNotEmpty}, hasFragment=${uri.fragment.isNotEmpty}',
    );

    final linkResult = _authOs.linkResultFromCallback(uri);
    if (linkResult != null) {
      final provider = _providerLabel(linkResult.provider);
      clearAuthCallbackFromAddressBar(uri);
      if (!linkResult.success) {
        setState(
          () => _statusMessage =
              '$provider connection failed: ${linkResult.error ?? 'AuthOS returned an error'}',
        );
        return false;
      }

      final linkedProvider = _authOsProviderFor(linkResult.provider);
      setState(() => _statusMessage = '$provider connected');
      await _refreshLinkedProviderState(linkedProvider);
      unawaited(_refreshAll());
      return true;
    }

    final error = _authOs.callbackError(uri);
    if (error != null) {
      debugPrint('AuthOS callback contained an error response');
      setState(() => _statusMessage = 'AuthOS callback failed: $error');
      return false;
    }

    final tokens = _authOs.tokensFromCallback(uri);
    if (tokens == null) {
      if (_authOs.isCallbackUri(uri)) {
        debugPrint('AuthOS callback did not include an access token');
        setState(
          () => _statusMessage =
              'AuthOS returned without an access token. Please try again.',
        );
      }
      return false;
    }

    debugPrint('AuthOS callback included an access token');
    await _applyTokenAudienceProfile(tokens);
    await _persistTokens(tokens);
    clearAuthCallbackFromAddressBar(uri);
    setState(() => _statusMessage = 'Signed in with AuthOS');
    unawaited(_refreshAll());
    return true;
  }

  String _providerLabel(String? provider) {
    for (final candidate in AuthOsProvider.values) {
      if (candidate.slug == provider) {
        return candidate.label;
      }
    }
    return provider ?? 'Provider';
  }

  AuthOsProvider? _authOsProviderFor(String? provider) {
    for (final candidate in AuthOsProvider.values) {
      if (candidate.slug == provider) {
        return candidate;
      }
    }
    return null;
  }

  Future<void> _refreshLinkedProviderState(AuthOsProvider? provider) async {
    await _loadLinkedAccounts(force: true, silent: true);

    if (provider == null || provider == AuthOsProvider.github) {
      await _grantExistingProviderAccess(
        AuthOsProvider.github,
        _requiredGitHubScopes,
        silent: true,
      );
    }
    await _loadLinkedAccounts(force: true, silent: true);
  }

  Future<void> _listenForNativeCallbacks() async {
    if (kIsWeb) {
      return;
    }

    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null) {
        await _consumeAuthCallback(initial);
      }

      _linkSubscription = _appLinks.uriLinkStream.listen((uri) {
        _consumeAuthCallback(uri);
      });
    } catch (_) {
      // Deep links are unavailable in widget tests and some desktop shells.
    }
  }

  Future<void> _persistTokens(AuthOsTokens tokens) async {
    _authToken = tokens.accessToken;
    if (tokens.refreshToken != null && tokens.refreshToken!.isNotEmpty) {
      _refreshToken = tokens.refreshToken!;
    }
    await _settingsStore.save(
      apiBaseUrl: _normalizedBaseUrl,
      authOsBaseUrl: _normalizedAuthOsBaseUrl,
      profileId: _activeProfileId,
      profileLabel: _activeProfileLabel,
      authOsOrgSlug: _authOsOrgSlug,
      authOsServiceSlug: _authOsServiceSlug,
      authOsClientId: _authOsClientId,
      requiredGitHubScopes: _requiredGitHubScopes,
      authToken: _authToken,
      refreshToken: _refreshToken,
    );
    _ensureSocketClient();
  }

  Future<void> _applyTokenAudienceProfile(AuthOsTokens tokens) async {
    final resourceAudience = tokens.resourceAudience;
    if (resourceAudience == null ||
        _sameProfileUrl(resourceAudience, _normalizedBaseUrl)) {
      return;
    }

    final profile = await _profileForActUrl(resourceAudience);
    if (profile == null) {
      return;
    }
    await _settingsStore.switchProfile(profile);
    await _applyConnectionProfile(profile);
  }

  Future<AuthOsLinkedAccounts?> _loadLinkedAccounts({
    bool force = false,
    bool silent = false,
  }) async {
    if (actMockMode) {
      const accounts = AuthOsLinkedAccounts(
        accounts: [
          AuthOsLinkedAccount(
            id: 'github-demo',
            provider: 'github',
            scopes: ['repo', 'read:user', 'user:email', 'read:org'],
            status: 'active',
            displayName: 'example-user',
            email: 'demo@act.local',
            grants: [
              AuthOsLinkedAccountGrant(
                id: 'grant-demo',
                serviceId: 'act',
                scopes: ['repo', 'read:user', 'user:email', 'read:org'],
              ),
            ],
          ),
        ],
        availableProviders: [
          AuthOsProviderDefinition(
            provider: 'github',
            displayName: 'GitHub',
            scopes: ['repo', 'read:user', 'user:email', 'read:org'],
            connectSupported: true,
          ),
        ],
      );
      if (mounted) {
        setState(() => _linkedAccounts = accounts);
      } else {
        _linkedAccounts = accounts;
      }
      return accounts;
    }

    if (!_hasToken) {
      return null;
    }
    if (!force && _linkedAccounts != null) {
      return _linkedAccounts;
    }

    try {
      final accounts = await _authOs.linkedAccounts(accessToken: _authToken);
      if (mounted) {
        setState(() => _linkedAccounts = accounts);
      } else {
        _linkedAccounts = accounts;
      }
      return accounts;
    } catch (error) {
      if (!silent && mounted) {
        setState(
          () => _statusMessage = 'Could not load linked accounts: $error',
        );
      }
      return _linkedAccounts;
    }
  }

  Future<bool> _grantExistingProviderAccess(
    AuthOsProvider provider,
    List<String> requiredScopes, {
    bool silent = false,
  }) async {
    if (actMockMode) {
      return true;
    }

    if (!_hasToken) {
      return false;
    }

    final linkedAccounts =
        await _loadLinkedAccounts(force: true, silent: true) ?? _linkedAccounts;
    final accounts =
        linkedAccounts?.accountsFor(provider) ?? const <AuthOsLinkedAccount>[];
    if (accounts.isEmpty) {
      return false;
    }

    AuthOsLinkedAccount? scopedAccount;
    for (final account in accounts) {
      if (_missingScopes(account.scopes, requiredScopes).isEmpty) {
        scopedAccount = account;
        break;
      }
    }
    if (scopedAccount == null) {
      return false;
    }

    try {
      await _authOs.grantLinkedAccount(
        accountId: scopedAccount.id,
        scopes: requiredScopes,
        accessToken: _authToken,
      );
      await _loadLinkedAccounts(force: true, silent: true);
      if (!silent && mounted) {
        setState(() => _statusMessage = '${provider.label} enabled for ACT');
      }
      return true;
    } catch (error) {
      if (!silent && mounted) {
        setState(
          () => _statusMessage =
              '${provider.label} grant failed. Reconnect the account.',
        );
      }
      return false;
    }
  }

  void _ensureSocketClient() {
    if (!_hasToken) {
      return;
    }

    final key = '$_normalizedBaseUrl::$_authToken';
    if (_socketKey == key && _socketClient != null) {
      return;
    }

    _executionStartedSub?.cancel();
    _executionStatusSub?.cancel();
    _socketOutputSub?.cancel();
    _socketErrorSub?.cancel();
    _socketClient?.dispose();

    final client = actMockMode
        ? MockTerminalSocketClient()
        : TerminalSocketClient(baseUrl: _normalizedBaseUrl, token: _authToken);
    _socketClient = client;
    _socketKey = key;
    _executionStartedSub = client.executionStarted.listen((event) {
      if (!mounted) {
        return;
      }
      setState(() {
        _executionStatus = 'Started ${event.taskId}: ${event.status}';
      });
    });
    _executionStatusSub = client.executionStatus.listen((event) {
      if (!mounted) {
        return;
      }
      setState(() {
        final shortId = event.executionId.length > 8
            ? event.executionId.substring(0, 8)
            : event.executionId;
        _executionStatus = 'Execution $shortId: ${event.status}';
      });
      if (event.status == 'completed' || event.status == 'failed') {
        unawaited(_refreshTasksForWorkspace(_selectedWorkspace));
      }
    });
    _socketOutputSub = client.terminalOutput.listen((event) {
      final current = _sessionBuffers[event.sessionId] ?? '';
      final next = _trimTerminalBuffer('$current${event.output}');
      _sessionBuffers = {..._sessionBuffers, event.sessionId: next};
    });
    _socketErrorSub = client.errors.listen((error) {
      if (mounted) {
        setState(() => _statusMessage = error.message);
      }
    });
    client.connect();
  }

  Future<void> _logout() async {
    if (actMockMode) {
      setState(() {
        _authToken = 'mock-access-token';
        _statusMessage = 'Demo mode reset';
      });
      await _refreshAll();
      return;
    }

    await _settingsStore.clearToken();
    await _executionStartedSub?.cancel();
    await _executionStatusSub?.cancel();
    await _socketOutputSub?.cancel();
    await _socketErrorSub?.cancel();
    _codexRefreshTimer?.cancel();
    _codexRefreshTimer = null;
    _taskRefreshTimer?.cancel();
    _taskRefreshTimer = null;
    _socketClient?.dispose();
    _cacheFileBrowserStateForCurrentWorkspace();
    setState(() {
      _authToken = '';
      _refreshToken = '';
      _runnerReadiness = null;
      _tasks = const [];
      _selectedTask = null;
      _tasksWorkspaceId = null;
      _executionStatus = null;
      _socketClient = null;
      _socketKey = null;
      _user = null;
      _linkedAccounts = null;
      _workspaces = const [];
      _collections = const [];
      _codexSessions = const [];
      _codexEvents = const [];
      _selectedCodexSessionId = null;
      _codexError = null;
      _isComposingNewCodexChat = false;
      _activeTerminalSessionId = null;
      _isLoadingCodex = false;
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
      _selectedFileHasLocalDraft = false;
      _isLoadingFileContent = false;
      _isSavingFileContent = false;
      _sessionBuffers = const {};
      _statusMessage = 'Signed out';
    });
  }
}
