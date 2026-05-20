part of '../terminal_workspace.dart';
// ignore_for_file: invalid_use_of_protected_member

class _TerminalMultiplexer extends StatefulWidget {
  const _TerminalMultiplexer({
    required this.selectedWorkspace,
    required this.workspaceById,
    required this.sessions,
    required this.buffers,
    required this.socketClient,
    required this.onCreateSession,
    required this.onTerminateSession,
    required this.onSessionUnavailable,
    required this.controlsExpanded,
    required this.onControlsExpandedChanged,
    required this.focusMode,
    required this.onActiveSessionChanged,
    required this.focusedSessionId,
  });

  final Workspace? selectedWorkspace;
  final Map<String, Workspace> workspaceById;
  final List<TerminalSession> sessions;
  final Map<String, String> buffers;
  final TerminalSocketClient? socketClient;
  final VoidCallback onCreateSession;
  final ValueChanged<TerminalSession> onTerminateSession;
  final ValueChanged<TerminalSession> onSessionUnavailable;
  final bool controlsExpanded;
  final ValueChanged<bool> onControlsExpandedChanged;
  final bool focusMode;
  final ValueChanged<TerminalSession?>? onActiveSessionChanged;
  final String? focusedSessionId;

  @override
  State<_TerminalMultiplexer> createState() => _TerminalMultiplexerState();
}

class _TerminalMultiplexerState extends State<_TerminalMultiplexer> {
  static const _mobileControlsReservedHeight = 108.0;

  String? _activeSessionId;
  final _paneKeys = <String, GlobalKey<_TerminalPaneState>>{};

  @override
  void initState() {
    super.initState();
    _activeSessionId = _sessionIdOrFirst(widget.focusedSessionId);
    _emitActiveSessionChanged();
  }

  @override
  void didUpdateWidget(covariant _TerminalMultiplexer oldWidget) {
    super.didUpdateWidget(oldWidget);
    final previousActiveSessionId = _activeSessionId;
    if (oldWidget.focusedSessionId != widget.focusedSessionId &&
        widget.focusedSessionId != null &&
        widget.sessions.any(
          (session) => session.id == widget.focusedSessionId,
        )) {
      _activeSessionId = widget.focusedSessionId;
    } else if (!widget.sessions.any(
      (session) => session.id == _activeSessionId,
    )) {
      _activeSessionId = _sessionIdOrFirst(widget.focusedSessionId);
    }
    final sessionIds = widget.sessions.map((session) => session.id).toSet();
    _paneKeys.removeWhere((sessionId, _) => !sessionIds.contains(sessionId));
    if (previousActiveSessionId != _activeSessionId) {
      _emitActiveSessionChanged();
    }
  }

