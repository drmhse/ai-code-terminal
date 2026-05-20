part of '../act_home_page.dart';
// ignore_for_file: invalid_use_of_protected_member

extension _ActHomeSettingsProfiles on _ActHomePageState {
  Future<void> _bootstrap() async {
    await _loadSettings();
    if (!actMockMode) {
      for (final uri in authCallbackUrisForBootstrap()) {
        final consumed = await _consumeAuthCallback(uri);
        if (consumed) {
          break;
        }
      }
    }
    if (!mounted) {
      return;
    }
    setState(() => _isLoading = false);
    if (!actMockMode) {
      unawaited(_listenForNativeCallbacks());
    }
    await _refreshAll();
  }

  Future<void> _loadSettings() async {
    if (actMockMode) {
      _apiBaseUrl = defaultApiBaseUrl();
      _authOsBaseUrl = defaultAuthOsBaseUrl();
      _authOsOrgSlug = authOsOrgSlug;
      _authOsServiceSlug = authOsServiceSlug;
      _authOsClientId = authOsClientId;
      _requiredGitHubScopes = _ActHomePageState._defaultRequiredGitHubScopes;
      _activeProfileId = 'mock';
      _activeProfileLabel = 'ACT demo';
      _authToken = 'mock-access-token';
      _refreshToken = '';
      _terminalControlsExpanded = true;
      _statusMessage = 'Demo mode: no backend connection required';
      return;
    }

    final fallbackApiBaseUrl = defaultApiBaseUrl();
    final fallbackAuthOsBaseUrl = defaultAuthOsBaseUrl();
    final settings = await _settingsStore.load(
      fallbackApiBaseUrl: fallbackApiBaseUrl,
      fallbackAuthOsBaseUrl: fallbackAuthOsBaseUrl,
      fallbackAuthOsOrgSlug: authOsOrgSlug,
      fallbackAuthOsServiceSlug: authOsServiceSlug,
      fallbackAuthOsClientId: authOsClientId,
      fallbackRequiredGitHubScopes:
          _ActHomePageState._defaultRequiredGitHubScopes,
    );
    final releaseMobileBuild = isReleaseMobileBuild();
    final explicitApiBaseUrlOverride = hasConfiguredApiBaseUrlOverride();
    final explicitAuthOsBaseUrlOverride = hasConfiguredAuthOsBaseUrlOverride();
    final explicitApiBaseUrlChanged =
        explicitApiBaseUrlOverride && settings.apiBaseUrl != fallbackApiBaseUrl;
    final releaseMobileNeedsStateReset =
        releaseMobileBuild &&
        await _settingsStore.loadReleaseMobileStateVersion() !=
            _ActHomePageState._releaseMobileStateVersion;
    final replacedPersistedApiBaseUrl = shouldReplacePersistedApiBaseUrl(
      settings.apiBaseUrl,
      activeProfileId: settings.profileId,
    );
    final forceHostedMobileProfile =
        releaseMobileBuild && settings.profileId == 'hosted';
    _apiBaseUrl =
        forceHostedMobileProfile ||
            replacedPersistedApiBaseUrl ||
            explicitApiBaseUrlOverride
        ? fallbackApiBaseUrl
        : settings.apiBaseUrl;
    _authOsBaseUrl = forceHostedMobileProfile || explicitAuthOsBaseUrlOverride
        ? fallbackAuthOsBaseUrl
        : settings.authOsBaseUrl;
    _authOsOrgSlug = settings.authOsOrgSlug;
    _authOsServiceSlug = settings.authOsServiceSlug;
    _authOsClientId = settings.authOsClientId;
    _requiredGitHubScopes = settings.requiredGitHubScopes.isEmpty
        ? _ActHomePageState._defaultRequiredGitHubScopes
        : settings.requiredGitHubScopes;
    _activeProfileId = settings.profileId;
    _activeProfileLabel = settings.profileLabel;
    final resetPersistedSession =
        releaseMobileNeedsStateReset || replacedPersistedApiBaseUrl;
    _authToken = resetPersistedSession ? '' : settings.authToken;
    _refreshToken = resetPersistedSession ? '' : settings.refreshToken;
    if (forceHostedMobileProfile ||
        resetPersistedSession ||
        explicitApiBaseUrlOverride ||
        explicitAuthOsBaseUrlOverride) {
      await _settingsStore.save(
        apiBaseUrl: _apiBaseUrl,
        authOsBaseUrl: _authOsBaseUrl,
        profileId: _activeProfileId,
        profileLabel: _activeProfileLabel,
        authOsOrgSlug: _authOsOrgSlug,
        authOsServiceSlug: _authOsServiceSlug,
        authOsClientId: _authOsClientId,
        requiredGitHubScopes: _requiredGitHubScopes,
        authToken: _authToken,
        refreshToken: _refreshToken,
      );
    }
    if (resetPersistedSession || explicitApiBaseUrlChanged) {
      await _settingsStore.clearCachedWorkspaces();
    }
    if (releaseMobileBuild) {
      await _settingsStore.saveReleaseMobileStateVersion(
        _ActHomePageState._releaseMobileStateVersion,
      );
    }
    _terminalControlsExpanded = await _settingsStore
        .loadTerminalControlsExpanded();
    if (_authToken.isNotEmpty) {
      final cachedWorkspaces = await _settingsStore.loadCachedWorkspaces();
      if (cachedWorkspaces.isNotEmpty) {
        _workspaces = cachedWorkspaces;
        _selectedWorkspace = cachedWorkspaces.first;
        _workspaceRefreshError =
            'Showing cached workspaces while ACT refreshes.';
      }
    }
  }

