// ignore_for_file: invalid_use_of_protected_member
import 'dart:async';
import 'dart:convert';

import 'package:act_frontend/src/app/app_colors.dart';
import 'package:act_frontend/src/models/codex_session.dart';
import 'package:act_frontend/src/models/coding_agent.dart';
import 'package:act_frontend/src/models/workspace.dart';
import 'package:act_frontend/src/models/workspace_collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:highlight/highlight.dart' as hl;
import 'package:url_launcher/url_launcher.dart';

part 'codex_session_panel/thread_controls.dart';
part 'codex_session_panel/state_actions.dart';
part 'codex_session_panel/event_stream.dart';
part 'codex_session_panel/progress.dart';
part 'codex_session_panel/event_tile.dart';
part 'codex_session_panel/markdown.dart';
part 'codex_session_panel/input_and_helpers.dart';
part 'codex_session_panel/event_helpers.dart';

typedef CodexPromptCallback = Future<void> Function(String? prompt);
typedef CodexTextCallback = Future<void> Function(String text);
typedef CodexSessionActionCallback =
    Future<void> Function(CodexSessionSummary session);
typedef CodexExtensionUiCallback =
    Future<void> Function(CodexSessionEvent event, String action);

class CodexSessionPanel extends StatefulWidget {
  const CodexSessionPanel({
    required this.workspace,
    required this.sessions,
    required this.events,
    required this.selectedSessionId,
    required this.isLoading,
    required this.error,
    required this.canLaunch,
    required this.isLaunching,
    required this.onLaunch,
    required this.onNewChat,
    required this.onSessionSelected,
    required this.onOpenLinkedTerminal,
    required this.onSendText,
    required this.onInterruptAndSend,
    required this.onInterrupt,
    this.onExtensionUiResponse,
    this.onPreviewChanges,
    this.canCreatePullRequests,
    this.onCreatePullRequests,
    this.workspaces = const [],
    this.collections = const [],
    this.selectedCollection,
    this.workspaceFilterId,
    this.collectionFilterId,
    this.onWorkspaceFilterChanged,
    this.onCollectionFilterChanged,
    this.onManageCollections,
    this.showThreadActions = true,
    this.agentProvider = 'codex',
    this.reloadPiNextPrompt = false,
    super.key,
  });

  final Workspace? workspace;
  final List<Workspace> workspaces;
  final List<WorkspaceCollection> collections;
  final WorkspaceCollection? selectedCollection;
  final String? workspaceFilterId;
  final String? collectionFilterId;
  final List<CodexSessionSummary> sessions;
  final List<CodexSessionEvent> events;
  final String? selectedSessionId;
  final bool isLoading;
  final String? error;
  final bool canLaunch;
  final bool isLaunching;
  final bool showThreadActions;
  final String agentProvider;
  final bool reloadPiNextPrompt;
  final CodexPromptCallback onLaunch;
  final VoidCallback onNewChat;
  final ValueChanged<String?>? onWorkspaceFilterChanged;
  final ValueChanged<String?>? onCollectionFilterChanged;
  final ValueChanged<String> onSessionSelected;
  final ValueChanged<String> onOpenLinkedTerminal;
  final ValueChanged<CodexSessionSummary>? onPreviewChanges;
  final bool Function(CodexSessionSummary session)? canCreatePullRequests;
  final CodexSessionActionCallback? onCreatePullRequests;
  final CodexTextCallback onSendText;
  final CodexTextCallback onInterruptAndSend;
  final VoidCallback onInterrupt;
  final CodexExtensionUiCallback? onExtensionUiResponse;
  final VoidCallback? onManageCollections;

  @override
  State<CodexSessionPanel> createState() => _CodexSessionPanelState();
}

class _CodexSessionPanelState extends State<CodexSessionPanel> {
  final _controller = TextEditingController();
  final _inputFocusNode = FocusNode();
  final _scrollController = ScrollController();
  final _expandedEventIndexes = <int>{};
  final _pendingQueuedMessages = <_PendingCodexMessage>[];
  late List<CodexSessionEvent> _visibleEvents;
  late List<_CodexStreamEntry> _streamEntries;
  bool _isSending = false;
  bool _showNewMessages = false;
  bool _scrollToBottomScheduled = false;
  String? _lastSessionId;
  String _lastStreamSignature = '';

  @override
  void initState() {
    super.initState();
    _controller.addListener(_handleInputChanged);
    _lastSessionId = widget.selectedSessionId;
    _visibleEvents = _visibleCodexEvents(widget.events);
    _streamEntries = _groupCodexStream(_visibleEvents);
    _lastStreamSignature = _streamSignature(_visibleEvents);
    _syncPendingQueuedMessages(reset: true);
    _scrollToBottom(animated: false);
  }

