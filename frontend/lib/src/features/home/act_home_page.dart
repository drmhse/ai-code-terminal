// ignore_for_file: invalid_use_of_protected_member
import 'dart:async';
import 'dart:math' as math;

import 'package:act_frontend/src/app/agent_settings_controller.dart';
import 'package:act_frontend/src/app/agent_settings_page.dart';
import 'package:act_frontend/src/app/app_colors.dart';
import 'package:act_frontend/src/app/server_process_control_page.dart';
import 'package:act_frontend/src/app/theme_selection_page.dart';
import 'package:act_frontend/src/app/workspace_changes_page.dart';
import 'package:act_frontend/src/core/platform_defaults.dart';
import 'package:act_frontend/src/features/home/widgets/codex_session_panel.dart';
import 'package:act_frontend/src/features/home/widgets/app_top_bar.dart';
import 'package:act_frontend/src/features/home/widgets/connection_panel.dart';
import 'package:act_frontend/src/features/home/widgets/create_workspace_dialog.dart';
import 'package:act_frontend/src/features/home/widgets/editor_preview.dart';
import 'package:act_frontend/src/features/home/widgets/github_clone_dialog.dart';
import 'package:act_frontend/src/features/home/widgets/mobile_action_dock.dart';
import 'package:act_frontend/src/features/home/widgets/sidebar_panel.dart';
import 'package:act_frontend/src/features/home/widgets/status_bar.dart';
import 'package:act_frontend/src/features/home/widgets/task_panel.dart';
import 'package:act_frontend/src/features/home/widgets/terminal_workspace.dart';
import 'package:act_frontend/src/models/file_content.dart';
import 'package:act_frontend/src/models/file_item.dart';
import 'package:act_frontend/src/models/health_status.dart';
import 'package:act_frontend/src/models/codex_session.dart';
import 'package:act_frontend/src/models/coding_agent.dart';
import 'package:act_frontend/src/models/native_task.dart';
import 'package:act_frontend/src/models/system_stats.dart';
import 'package:act_frontend/src/models/terminal_session.dart';
import 'package:act_frontend/src/models/user_profile.dart';
import 'package:act_frontend/src/models/workspace.dart';
import 'package:act_frontend/src/models/workspace_collection.dart';
import 'package:act_frontend/src/services/act_api.dart';
import 'package:act_frontend/src/services/act_api_exception.dart';
import 'package:act_frontend/src/services/auth_callback_location.dart';
import 'package:act_frontend/src/services/auth_os_client.dart';
import 'package:act_frontend/src/services/auth_os_config.dart';
import 'package:act_frontend/src/services/connection_settings_store.dart';
import 'package:act_frontend/src/services/file_content_cache.dart';
import 'package:act_frontend/src/services/mock_act_client.dart';
import 'package:act_frontend/src/services/mock_terminal_socket_client.dart';
import 'package:act_frontend/src/services/terminal_socket_client.dart';
import 'package:app_links/app_links.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

part 'act_home_linked_accounts.dart';
part 'act_home_auth_actions.dart';
part 'auth_actions/settings_profiles.dart';
part 'auth_actions/auth_socket.dart';
part 'act_home_workspace_actions.dart';
part 'workspace_actions/workspace_refresh.dart';
part 'workspace_actions/file_index.dart';
part 'act_home_workspace_builder.dart';
part 'act_home_codex_actions.dart';
part 'codex_actions/codex_helpers.dart';
part 'codex_actions/codex_sessions.dart';
part 'codex_actions/codex_changes_preview.dart';
part 'codex_actions/codex_diff_viewer.dart';
part 'codex_actions/codex_extension_ui.dart';
part 'act_home_task_file_actions.dart';
part 'task_actions/task_scope_actions.dart';
part 'task_actions/create_task_launcher.dart';
part 'task_actions/file_actions.dart';
part 'task_actions/create_task_models.dart';
part 'task_actions/create_task_dialog.dart';
part 'task_actions/workspace_picker.dart';
part 'task_actions/task_form_widgets.dart';
part 'act_home_workspace_session_actions.dart';
part 'workspace_session_actions/workspace_collection_actions.dart';
part 'workspace_session_actions/workspace_session_actions.dart';
part 'workspace_session_actions/collection_manager_view.dart';
part 'workspace_session_actions/collection_manager_actions.dart';
part 'workspace_session_actions/collection_member_tile.dart';
part 'act_home_mobile_top_bar.dart';

class ActHomePage extends StatefulWidget {
  const ActHomePage({super.key});

  @override
  State<ActHomePage> createState() => _ActHomePageState();
}