  @override
  Widget build(BuildContext context) {
    final mobile = MediaQuery.sizeOf(context).width < 760;
    final activeSession = _activeSession();
    final connected = widget.socketClient?.isConnected == true;
    if (widget.sessions.isEmpty) {
      return _TerminalPrompt(
        onCreateSession: widget.onCreateSession,
        canCreate: widget.selectedWorkspace != null,
      );
    }

    return Stack(
      children: [
        Positioned.fill(
          bottom: mobile && widget.controlsExpanded
              ? _mobileControlsReservedHeight
              : 0,
          child: _buildTerminalDeck(mobile),
        ),
        if (mobile && widget.controlsExpanded && activeSession != null)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _TerminalMobileControls(
              activeSessionName: activeSession.sessionName,
              onSendRaw: (data) => _sendTerminalData(activeSession, data),
              onSendLine: (command) => _sendCommand(activeSession, command),
              onOpenComposer: () => _openCommandComposer(activeSession),
              onHideKeyboard: _hideKeyboard,
              isConnected: connected,
            ),
          ),
      ],
    );
  }

  TerminalSession? _activeSession() {
    if (widget.sessions.isEmpty) {
      return null;
    }
    return widget.sessions.firstWhere(
      (session) => session.id == _activeSessionId,
      orElse: () => widget.sessions.first,
    );
  }

  String? _sessionIdOrFirst(String? preferredSessionId) {
    if (widget.sessions.isEmpty) {
      return null;
    }
    if (preferredSessionId != null &&
        widget.sessions.any((session) => session.id == preferredSessionId)) {
      return preferredSessionId;
    }
    return widget.sessions.first.id;
  }

  void _activateSession(String sessionId) {
    if (_activeSessionId == sessionId) {
      return;
    }
    setState(() => _activeSessionId = sessionId);
    _emitActiveSessionChanged();
  }

  void _emitActiveSessionChanged() {
    final callback = widget.onActiveSessionChanged;
    if (callback == null) {
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      callback(_activeSession());
    });
  }

  Widget _buildTerminalDeck(bool mobile) {
    final activeSession = _activeSession();
    if (!mobile) {
      return _buildPaneLayout(mobile: false);
    }
    if (widget.focusMode && activeSession != null) {
      return _buildPane(activeSession, showHeader: true);
    }
    return _buildPaneLayout(mobile: true);
  }

  Widget _buildPaneLayout({required bool mobile}) {
    if (widget.sessions.length == 1) {
      final session = widget.sessions.first;
      return _buildPane(session, showHeader: true);
    }

    if (!mobile && widget.sessions.length == 2) {
      return Row(
        children: [
          Expanded(child: _buildPane(widget.sessions[0], showHeader: true)),
          VerticalDivider(width: 1, color: AppColors.line(context)),
          Expanded(child: _buildPane(widget.sessions[1], showHeader: true)),
        ],
      );
    }

    final visibleSessions = mobile
        ? widget.sessions
        : widget.sessions.take(4).toList(growable: false);
    return GridView.builder(
      padding: EdgeInsets.zero,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: mobile ? 0.72 : 1.55,
      ),
      itemCount: visibleSessions.length,
      itemBuilder: (context, index) {
        final session = visibleSessions[index];
        final hasRightSeparator =
            index.isEven && index + 1 < visibleSessions.length;
        final hasBottomSeparator = index + 2 < visibleSessions.length;
        return DecoratedBox(
          key: ValueKey('terminal-grid-cell-${session.id}'),
          position: DecorationPosition.foreground,
          decoration: BoxDecoration(
            border: Border(
              right: hasRightSeparator
                  ? BorderSide(color: AppColors.lineStrong(context))
                  : BorderSide.none,
              bottom: hasBottomSeparator
                  ? BorderSide(color: AppColors.lineStrong(context))
                  : BorderSide.none,
            ),
          ),
          child: _buildPane(
            session,
            showHeader: !mobile || session.id == _activeSession()?.id,
          ),
        );
      },
    );
  }

  Widget _buildPane(TerminalSession session, {required bool showHeader}) {
    final workspace = _workspaceForSession(session);
    final isActive = session.id == _activeSession()?.id;
    if (workspace == null) {
      return _ActiveTerminalPaneFrame(
        onTap: () => _activateSession(session.id),
        child: _TerminalPaneUnavailable(
          session: session,
          onTerminateSession: widget.onTerminateSession,
        ),
      );
    }
    final key = _paneKeys.putIfAbsent(
      session.id,
      () => GlobalKey<_TerminalPaneState>(
        debugLabel: 'terminal-pane-${session.id}',
      ),
    );
    return _ActiveTerminalPaneFrame(
      onTap: () => _activateSession(session.id),
      child: _TerminalPane(
        key: key,
        isActive: isActive,
        workspace: workspace,
        session: session,
        showHeader: showHeader,
        initialBuffer: widget.buffers[session.id],
        socketClient: widget.socketClient,
        onTerminateSession: widget.onTerminateSession,
        onSessionUnavailable: widget.onSessionUnavailable,
        onActivate: () => _activateSession(session.id),
      ),
    );
  }

  Workspace? _workspaceForSession(TerminalSession session) {
    final workspaceId = session.workspaceId;
    if (workspaceId == null || workspaceId.isEmpty) {
      return widget.selectedWorkspace;
    }
    return widget.workspaceById[workspaceId] ?? widget.selectedWorkspace;
  }

  bool _sendTerminalData(TerminalSession session, String data) {
    final sent = widget.socketClient?.sendTerminalData(
      sessionId: session.id,
      data: _normalizeTerminalInput(data),
    );
    if (sent != true) {
      return false;
    }
    return true;
  }

  bool _sendCommand(TerminalSession session, String command) {
    final trimmed = command.trimRight();
    if (trimmed.isEmpty) {
      return false;
    }
    return _sendTerminalData(session, '$trimmed\r');
  }

  Future<void> _openCommandComposer(TerminalSession session) async {
    final workspace = _workspaceForSession(session);
    if (workspace == null) {
      return;
    }
    final command = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppColors.panel(context),
      builder: (context) => _CommandComposerSheet(workspace: workspace),
    );
    if (command != null) {
      _sendCommand(session, command);
    }
  }

  void _hideKeyboard() {
    FocusManager.instance.primaryFocus?.unfocus();
    unawaited(SystemChannels.textInput.invokeMethod<void>('TextInput.hide'));
  }
}

class _ActiveTerminalPaneFrame extends StatelessWidget {
  const _ActiveTerminalPaneFrame({required this.onTap, required this.child});

  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTapDown: (_) => onTap(),
      child: child,
    );
  }
}

class _TerminalPaneUnavailable extends StatelessWidget {
  const _TerminalPaneUnavailable({
    required this.session,
    required this.onTerminateSession,
  });

  final TerminalSession session;
  final ValueChanged<TerminalSession> onTerminateSession;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.field(context),
      child: Column(
        children: [
          Container(
            height: 30,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: AppColors.chrome(context),
              border: Border(
                bottom: BorderSide(color: AppColors.line(context)),
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.warning_amber, size: 14),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    session.sessionName,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.secondaryText(context),
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Close terminal',
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                  constraints: BoxConstraints.tightFor(width: 28, height: 28),
                  onPressed: () => onTerminateSession(session),
                  icon: const Icon(Icons.close, size: 14),
                ),
              ],
            ),
          ),
          Expanded(
            child: Center(
              child: Text(
                'Workspace unavailable for this terminal',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.secondaryText(context)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _normalizeTerminalInput(String data) {
  // iOS soft keyboards can emit BS while most PTYs expect DEL for erase.
  return data.replaceAll('\b', '\x7f');
}
