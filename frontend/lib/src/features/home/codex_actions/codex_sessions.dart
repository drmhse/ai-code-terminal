part of '../act_home_page.dart';
// ignore_for_file: invalid_use_of_protected_member

extension _ActHomeCodexActions on _ActHomePageState {
  Future<void> _refreshCodexSessions({bool silent = false}) async {
    if (!_hasToken) {
      return;
    }
    final token = _authToken;
    if (!silent) {
      setState(() {
        _isLoadingCodex = true;
        _codexError = null;
      });
    }

    try {
      final sessions = await _api.codexSessions(
        workspaceId: _codexWorkspaceFilterId,
        scopeType: _codexCollectionFilterId == null ? null : 'collection',
        scopeId: _codexCollectionFilterId,
      );
      final selectedId = _selectedCodexSessionAfterRefresh(sessions);
      final events = selectedId == null
          ? const <CodexSessionEvent>[]
          : await _api.codexSessionEvents(selectedId);
      if (!mounted || _authToken != token) {
        return;
      }
      if (selectedId != null) {
        _clearTransientCodexThreadErrors(selectedId);
      }
      setState(() {
        _codexSessions = sessions;
        _selectedCodexSessionId = selectedId;
        _codexEvents = selectedId == null
            ? events
            : _eventsWithLocal(selectedId, events);
        if (!silent || _isTransientCodexError(_codexError)) {
          _codexError = null;
        }
        _isLoadingCodex = false;
      });
      _ensureCodexRefreshTimer();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        final message = _agentErrorMessage(error);
        _codexError = 'Agent stream unavailable: $message';
        _isLoadingCodex = false;
      });
    }
  }

  Future<void> _selectCodexSession(String sessionId) async {
    setState(() {
      _selectedCodexSessionId = sessionId;
      _isComposingNewCodexChat = false;
      _codexEvents = const [];
      _isLoadingCodex = true;
      _codexError = null;
    });
    await _refreshCodexEvents(sessionId: sessionId);
  }

  Future<void> _refreshCodexEvents({
    String? sessionId,
    bool silent = false,
  }) async {
    final selectedId = sessionId ?? _selectedCodexSessionId;
    if (!_hasToken || selectedId == null) {
      return;
    }
    final token = _authToken;
    if (!silent) {
      setState(() {
        _isLoadingCodex = true;
        _codexError = null;
      });
    }
    try {
      final events = await _api.codexSessionEvents(selectedId);
      if (!mounted ||
          _authToken != token ||
          _selectedCodexSessionId != selectedId) {
        return;
      }
      _clearTransientCodexThreadErrors(selectedId);
      setState(() {
        _codexEvents = _eventsWithLocal(selectedId, events);
        if (!silent || _isTransientCodexError(_codexError)) {
          _codexError = null;
        }
        _isLoadingCodex = false;
      });
      if (_codexEventsFinished(events)) {
        unawaited(_refreshCodexSessions(silent: true));
      }
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        final message = _agentErrorMessage(error);
        _codexError = 'Agent stream unavailable: $message';
        _isLoadingCodex = false;
      });
    }
  }

  bool _codexEventsFinished(List<CodexSessionEvent> events) {
    for (final event in events.reversed) {
      final terminalStatusEvent = event.kind == 'status';
      final assistantCompletedEvent =
          event.kind == 'message' &&
          event.role == 'assistant' &&
          event.status?.toLowerCase().contains('completed') == true;
      if (!terminalStatusEvent && !assistantCompletedEvent) {
        continue;
      }
      final status = event.status?.toLowerCase();
      if (status == null) {
        continue;
      }
      if (status.contains('running') ||
          status.contains('starting') ||
          status.contains('queued') ||
          status.contains('interrupting')) {
        return false;
      }
      if (status.contains('completed') ||
          status.contains('failed') ||
          status.contains('interrupted')) {
        return true;
      }
    }
    return false;
  }

  String? _selectedCodexSessionAfterRefresh(
    List<CodexSessionSummary> sessions,
  ) {
    if (_isComposingNewCodexChat) {
      return null;
    }
    final currentId = _selectedCodexSessionId;
    if (currentId == null) {
      return sessions.isEmpty ? null : sessions.first.id;
    }
    if (_codexSessionMatchesSelectedId(sessions, currentId)) {
      return currentId;
    }
    return currentId;
  }

  bool _codexSessionMatchesSelectedId(
    List<CodexSessionSummary> sessions,
    String selectedId,
  ) {
    return sessions.any(
      (session) =>
          session.id == selectedId ||
          session.runtimeSessionId == selectedId ||
          session.providerSessionId == selectedId,
    );
  }

  List<CodexSessionEvent> _eventsWithLocal(
    String sessionId,
    List<CodexSessionEvent> events,
  ) {
    final local = _codexLocalEventsBySession[sessionId];
    if (local == null || local.isEmpty) {
      return events;
    }
    return [...events, ...local];
  }

  String _agentErrorMessage(Object error) {
    if (error is ActApiException) {
      return error.message;
    }
    return error.toString();
  }

  void _recordCodexThreadError(String title, Object error) {
    final sessionId = _selectedCodexSessionId;
    if (sessionId == null) {
      return;
    }
    final message = _agentErrorMessage(error);
    final event = CodexSessionEvent(
      index: 100000 + (_codexLocalEventsBySession[sessionId]?.length ?? 0),
      kind: 'error',
      title: title,
      text: message,
      status: 'failed',
      timestamp: DateTime.now(),
    );
    final events = [...?_codexLocalEventsBySession[sessionId], event];
    _codexLocalEventsBySession[sessionId] = events;
    _codexEvents = [..._codexEvents, event];
  }

  bool _isTransientCodexError(String? message) {
    return message?.startsWith('Agent stream unavailable:') == true;
  }

  void _clearTransientCodexThreadErrors(String sessionId) {
    final local = _codexLocalEventsBySession[sessionId];
    if (local == null || local.isEmpty) {
      return;
    }
    final persistent = local
        .where((event) => event.title != 'Agent stream unavailable')
        .toList(growable: false);
    if (persistent.length == local.length) {
      return;
    }
    if (persistent.isEmpty) {
      _codexLocalEventsBySession.remove(sessionId);
    } else {
      _codexLocalEventsBySession[sessionId] = persistent;
    }
  }

  Future<void> _startNewCodexChat() async {
    if (_workspaces.isEmpty && _collections.isEmpty) {
      setState(
        () =>
            _statusMessage = 'Create or clone a project before starting Agent',
      );
      return;
    }
    final choice = await showModalBottomSheet<_CodexChatScopeChoice>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      backgroundColor: AppColors.panel(context),
      builder: (context) {
        return _CodexChatScopeSheet(
          workspaces: _workspaces,
          collections: _collections,
          selectedWorkspace: _selectedWorkspace,
          selectedCollection: _selectedCollection,
        );
      },
    );
    if (!mounted || choice == null) {
      return;
    }
    switch (choice.action) {
      case _CodexChatScopeAction.createWorkspace:
        await _showCreateWorkspaceDialog();
        return;
      case _CodexChatScopeAction.manageCollections:
        await _showCollectionManager();
        return;
      case _CodexChatScopeAction.workspace:
        final workspace = choice.workspace;
        if (workspace == null) {
          return;
        }
        await _selectWorkspace(workspace, selectContainingCollection: false);
      case _CodexChatScopeAction.collection:
        final collection = choice.collection;
        if (collection == null) {
          return;
        }
        await _selectCollection(collection);
    }
    if (!mounted) {
      return;
    }
    setState(() {
      _selectedCodexSessionId = null;
      _codexEvents = const [];
      _codexError = null;
      _isComposingNewCodexChat = true;
      _mobileIndex = 3;
    });
  }

  void _setCodexWorkspaceFilter(String? workspaceId) {
    final normalized = workspaceId?.trim();
    setState(() {
      _codexWorkspaceFilterId = normalized == null || normalized.isEmpty
          ? null
          : normalized;
      _codexCollectionFilterId = null;
      _selectedCodexSessionId = null;
      _codexEvents = const [];
      _isComposingNewCodexChat = false;
    });
    unawaited(_refreshCodexSessions());
  }

  void _setCodexCollectionFilter(String? collectionId) {
    final normalized = collectionId?.trim();
    setState(() {
      _codexCollectionFilterId = normalized == null || normalized.isEmpty
          ? null
          : normalized;
      _codexWorkspaceFilterId = null;
      _selectedCodexSessionId = null;
      _codexEvents = const [];
      _isComposingNewCodexChat = false;
    });
    unawaited(_refreshCodexSessions());
  }

  void _ensureCodexRefreshTimer() {
    _codexRefreshTimer ??= Timer.periodic(const Duration(seconds: 2), (_) {
      if (!_hasToken || _selectedCodexSessionId == null) {
        return;
      }
      unawaited(_refreshCodexEvents(silent: true));
    });
  }

  void _handleActiveTerminalChanged(TerminalSession? session) {
    if (!mounted || _activeTerminalSessionId == session?.id) {
      return;
    }
    setState(() => _activeTerminalSessionId = session?.id);
  }

  TerminalSession? get _focusedTerminalSession {
    final activeId = _activeTerminalSessionId;
    if (activeId != null) {
      final active = _sessions.cast<TerminalSession?>().firstWhere(
        (session) => session?.id == activeId,
        orElse: () => null,
      );
      if (active != null) {
        return active;
      }
    }
    final workspace = _selectedWorkspace;
    if (workspace == null) {
      return _sessions.isEmpty ? null : _sessions.first;
    }
    return _sessions.cast<TerminalSession?>().firstWhere(
      (session) => session?.workspaceId == workspace.id,
      orElse: () => _sessions.isEmpty ? null : _sessions.first,
    );
  }

  String? _workspaceNameForSession(TerminalSession? session) {
    final workspaceId = session?.workspaceId;
    if (workspaceId == null || workspaceId.isEmpty) {
      return _selectedWorkspace?.name;
    }
    return _workspaces
            .cast<Workspace?>()
            .firstWhere(
              (workspace) => workspace?.id == workspaceId,
              orElse: () => null,
            )
            ?.name ??
        _selectedWorkspace?.name;
  }

  Future<void> _launchCodexSession(String? prompt) async {
    if (!_canOperateHost) {
      setState(() => _statusMessage = 'Operator access required');
      return;
    }
    final workspace = _selectedWorkspace;
    final collection = _selectedCollection;
    if (!_hasToken || (workspace == null && collection == null)) {
      setState(
        () => _statusMessage =
            'Select a workspace or collection before starting Codex',
      );
      return;
    }
    setState(() {
      _isLaunchingCodex = true;
      _codexError = null;
      _statusMessage = 'Starting Codex...';
    });
    try {
      final launch = await _api.launchCodexSession(
        workspaceId: collection == null ? workspace?.id : null,
        scopeType: collection == null ? 'workspace' : 'collection',
        scopeId: collection?.id ?? workspace?.id,
        prompt: prompt,
        agentProvider: _selectedAgentProvider,
        providerModel: _selectedProviderModel,
        providerThinkingLevel: _selectedProviderThinkingLevel,
      );
      if (!mounted) {
        return;
      }
      if (collection == null && _selectedWorkspace?.id != workspace?.id) {
        setState(() => _isLaunchingCodex = false);
        return;
      }
      if (collection != null && _selectedCollection?.id != collection.id) {
        setState(() => _isLaunchingCodex = false);
        return;
      }
      setState(() {
        final terminalSession = launch.terminalSession;
        if (terminalSession != null) {
          _sessionMutationVersion += 1;
          _sessions = [
            terminalSession,
            ..._sessions.where((session) => session.id != terminalSession.id),
          ];
        }
        _codexSessions = [
          launch.codexSession,
          ..._codexSessions.where(
            (session) => session.id != launch.codexSession.id,
          ),
        ];
        _selectedCodexSessionId = launch.codexSession.id;
        _isComposingNewCodexChat = false;
        _codexEvents = [
          CodexSessionEvent(
            index: 0,
            kind: 'message',
            role: 'user',
            text: prompt?.trim().isEmpty == false
                ? prompt!.trim()
                : 'Summarize this workspace and wait for follow-up instructions.',
            status: 'submitted',
            timestamp: DateTime.now(),
          ),
        ];
        _terminalControlsExpanded = false;
        _mobileIndex = 3;
        _isLaunchingCodex = false;
        _statusMessage =
            'Started ${CodingAgents.byId(launch.codexSession.agentProvider).label}';
      });
      _ensureCodexRefreshTimer();
      await Future<void>.delayed(const Duration(milliseconds: 800));
      if (mounted) {
        await _refreshCodexSessions(silent: true);
      }
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _isLaunchingCodex = false;
        _codexError = 'Agent launch failed: $error';
        _statusMessage = 'Agent launch failed';
      });
    }
  }

  Future<void> _sendCodexMessage(String text, {String mode = 'queue'}) async {
    if (!_canOperateHost) {
      setState(() => _statusMessage = 'Operator access required');
      return;
    }
    final sessionId = _selectedCodexSessionId;
    final workspace = _selectedWorkspace;
    final collection = _selectedCollection;
    final prompt = text.trim();
    if (!_hasToken ||
        sessionId == null ||
        workspace == null ||
        prompt.isEmpty) {
      return;
    }
    final reloadPi =
        mode == 'queue' && _piReloadNextPromptSessionIds.contains(sessionId);
    final sendMode = reloadPi ? 'restart_and_send' : mode;
    setState(() {
      _codexError = null;
      _statusMessage = sendMode == 'restart_and_send'
          ? 'Relaunching Pi with follow-up...'
          : sendMode == 'interrupt_and_send'
          ? 'Interrupting Agent with follow-up...'
          : 'Sending prompt to Agent...';
    });
    try {
      final summary = await _api.sendCodexMessage(
        sessionId: sessionId,
        workspaceId: workspace.id,
        scopeType: collection == null ? 'workspace' : 'collection',
        scopeId: collection?.id ?? workspace.id,
        prompt: prompt,
        mode: sendMode,
      );
      if (!mounted) {
        return;
      }
      final queuedForLater = summary.queuedMessageCount > 0;
      setState(() {
        _codexSessions = [
          summary,
          ..._codexSessions.where((session) => session.id != summary.id),
        ];
        _selectedCodexSessionId = summary.id;
        if (sendMode == 'restart_and_send') {
          _piReloadNextPromptSessionIds.remove(summary.id);
        }
        if (!queuedForLater) {
          _codexEvents = [
            ..._codexEvents,
            CodexSessionEvent(
              index: _codexEvents.length,
              kind: 'message',
              role: 'user',
              text: prompt,
              status: 'submitted',
              timestamp: DateTime.now(),
            ),
          ];
        }
        final agent = CodingAgents.byId(summary.agentProvider).label;
        _statusMessage = summary.queuedMessageCount > 0
            ? 'Queued for $agent'
            : sendMode == 'restart_and_send'
            ? 'Relaunched Pi and sent prompt'
            : 'Sent to $agent';
      });
      _ensureCodexRefreshTimer();
      unawaited(_refreshCodexEvents(sessionId: summary.id, silent: true));
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        final message = _agentErrorMessage(error);
        _recordCodexThreadError('Agent send failed', error);
        _codexError = 'Agent send failed: $message';
        _statusMessage = 'Agent send failed';
      });
      rethrow;
    }
  }

  Future<void> _interruptCodexSession() async {
    if (!_canOperateHost) {
      setState(() => _statusMessage = 'Operator access required');
      return;
    }
    final sessionId = _selectedCodexSessionId;
    if (!_hasToken || sessionId == null) {
      return;
    }
    try {
      final summary = await _api.interruptCodexSession(sessionId);
      if (!mounted) {
        return;
      }
      setState(() {
        _codexSessions = [
          summary,
          ..._codexSessions.where((session) => session.id != summary.id),
        ];
        _statusMessage =
            'Interrupted ${CodingAgents.byId(summary.agentProvider).label}';
      });
      unawaited(_refreshCodexEvents(sessionId: summary.id, silent: true));
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _codexError = 'Agent interrupt failed: $error';
        _statusMessage = 'Agent interrupt failed';
      });
    }
  }
}

