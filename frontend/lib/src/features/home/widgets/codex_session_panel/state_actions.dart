// ignore_for_file: invalid_use_of_protected_member

part of '../codex_session_panel.dart';

extension _CodexSessionPanelActions on _CodexSessionPanelState {
  void _handleInputChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  CodexSessionSummary? get _selectedSession {
    final selectedId = widget.selectedSessionId;
    if (selectedId == null) {
      return null;
    }
    return widget.sessions.cast<CodexSessionSummary?>().firstWhere(
      (session) =>
          session?.id == selectedId ||
          session?.runtimeSessionId == selectedId ||
          session?.providerSessionId == selectedId,
      orElse: () => null,
    );
  }

  Future<void> _send() async {
    final text = _controller.text.trimRight();
    final selectedSession = _selectedSession;
    if (selectedSession != null) {
      if (_isSending || text.trim().isEmpty) {
        return;
      }
      await _submitText(
        text: text,
        queueLocally: _sessionBusy(selectedSession),
        submit: () => widget.onSendText(text),
      );
      return;
    }
    if (widget.canLaunch && !widget.isLaunching && !_isSending) {
      await _submitPrompt(
        text: text,
        submit: () => widget.onLaunch(text.trim().isEmpty ? null : text),
      );
    }
  }

  Future<void> _interruptAndSend() async {
    final text = _controller.text.trimRight();
    final selectedSession = _selectedSession;
    if (_isSending ||
        selectedSession == null ||
        !_sessionBusy(selectedSession) ||
        text.trim().isEmpty) {
      return;
    }
    await _submitText(
      text: text,
      queueLocally: true,
      submit: () => widget.onInterruptAndSend(text),
    );
  }

  Future<void> _submitPrompt({
    required String text,
    required Future<void> Function() submit,
  }) async {
    await _submitText(text: text, queueLocally: false, submit: submit);
  }

  Future<void> _submitText({
    required String text,
    required bool queueLocally,
    required Future<void> Function() submit,
  }) async {
    setState(() => _isSending = true);
    try {
      await submit();
      if (!mounted) {
        return;
      }
      setState(() {
        if (queueLocally && text.trim().isNotEmpty) {
          _pendingQueuedMessages.add(
            _PendingCodexMessage(text: text.trimRight()),
          );
        }
        _controller.clear();
        _showNewMessages = false;
      });
      if (!queueLocally) {
        _scrollToBottom(animated: true);
      }
    } catch (_) {
      return;
    } finally {
      if (mounted) {
        setState(() => _isSending = false);
      }
    }
  }

  void _dismissKeyboard() {
    _inputFocusNode.unfocus();
    unawaited(SystemChannels.textInput.invokeMethod<void>('TextInput.hide'));
  }

  Future<void> _openSessionSwitcher() async {
    _dismissKeyboard();
    await showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      backgroundColor: AppColors.panel(context),
      builder: (context) {
        return _CodexSessionSheet(
          sessions: widget.sessions,
          selectedSessionId: _selectedSession?.id,
          onNewChat: () {
            Navigator.pop(context);
            widget.onNewChat();
          },
          onSelected: (session) {
            Navigator.pop(context);
            widget.onSessionSelected(session.id);
          },
          onOpenLinkedTerminal: (session) {
            Navigator.pop(context);
            final terminalSessionId = session.terminalSessionId;
            if (terminalSessionId != null) {
              widget.onOpenLinkedTerminal(terminalSessionId);
            }
          },
          onPreviewChanges: widget.onPreviewChanges == null
              ? null
              : (session) {
                  Navigator.pop(context);
                  widget.onPreviewChanges!(session);
                },
        );
      },
    );
  }

  Future<void> _openWorkspaceFilter() async {
    _dismissKeyboard();
    await showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      backgroundColor: AppColors.panel(context),
      builder: (context) {
        return CodexWorkspaceFilterSheet(
          workspaces: widget.workspaces,
          collections: widget.collections,
          selectedWorkspaceId: widget.workspaceFilterId,
          selectedCollectionId: widget.collectionFilterId,
          onWorkspaceSelected: (workspaceId) {
            Navigator.pop(context);
            widget.onWorkspaceFilterChanged?.call(workspaceId);
          },
          onCollectionSelected: (collectionId) {
            Navigator.pop(context);
            widget.onCollectionFilterChanged?.call(collectionId);
          },
          onAllSelected: () {
            Navigator.pop(context);
            widget.onWorkspaceFilterChanged?.call(null);
          },
        );
      },
    );
  }

  void _toggleEvent(int key) {
    setState(() {
      if (!_expandedEventIndexes.add(key)) {
        _expandedEventIndexes.remove(key);
      }
    });
  }

  void _syncPendingQueuedMessages({required bool reset}) {
    final queuedCount = _selectedSession?.queuedMessageCount ?? 0;
    if (reset) {
      _pendingQueuedMessages.clear();
    }
    if (queuedCount <= 0) {
      _pendingQueuedMessages.clear();
      return;
    }
    if (_pendingQueuedMessages.length > queuedCount) {
      _pendingQueuedMessages.removeRange(
        0,
        _pendingQueuedMessages.length - queuedCount,
      );
    }
    if (_pendingQueuedMessages.length >= queuedCount) {
      return;
    }
    final queuedEvents = widget.events
        .where(_eventQueuedUserMessage)
        .map(
          (event) =>
              _PendingCodexMessage(text: (_eventBody(event) ?? '').trimRight()),
        )
        .where((message) => message.text.trim().isNotEmpty)
        .toList(growable: false);
    final needed = queuedCount - _pendingQueuedMessages.length;
    if (queuedEvents.isEmpty || needed <= 0) {
      return;
    }
    final start = queuedEvents.length > needed
        ? queuedEvents.length - needed
        : 0;
    _pendingQueuedMessages.addAll(queuedEvents.skip(start));
  }

  String _streamSignature(List<CodexSessionEvent> visibleEvents) {
    final last = visibleEvents.isEmpty ? null : visibleEvents.last;
    final body = last == null ? '' : _eventBody(last) ?? '';
    return [
      widget.selectedSessionId ?? '',
      visibleEvents.length,
      last?.index ?? -1,
      last?.kind ?? '',
      last?.role ?? '',
      last?.status ?? '',
      body.length,
      body.hashCode,
      _selectedSession?.status ?? '',
      _selectedSession?.isBusy == true,
    ].join('|');
  }

  bool get _isNearBottom {
    if (!_scrollController.hasClients) {
      return true;
    }
    final position = _scrollController.position;
    return position.maxScrollExtent - position.pixels < 160;
  }

  void _scrollToBottom({required bool animated}) {
    if (_scrollToBottomScheduled) {
      return;
    }
    _scrollToBottomScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollToBottomScheduled = false;
      if (!_scrollController.hasClients) {
        return;
      }
      final target = _scrollController.position.maxScrollExtent;
      final distance = (target - _scrollController.position.pixels).abs();
      if (distance < 1) {
        return;
      }
      if (animated) {
        unawaited(
          _scrollController.animateTo(
            target,
            duration: const Duration(milliseconds: 140),
            curve: Curves.easeOutCubic,
          ),
        );
      } else {
        _scrollController.jumpTo(target);
      }
    });
  }
}
