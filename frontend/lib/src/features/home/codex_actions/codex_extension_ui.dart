part of '../act_home_page.dart';
// ignore_for_file: invalid_use_of_protected_member

extension _ActHomeCodexExtensionUi on _ActHomePageState {
  Future<void> _respondCodexExtensionUi(
    CodexSessionEvent event,
    String action,
  ) async {
    if (!_canOperateHost) {
      setState(() => _statusMessage = 'Operator access required');
      return;
    }
    final sessionId = _selectedCodexSessionId;
    final requestId = _codexExtensionUiRequestId(event);
    if (!_hasToken || sessionId == null || requestId == null) {
      return;
    }
    String? value;
    bool? confirmed;
    var cancelled = false;
    if (action == 'confirm') {
      confirmed = true;
    } else if (action == 'deny') {
      confirmed = false;
    } else if (action == 'cancel') {
      cancelled = true;
    } else if (action.startsWith('select:')) {
      value = action.substring('select:'.length);
    } else {
      value = await _promptForExtensionUiValue(event);
      if (value == null) {
        cancelled = true;
      }
    }
    try {
      final summary = await _api.respondCodexExtensionUi(
        sessionId: sessionId,
        requestId: requestId,
        value: value,
        confirmed: confirmed,
        cancelled: cancelled,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _codexSessions = [
          summary,
          ..._codexSessions.where((session) => session.id != summary.id),
        ];
        _statusMessage = 'Answered Pi request';
      });
      unawaited(_refreshCodexEvents(sessionId: summary.id, silent: true));
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _codexError = 'Pi request response failed: $error';
        _statusMessage = 'Pi request response failed';
      });
    }
  }

  Future<String?> _promptForExtensionUiValue(CodexSessionEvent event) {
    final controller = TextEditingController(text: event.text ?? '');
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(event.title ?? 'Pi request'),
        content: TextField(
          controller: controller,
          minLines: 3,
          maxLines: 8,
          decoration: const InputDecoration(
            labelText: 'Response',
            alignLabelWithHint: true,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('Send'),
          ),
        ],
      ),
    ).whenComplete(controller.dispose);
  }

  Future<void> _openLinkedCodexTerminal(String terminalSessionId) async {
    var session = _sessions.cast<TerminalSession?>().firstWhere(
      (candidate) => candidate?.id == terminalSessionId,
      orElse: () => null,
    );

    if (session == null && _hasToken) {
      try {
        final sessions = await _api.sessions();
        final buffers = await _loadSessionBuffers(sessions);
        if (!mounted) {
          return;
        }
        setState(() {
          _sessions = sessions;
          _sessionBuffers = _reconcileSessionBuffers(sessions, buffers);
        });
        session = sessions.cast<TerminalSession?>().firstWhere(
          (candidate) => candidate?.id == terminalSessionId,
          orElse: () => null,
        );
      } catch (error) {
        if (!mounted) {
          return;
        }
        setState(
          () => _statusMessage = 'Could not refresh linked terminal: $error',
        );
        return;
      }
    }

    if (session == null) {
      setState(() => _statusMessage = 'Linked terminal is no longer active');
      return;
    }

    final openedSession = session;
    setState(() {
      _activeTerminalSessionId = terminalSessionId;
      _mobileIndex = 1;
      _statusMessage = 'Opened ${openedSession.sessionName}';
    });
  }
}