enum _CodexChatScopeAction {
  workspace,
  collection,
  createWorkspace,
  manageCollections,
}

class _CodexChatScopeChoice {
  const _CodexChatScopeChoice._({
    required this.action,
    this.workspace,
    this.collection,
  });

  const _CodexChatScopeChoice.workspace(Workspace workspace)
    : this._(action: _CodexChatScopeAction.workspace, workspace: workspace);

  const _CodexChatScopeChoice.collection(WorkspaceCollection collection)
    : this._(action: _CodexChatScopeAction.collection, collection: collection);

  const _CodexChatScopeChoice.createWorkspace()
    : this._(action: _CodexChatScopeAction.createWorkspace);

  const _CodexChatScopeChoice.manageCollections()
    : this._(action: _CodexChatScopeAction.manageCollections);

  final _CodexChatScopeAction action;
  final Workspace? workspace;
  final WorkspaceCollection? collection;
}

class _CodexChatScopeSheet extends StatefulWidget {
  const _CodexChatScopeSheet({
    required this.workspaces,
    required this.collections,
    required this.selectedWorkspace,
    required this.selectedCollection,
  });

  final List<Workspace> workspaces;
  final List<WorkspaceCollection> collections;
  final Workspace? selectedWorkspace;
  final WorkspaceCollection? selectedCollection;