enum _GitHubAccessAction { dismiss, reconnect }

class _LoadResult<T> {
  const _LoadResult.success(this.value) : error = null;
  const _LoadResult.failure(this.error) : value = null;

  final T? value;
  final Object? error;
}

class _WorkspaceFileBrowserSnapshot {
  const _WorkspaceFileBrowserSnapshot({
    required this.files,
    required this.fileIndex,
    required this.indexedDirectoryPaths,
    required this.searchQuery,
    required this.directoryChildren,
    required this.expandedDirectories,
    required this.directoryLoadErrors,
    required this.selectedFile,
    required this.selectedFileContent,
    required this.selectedFileHasLocalDraft,
  });

  final List<FileItem> files;
  final Map<String, FileItem> fileIndex;
  final Set<String> indexedDirectoryPaths;
  final String searchQuery;
  final Map<String, List<FileItem>> directoryChildren;
  final Set<String> expandedDirectories;
  final Map<String, String> directoryLoadErrors;
  final FileItem? selectedFile;
  final FileContent? selectedFileContent;
  final bool selectedFileHasLocalDraft;
}

class _OpenEditorTab {
  _OpenEditorTab({
    required this.key,
    required this.workspaceId,
    required this.relativePath,
    required this.file,
  });

  final String key;
  final String workspaceId;
  final String relativePath;
  final FileItem file;
  FileContent? content;
  String? draftText;
  bool hasUnsavedDraft = false;
  bool isLoading = false;
  bool isSaving = false;
  int loadGeneration = 0;

  FileContent? get visibleContent {
    final draft = draftText;
    final current = content;
    if (draft == null || current == null) {
      return current;
    }
    return FileContent(
      path: current.path,
      content: draft,
      encoding: current.encoding,
      size: draft.length,
      isBinary: current.isBinary,
    );
  }
}

Future<_LoadResult<T>> _captureLoad<T>(Future<T> future) async {
  try {
    return _LoadResult.success(await future);
  } catch (error) {
    return _LoadResult.failure(error);
  }
}

class _ActHomePageState extends State<ActHomePage> {
  static const _defaultRequiredGitHubScopes = [
    'repo',
    'read:user',
    'user:email',
    'read:org',
  ];
  static const _backgroundIndexSkippedDirs = {
    '.git',
    '.dart_tool',
    '.next',
    'build',
    'dist',
    'node_modules',
    'target',
  };
  static const _releaseMobileStateVersion = 'release-mobile-authos-login-v3';

  final _workspaceNameController = TextEditingController();
  final _workspacePathController = TextEditingController();
  final http.Client _client = actMockMode ? MockActClient() : http.Client();
  final _settingsStore = ConnectionSettingsStore();
  final _fileCache = FileContentCache();
  final _appLinks = AppLinks();