  ConnectionProfile _hostedProfile() {
    return ConnectionProfile(
      id: 'hosted',
      label: 'Hosted ACT',
      apiBaseUrl: defaultApiBaseUrl(),
      authOsBaseUrl: defaultAuthOsBaseUrl(),
      authOsOrgSlug: authOsOrgSlug,
      authOsServiceSlug: authOsServiceSlug,
      authOsClientId: authOsClientId,
      requiredGitHubScopes: _ActHomePageState._defaultRequiredGitHubScopes,
      builtIn: true,
    );
  }

  Future<void> _setTerminalControlsExpanded(bool expanded) async {
    setState(() => _terminalControlsExpanded = expanded);
    await _settingsStore.saveTerminalControlsExpanded(expanded);
  }

  Future<void> _showSelfHostedProfileDialog() async {
    final controller = TextEditingController(
      text: _activeProfileId == 'hosted' ? '' : _normalizedBaseUrl,
    );
    final value = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Connect self-hosted ACT'),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: TextInputType.url,
          decoration: const InputDecoration(
            labelText: 'ACT backend URL',
            hintText: 'http://192.0.2.10 or https://act.example.com',
          ),
          onSubmitted: (value) => Navigator.pop(dialogContext, value),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.pop(dialogContext, controller.text),
            icon: const Icon(Icons.dns_outlined),
            label: const Text('Connect'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (value == null || value.trim().isEmpty) {
      return;
    }
    await _connectSelfHostedProfile(value);
  }

  Future<void> _showProfileSwitcher() async {
    final profiles = await _settingsStore.loadProfiles(
      fallbackProfile: _hostedProfile(),
    );
    if (!mounted) {
      return;
    }
    final selected = await showDialog<ConnectionProfile>(
      context: context,
      builder: (dialogContext) => SimpleDialog(
        title: const Text('ACT profile'),
        children: [
          for (final profile in profiles)
            ListTile(
              leading: Icon(
                profile.builtIn ? Icons.cloud_outlined : Icons.dns_outlined,
              ),
              title: Text(profile.label),
              subtitle: Text(
                profile.apiBaseUrl,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: profile.id == _activeProfileId
                  ? const Icon(Icons.check)
                  : null,
              onTap: () => Navigator.pop(dialogContext, profile),
            ),
          const Divider(height: 1),
          ListTile(
            leading: const Icon(Icons.dns_outlined),
            title: const Text('Connect self-hosted ACT'),
            onTap: () {
              Navigator.pop(dialogContext);
              unawaited(_showSelfHostedProfileDialog());
            },
          ),
        ],
      ),
    );
    if (selected == null || selected.id == _activeProfileId) {
      return;
    }
    await _settingsStore.switchProfile(selected);
    await _applyConnectionProfile(selected);
    unawaited(_refreshAll());
  }

  Future<void> _connectSelfHostedProfile(String rawUrl) async {
    final normalizedUrl = _normalizeProfileUrl(rawUrl);
    if (normalizedUrl == null) {
      setState(() => _statusMessage = 'Enter a valid ACT backend URL');
      return;
    }

    setState(() {
      _isSaving = true;
      _statusMessage = 'Reading ACT deployment config...';
    });

    try {
      final discovery = await ActApi(
        client: _client,
        baseUrl: normalizedUrl,
        token: '',
      ).deploymentConfig();
      final actUrl =
          _normalizeProfileUrl(
            discovery.actPublicUrl.isEmpty
                ? normalizedUrl
                : discovery.actPublicUrl,
          ) ??
          normalizedUrl;
      final authOsUrl = _normalizeProfileUrl(discovery.authOsBaseUrl);
      if (authOsUrl == null ||
          discovery.authOsOrgSlug.isEmpty ||
          discovery.authOsServiceSlug.isEmpty ||
          discovery.authOsClientId.isEmpty) {
        throw const ActApiException(
          'ACT deployment config is missing AuthOS service details',
        );
      }
      final scopes = discovery.requiredGitHubScopes.isEmpty
          ? _ActHomePageState._defaultRequiredGitHubScopes
          : discovery.requiredGitHubScopes;
      final profile = ConnectionProfile(
        id: _profileIdForUrl(actUrl),
        label: _profileLabelForUrl(actUrl),
        apiBaseUrl: actUrl,
        authOsBaseUrl: authOsUrl,
        authOsOrgSlug: discovery.authOsOrgSlug,
        authOsServiceSlug: discovery.authOsServiceSlug,
        authOsClientId: discovery.authOsClientId,
        requiredGitHubScopes: scopes,
      );
      await _settingsStore.switchProfile(profile);
      await _applyConnectionProfile(profile);
      unawaited(_refreshAll());
    } catch (error) {
      if (mounted) {
        setState(() => _statusMessage = 'Self-hosted setup failed: $error');
      }
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  Future<void> _applyConnectionProfile(ConnectionProfile profile) async {
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
      _activeProfileId = profile.id;
      _activeProfileLabel = profile.label;
      _apiBaseUrl = profile.apiBaseUrl;
      _authOsBaseUrl = profile.authOsBaseUrl;
      _authOsOrgSlug = profile.authOsOrgSlug;
      _authOsServiceSlug = profile.authOsServiceSlug;
      _authOsClientId = profile.authOsClientId;
      _requiredGitHubScopes = profile.requiredGitHubScopes.isEmpty
          ? _ActHomePageState._defaultRequiredGitHubScopes
          : profile.requiredGitHubScopes;
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
      _mobileIndex = 0;
      _statusMessage = '${profile.label} selected';
    });
  }

  String? _normalizeProfileUrl(String rawUrl) {
    final trimmed = rawUrl.trim();
    if (trimmed.isEmpty) {
      return null;
    }
    final candidate = trimmed.contains('://')
        ? trimmed
        : '${_defaultSchemeForProfileInput(trimmed)}://$trimmed';
    final uri = Uri.tryParse(candidate);
    if (uri == null ||
        uri.host.isEmpty ||
        (uri.scheme != 'https' && uri.scheme != 'http')) {
      return null;
    }
    final normalized = uri.replace(query: null, fragment: null).toString();
    return normalized.endsWith('/')
        ? normalized.substring(0, normalized.length - 1)
        : normalized;
  }

  String _defaultSchemeForProfileInput(String input) {
    final host = input.split('/').first.split(':').first.toLowerCase();
    final isLocalOrIp =
        host == 'localhost' ||
        host.endsWith('.local') ||
        RegExp(r'^\d{1,3}(\.\d{1,3}){3}$').hasMatch(host);
    return isLocalOrIp ? 'http' : 'https';
  }

  String _profileIdForUrl(String url) {
    final uri = Uri.parse(url);
    final port = uri.hasPort ? ':${uri.port}' : '';
    return 'self-hosted:${uri.scheme}://${uri.host}$port${uri.path}';
  }

  String _profileLabelForUrl(String url) {
    final uri = Uri.parse(url);
    final host = uri.hasPort ? '${uri.host}:${uri.port}' : uri.host;
    return 'Self-hosted ACT ($host)';
  }
}