  @override
  State<_CodexChatScopeSheet> createState() => _CodexChatScopeSheetState();
}

class _CodexChatScopeSheetState extends State<_CodexChatScopeSheet> {
  static const _scopeTileExtent = 92.0;
  final _searchController = TextEditingController();
  final _projectScrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_handleSearchChanged);
  }

  @override
  void dispose() {
    _searchController.removeListener(_handleSearchChanged);
    _searchController.dispose();
    _projectScrollController.dispose();
    super.dispose();
  }

  void _handleSearchChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = _searchController.text.trim().toLowerCase();
    final filteredWorkspaces = widget.workspaces
        .where((workspace) => _workspaceMatches(workspace, query))
        .toList(growable: false);
    final filteredCollections = widget.collections
        .where((collection) => _collectionMatches(collection, query))
        .toList(growable: false);
    final projectCount = filteredWorkspaces.length;
    return FractionallySizedBox(
      heightFactor: 0.82,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 10, 8),
            child: Row(
              children: [
                Icon(
                  Icons.add_comment_outlined,
                  color: AppColors.accent(context),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'New Agent chat',
                    style: TextStyle(
                      color: AppColors.primaryText(context),
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Close',
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: AppColors.line(context)),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
            child: TextField(
              controller: _searchController,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: 'Search projects or collections',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: query.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Clear search',
                        onPressed: _searchController.clear,
                        icon: const Icon(Icons.close),
                      ),
              ),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
              children: [
                if (widget.workspaces.isNotEmpty) ...[
                  _CodexChatScopeSectionLabel(
                    projectCount == 1 ? 'PROJECT' : 'PROJECTS',
                  ),
                  _projectPicker(context, filteredWorkspaces),
                ],
                if (widget.collections.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  _CodexChatScopeSectionLabel('COLLECTIONS'),
                  if (filteredCollections.isEmpty)
                    _emptyScopeSearchResult(context, 'No matching collections')
                  else
                    for (final collection in filteredCollections)
                      _CodexChatScopeTile.collection(
                        collection: collection,
                        selected:
                            collection.id == widget.selectedCollection?.id,
                      ),
                ],
                const SizedBox(height: 14),
                OutlinedButton.icon(
                  onPressed: () => Navigator.pop(
                    context,
                    const _CodexChatScopeChoice.createWorkspace(),
                  ),
                  icon: const Icon(Icons.create_new_folder_outlined, size: 18),
                  label: const Text('Create workspace'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.secondaryText(context),
                    side: BorderSide(color: AppColors.line(context)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
                TextButton.icon(
                  onPressed: () => Navigator.pop(
                    context,
                    const _CodexChatScopeChoice.manageCollections(),
                  ),
                  icon: const Icon(Icons.account_tree_outlined, size: 18),
                  label: const Text('Manage collections'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _projectPicker(BuildContext context, List<Workspace> workspaces) {
    if (workspaces.isEmpty) {
      return _emptyScopeSearchResult(context, 'No matching projects');
    }
    final visibleRows = workspaces.length > 3 ? 3 : workspaces.length;
    final list = ListView.builder(
      controller: _projectScrollController,
      primary: false,
      itemExtent: _scopeTileExtent,
      itemCount: workspaces.length,
      itemBuilder: (context, index) {
        final workspace = workspaces[index];
        return _CodexChatScopeTile.workspace(
          workspace: workspace,
          selected:
              widget.selectedCollection == null &&
              workspace.id == widget.selectedWorkspace?.id,
        );
      },
    );
    return SizedBox(
      height: visibleRows * _scopeTileExtent,
      child: workspaces.length > 3
          ? Scrollbar(
              controller: _projectScrollController,
              thumbVisibility: true,
              child: list,
            )
          : list,
    );
  }

  Widget _emptyScopeSearchResult(BuildContext context, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.field(context),
        border: Border.all(color: AppColors.line(context)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: AppColors.mutedText(context),
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  bool _workspaceMatches(Workspace workspace, String query) {
    if (query.isEmpty) {
      return true;
    }
    return _containsQuery(workspace.name, query) ||
        _containsQuery(workspace.githubRepo, query) ||
        _containsQuery(workspace.localPath, query);
  }

  bool _collectionMatches(WorkspaceCollection collection, String query) {
    if (query.isEmpty) {
      return true;
    }
    return _containsQuery(collection.name, query) ||
        collection.members.any((member) {
          final workspace = member.workspace;
          return _containsQuery(workspace.name, query) ||
              _containsQuery(workspace.githubRepo, query) ||
              _containsQuery(workspace.localPath, query);
        });
  }

  bool _containsQuery(String value, String query) {
    return value.toLowerCase().contains(query);
  }
}

class _CodexChatScopeSectionLabel extends StatelessWidget {
  const _CodexChatScopeSectionLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 2, 4, 5),
      child: Text(
        label,
        style: TextStyle(
          color: AppColors.mutedText(context),
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _CodexChatScopeTile extends StatelessWidget {
  const _CodexChatScopeTile.workspace({
    required this.workspace,
    required this.selected,
  }) : collection = null;

  const _CodexChatScopeTile.collection({
    required this.collection,
    required this.selected,
  }) : workspace = null;

  final Workspace? workspace;
  final WorkspaceCollection? collection;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final workspace = this.workspace;
    final collection = this.collection;
    final isCollection = collection != null;
    final title = isCollection ? collection.name : workspace!.name;
    final subtitle = isCollection
        ? _collectionSubtitle(collection)
        : workspace!.githubRepo.isNotEmpty
        ? workspace.githubRepo
        : workspace.localPath;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: selected
            ? AppColors.accent(context).withValues(alpha: 0.12)
            : AppColors.field(context),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(
            color: selected
                ? AppColors.accent(context).withValues(alpha: 0.6)
                : AppColors.line(context),
          ),
        ),
        child: ListTile(
          leading: Icon(
            isCollection ? Icons.account_tree_outlined : Icons.folder_outlined,
            color: selected
                ? AppColors.accent(context)
                : AppColors.secondaryText(context),
          ),
          title: Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
          subtitle: Text(
            subtitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          trailing: selected ? const Icon(Icons.check_circle) : null,
          onTap: () {
            if (collection != null) {
              Navigator.pop(
                context,
                _CodexChatScopeChoice.collection(collection),
              );
              return;
            }
            if (workspace != null) {
              Navigator.pop(
                context,
                _CodexChatScopeChoice.workspace(workspace),
              );
            }
          },
        ),
      ),
    );
  }

  String _collectionSubtitle(WorkspaceCollection collection) {
    final primary = collection.primaryWorkspace;
    final count = collection.members.length;
    final countLabel = count == 1 ? '1 project' : '$count projects';
    if (primary == null) {
      return countLabel;
    }
    return '$countLabel - starts in ${primary.name}';
  }
}