  @override
  void dispose() {
    _controller.removeListener(_handleInputChanged);
    _controller.dispose();
    _inputFocusNode.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant CodexSessionPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    final visibleEvents = _visibleCodexEvents(widget.events);
    final sessionChanged = widget.selectedSessionId != _lastSessionId;
    final streamSignature = _streamSignature(visibleEvents);
    final streamChanged = streamSignature != _lastStreamSignature;
    _visibleEvents = visibleEvents;
    _streamEntries = _groupCodexStream(visibleEvents);
    if (sessionChanged) {
      _expandedEventIndexes.clear();
      _showNewMessages = false;
      _lastSessionId = widget.selectedSessionId;
      _lastStreamSignature = streamSignature;
      _syncPendingQueuedMessages(reset: true);
      _scrollToBottom(animated: false);
      return;
    }
    _syncPendingQueuedMessages(reset: false);
    if (streamChanged) {
      final shouldStick = _isNearBottom || _isSending;
      _lastStreamSignature = streamSignature;
      if (shouldStick) {
        _showNewMessages = false;
        _scrollToBottom(animated: true);
      } else if (visibleEvents.isNotEmpty) {
        setState(() => _showNewMessages = true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedSession = _selectedSession;
    final selectedBusy =
        selectedSession != null && _sessionBusy(selectedSession);
    final hasInputText = _controller.text.trim().isNotEmpty;
    final canSendMessage = selectedSession != null;
    final canInterruptAndSend = selectedBusy && hasInputText;
    final canStartNew =
        selectedSession == null && widget.canLaunch && !widget.isLaunching;
    final queuedMessages = _pendingQueuedMessages
        .map((message) => message.text)
        .where((text) => text.trim().isNotEmpty)
        .toList(growable: false);
    return Container(
      color: AppColors.chrome(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.error != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
              child: _CodexNotice(message: widget.error!),
            ),
          _CodexThreadSwitcher(
            session: selectedSession,
            sessionCount: widget.sessions.length,
            workspace: widget.workspace,
            collection: widget.selectedCollection,
            filterWorkspace: _workspaceForId(
              widget.workspaces,
              widget.workspaceFilterId,
            ),
            filterCollection: _collectionForId(
              widget.collections,
              widget.collectionFilterId,
            ),
            showingAllWorkspaces:
                widget.workspaceFilterId == null &&
                widget.collectionFilterId == null,
            defaultAgentProvider: widget.agentProvider,
            isLoading: widget.isLoading,
            showActions: widget.showThreadActions,
            onNewChat: widget.onNewChat,
            onPreviewChanges:
                selectedSession == null || widget.onPreviewChanges == null
                ? null
                : () => widget.onPreviewChanges!(selectedSession),
            onCreatePullRequests:
                selectedSession == null ||
                    widget.onCreatePullRequests == null ||
                    widget.canCreatePullRequests?.call(selectedSession) != true
                ? null
                : () => widget.onCreatePullRequests!(selectedSession),
            onFilter: _openWorkspaceFilter,
            onManageCollections: widget.onManageCollections,
            onPressed: widget.sessions.isEmpty ? null : _openSessionSwitcher,
          ),
          Divider(height: 1, color: AppColors.line(context)),
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: _dismissKeyboard,
              child: widget.isLoading && widget.events.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : _visibleEvents.isEmpty
                  ? selectedBusy
                        ? _CodexEventStream(
                            controller: _scrollController,
                            entries: _streamEntries,
                            expandedIndexes: _expandedEventIndexes,
                            onToggle: _toggleEvent,
                            showNewMessages: _showNewMessages,
                            onShowLatest: () {
                              setState(() => _showNewMessages = false);
                              _scrollToBottom(animated: true);
                            },
                            onExtensionUiResponse: widget.onExtensionUiResponse,
                            isBusy: selectedBusy,
                            progressEvents: widget.events,
                          )
                        : _CodexEmpty(
                            label: selectedSession == null
                                ? 'Start Agent with a prompt'
                                : 'No conversation events yet',
                          )
                  : _CodexEventStream(
                      controller: _scrollController,
                      entries: _streamEntries,
                      expandedIndexes: _expandedEventIndexes,
                      onToggle: _toggleEvent,
                      showNewMessages: _showNewMessages,
                      onShowLatest: () {
                        setState(() => _showNewMessages = false);
                        _scrollToBottom(animated: true);
                      },
                      onExtensionUiResponse: widget.onExtensionUiResponse,
                      isBusy: selectedBusy,
                      progressEvents: widget.events,
                    ),
            ),
          ),
          if (queuedMessages.isNotEmpty)
            _CodexPendingQueue(messages: queuedMessages),
          _CodexInputBar(
            session: selectedSession,
            defaultAgentProvider: widget.agentProvider,
            controller: _controller,
            focusNode: _inputFocusNode,
            events: widget.events,
            enabled: canSendMessage || canStartNew,
            canSendMessage: canSendMessage,
            canLaunch: canStartNew,
            isBusy: selectedBusy,
            isSending: _isSending,
            canInterruptAndSend: canInterruptAndSend,
            reloadPiNextPrompt: widget.reloadPiNextPrompt,
            onSend: _send,
            onInterruptAndSend: _interruptAndSend,
            onInterrupt: widget.onInterrupt,
            onTapOutside: _dismissKeyboard,
          ),
        ],
      ),
    );
  }
}