  AgentSettingsController? _agentSettingsController;
  StreamSubscription<Uri>? _linkSubscription;
  bool _isLoading = true;
  bool _isSaving = false;
  bool _isRefreshingWorkspaces = false;
  String? _workspaceRefreshError;
  int _mobileIndex = 0;
  bool _terminalControlsExpanded = true;
  String _apiBaseUrl = '';
  String _authOsBaseUrl = '';
  String _authOsOrgSlug = authOsOrgSlug;
  String _authOsServiceSlug = authOsServiceSlug;
  String _authOsClientId = authOsClientId;
  List<String> _requiredGitHubScopes = const [
    ..._ActHomePageState._defaultRequiredGitHubScopes,
  ];
  String _activeProfileId = 'hosted';
  String _activeProfileLabel = 'Hosted ACT';
  String _authToken = '';
  String _refreshToken = '';
  String? _statusMessage;
  String? _socketKey;
  TerminalSocketClient? _socketClient;
  StreamSubscription<TaskExecutionStarted>? _executionStartedSub;
  StreamSubscription<TaskExecutionStatusUpdate>? _executionStatusSub;
  StreamSubscription<TerminalOutput>? _socketOutputSub;
  StreamSubscription<TerminalError>? _socketErrorSub;
  Timer? _codexRefreshTimer;
  Timer? _taskRefreshTimer;
  HealthStatus? _health;
  SystemStats? _systemStats;
  UserProfile? _user;
  AuthOsLinkedAccounts? _linkedAccounts;
  RunnerReadiness? _runnerReadiness;
  List<NativeTask> _tasks = const [];
  NativeTask? _selectedTask;
  String? _tasksWorkspaceId;
  bool _isLoadingTasks = false;
  String? _executionStatus;
  List<Workspace> _workspaces = const [];
  List<WorkspaceCollection> _collections = const [];
  List<TerminalSession> _sessions = const [];
  List<CodexSessionSummary> _codexSessions = const [];
  List<CodexSessionEvent> _codexEvents = const [];
  final Map<String, List<CodexSessionEvent>> _codexLocalEventsBySession = {};
  List<FileItem> _files = const [];
  Map<String, FileItem> _fileIndex = const {};
  int _fileIndexVersion = 0;
  String _cachedFileSearchQuery = '';
  int _cachedFileSearchIndexVersion = -1;
  List<FileItem> _cachedFileSearchResults = const [];
  Set<String> _indexedDirectoryPaths = const <String>{};
  Set<String> _indexingDirectoryPaths = const <String>{};
  String _fileSearchQuery = '';
  bool _isIndexingFiles = false;
  Map<String, List<FileItem>> _directoryChildren = const {};
  Set<String> _expandedDirectories = const <String>{};
  Set<String> _loadingDirectoryPaths = const <String>{};
  Map<String, String> _directoryLoadErrors = const {};
  final _fileBrowserSnapshots = <String, _WorkspaceFileBrowserSnapshot>{};
  Workspace? _selectedWorkspace;
  WorkspaceCollection? _selectedCollection;
  FileItem? _selectedFile;
  FileContent? _selectedFileContent;
  bool _showMobileEditor = false;
  bool _selectedFileHasLocalDraft = false;
  bool _isLoadingFileContent = false;
  bool _isSavingFileContent = false;
  final Map<String, Timer> _fileDraftSaveTimers = {};
  final List<_OpenEditorTab> _openEditorTabs = [];
  String? _activeEditorTabKey;
  String _activeWorkbenchTabKey = 'terminal';
  Map<String, String> _sessionBuffers = const {};
  String? _selectedCodexSessionId;
  final Set<String> _piReloadNextPromptSessionIds = <String>{};
  String? _codexWorkspaceFilterId;
  String? _codexCollectionFilterId;
  String? _taskScopeType;
  String? _taskScopeId;
  String _selectedAgentProvider = 'codex';
  String _selectedProviderModel = '';
  String _selectedProviderThinkingLevel = '';
  String? _codexError;
  String? _activeTerminalSessionId;
  bool _isComposingNewCodexChat = false;
  bool _terminalFocusMode = false;
  bool _isLoadingCodex = false;
  bool _isLaunchingCodex = false;
  bool _isPreparingGitHubClone = false;
  bool _isCreatingTerminal = false;
  int _workspaceDetailsGeneration = 0;
  int _sessionMutationVersion = 0;
  int _fileIndexGeneration = 0;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final controller = AgentSettingsScope.of(context);
    if (_agentSettingsController == controller) {
      return;
    }
    _agentSettingsController?.removeListener(_syncAgentSettings);
    _agentSettingsController = controller..addListener(_syncAgentSettings);
    _syncAgentSettings();
  }

  @override
  void dispose() {
    _agentSettingsController?.removeListener(_syncAgentSettings);
    _linkSubscription?.cancel();
    _workspaceNameController.dispose();
    _workspacePathController.dispose();
    for (final timer in _fileDraftSaveTimers.values) {
      timer.cancel();
    }
    _codexRefreshTimer?.cancel();
    _taskRefreshTimer?.cancel();
    _executionStartedSub?.cancel();
    _executionStatusSub?.cancel();
    _socketOutputSub?.cancel();
    _socketErrorSub?.cancel();
    _socketClient?.dispose();
    _client.close();
    super.dispose();
  }

  void _syncAgentSettings() {
    final controller = _agentSettingsController;
    if (controller == null || !mounted) {
      return;
    }
    setState(() {
      _selectedAgentProvider = controller.defaultAgentProvider;
      _selectedProviderModel = controller.defaultProviderModel;
      _selectedProviderThinkingLevel = controller.defaultProviderThinkingLevel;
    });
  }

  bool get _hasToken => _authToken.trim().isNotEmpty;
  bool get _canOperateHost => _user?.isOperator ?? false;

  String get _normalizedBaseUrl {
    final raw = _apiBaseUrl.trim();
    return raw.endsWith('/') ? raw.substring(0, raw.length - 1) : raw;
  }

  String get _normalizedAuthOsBaseUrl {
    final raw = _authOsBaseUrl.trim();
    return raw.endsWith('/') ? raw.substring(0, raw.length - 1) : raw;
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (!_hasToken) {
      return ConnectionPanel(
        isSaving: _isSaving,
        activeProfileLabel: _activeProfileLabel,
        statusMessage: _statusMessage,
        onProviderSignIn: _startAuth,
        onSwitchProfile: _showProfileSwitcher,
        onRefresh: () => _refreshAll(),
      );
    }

    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isMobile = constraints.maxWidth < 760;
            final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;
            final terminalMode = isMobile && _mobileIndex == 1;
            final selectedWorkspacePaneCount = _selectedWorkspace == null
                ? 0
                : _sessions
                      .where(
                        (session) =>
                            session.workspaceId == _selectedWorkspace!.id,
                      )
                      .length;
            final terminalPaneCount = terminalMode
                ? _sessions.length
                : selectedWorkspacePaneCount;
            final focusedTerminalSession = _focusedTerminalSession;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  width: double.infinity,
                  child: AppTopBar(
                    workspace: _selectedWorkspace,
                    user: _user,
                    onRefresh: _refreshAll,
                    onLogout: _logout,
                    onChooseTheme: _showThemeSelection,
                    onChooseAgentSettings: _showAgentSettings,
                    onOpenServerProcesses: _showServerProcesses,
                    onOpenWorkspaceChanges: _showWorkspaceChanges,
                    defaultAgentProvider: _selectedAgentProvider,
                    onManageAccounts: _showLinkedAccountsDialog,
                    activeProfileLabel: _activeProfileLabel,
                    onSwitchProfile: _showProfileSwitcher,
                    isTerminalMode: terminalMode,
                    terminalPaneCount: terminalPaneCount,
                    focusedTerminalTitle: focusedTerminalSession?.sessionName,
                    focusedTerminalWorkspaceName: _workspaceNameForSession(
                      focusedTerminalSession,
                    ),
                    terminalFocusMode: _terminalFocusMode,
                    terminalControlsExpanded: _terminalControlsExpanded,
                    isCreatingTerminal: _isCreatingTerminal,
                    onToggleTerminalFocusMode: () => setState(
                      () => _terminalFocusMode = !_terminalFocusMode,
                    ),
                    onToggleTerminalControls: () =>
                        _setTerminalControlsExpanded(
                          !_terminalControlsExpanded,
                        ),
                    onCreateTerminal:
                        _selectedWorkspace == null || !_canOperateHost
                        ? null
                        : _createSession,
                    onSaveTerminalLayout: selectedWorkspacePaneCount == 0
                        ? null
                        : _saveCurrentTerminalLayout,
                    searchQuery: _fileSearchQuery,
                    onSearchChanged: _selectedWorkspace == null
                        ? null
                        : _handleFileSearchChanged,
                    mobileTitle: isMobile && !terminalMode
                        ? _mobileTopBarTitle
                        : null,
                    mobileIcon: isMobile && !terminalMode
                        ? _mobileTopBarIcon
                        : null,
                    mobileActions: isMobile && !terminalMode
                        ? _mobileTopBarActions
                        : const [],
                  ),
                ),
                Expanded(child: _buildWorkspace(constraints.maxWidth)),
                if (!isMobile)
                  StatusBar(
                    health: _health,
                    stats: _systemStats,
                    workspace: _selectedWorkspace,
                    isAuthenticated: _hasToken,
                  ),
                if (isMobile && !keyboardOpen)
                  MobileActionDock(
                    selectedIndex: _mobileIndex,
                    defaultAgentProvider: _selectedAgentProvider,
                    onSelected: (index) => setState(() => _mobileIndex = index),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }

  void _showThemeSelection() {
    Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => const ThemeSelectionPage()));
  }

  void _showAgentSettings() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => AgentSettingsPage(api: _api)),
    );
  }

  void _showServerProcesses() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ServerProcessControlPage(
          api: _api,
          piReloadSessionIds: _piReloadNextPromptSessionIds,
          onOpenAgentSession: (sessionId) {
            unawaited(_selectCodexSession(sessionId));
            if (mounted) {
              setState(() => _mobileIndex = 3);
            }
          },
          onReloadPiNextPrompt: (sessionId) {
            setState(() {
              _piReloadNextPromptSessionIds.add(sessionId);
              _statusMessage = 'Pi will reload tools on the next prompt';
            });
          },
        ),
      ),
    );
  }

  void _showWorkspaceChanges() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => WorkspaceChangesPage(api: _api)),
    );
  }

  String _relativePath(String path, String root) {
    if (path.startsWith(root)) {
      final relative = path
          .substring(root.length)
          .replaceFirst(RegExp(r'^/+'), '');
      return relative.isEmpty ? '.' : relative;
    }
    return path;
  }
}
