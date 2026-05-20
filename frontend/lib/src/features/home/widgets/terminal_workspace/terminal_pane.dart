part of '../terminal_workspace.dart';
// ignore_for_file: invalid_use_of_protected_member

class _TerminalPane extends StatefulWidget {
  const _TerminalPane({
    required this.isActive,
    required this.workspace,
    required this.session,
    required this.socketClient,
    required this.onTerminateSession,
    required this.onSessionUnavailable,
    required this.onActivate,
    required this.showHeader,
    this.initialBuffer,
    super.key,
  });

  final bool isActive;
  final Workspace workspace;
  final TerminalSession session;
  final TerminalSocketClient? socketClient;
  final ValueChanged<TerminalSession> onTerminateSession;
  final ValueChanged<TerminalSession> onSessionUnavailable;
  final VoidCallback onActivate;
  final bool showHeader;
  final String? initialBuffer;

  @override
  State<_TerminalPane> createState() => _TerminalPaneState();
}

class _TerminalPaneState extends State<_TerminalPane> {
  static const _mobileInputSentinel = ' ';
  static const _mobileKeyboardDismissThreshold = 18.0;
  static const _terminalFontFamily = 'ACTMono';
  static const _terminalFontFallback = [
    'Menlo',
    'Monaco',
    'Consolas',
    'Liberation Mono',
    'Courier New',
    'Noto Sans Mono',
    'monospace',
  ];

  late final Terminal _terminal;
  final _focusNode = FocusNode();
  final _mobileInputController = TextEditingController(
    text: _mobileInputSentinel,
  );
  final _mobileInputFocusNode = FocusNode(skipTraversal: true);
  StreamSubscription<TerminalOutput>? _outputSub;
  StreamSubscription<bool>? _connectionSub;
  StreamSubscription<TerminalError>? _errorSub;
  bool _attached = false;
  bool _connected = false;
  bool _terminalSized = false;
  bool _initialBufferWritten = false;
  bool _initialBufferWriteScheduled = false;
  bool _attachMessageWritten = false;
  bool _hasLiveOutput = false;
  bool _syncingMobileInput = false;
  bool _mobileKeyboardDismissedForDrag = false;
  bool _suppressMobileKeyboardShowForDrag = false;
  double _mobileKeyboardDismissDragDistance = 0;
  int _cols = 120;
  int _rows = 34;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(_handleFocusChanged);
    _mobileInputFocusNode.addListener(_handleMobileInputFocusChanged);
    _terminal = Terminal(
      maxLines: 5000,
      onOutput: (data) {
        _sendTerminalData(_normalizeTerminalInput(data));
      },
      onResize: (width, height, _, _) {
        _cols = width;
        _rows = height;
        _terminalSized = true;
        _scheduleInitialBufferWrite();
        widget.socketClient?.resizeTerminal(
          sessionId: widget.session.id,
          cols: width,
          rows: height,
        );
      },
    );
    _bindSocket();
    _attachWhenReady();
  }

  @override
  void didUpdateWidget(covariant _TerminalPane oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!oldWidget.isActive && widget.isActive) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _focusTerminal();
        }
      });
    }
    if (oldWidget.socketClient != widget.socketClient ||
        oldWidget.session.id != widget.session.id) {
      _outputSub?.cancel();
      _connectionSub?.cancel();
      _errorSub?.cancel();
      _attached = false;
      _connected = false;
      _initialBufferWritten = false;
      _initialBufferWriteScheduled = false;
      _attachMessageWritten = false;
      _hasLiveOutput = false;
      _terminalSized = false;
      _bindSocket();
      _attachWhenReady();
    } else if (oldWidget.initialBuffer != widget.initialBuffer &&
        widget.initialBuffer?.isNotEmpty == true &&
        !_hasLiveOutput) {
      _initialBufferWritten = false;
      _scheduleInitialBufferWrite();
    }
  }

  @override
  void dispose() {
    _focusNode.removeListener(_handleFocusChanged);
    _mobileInputFocusNode.removeListener(_handleMobileInputFocusChanged);
    _outputSub?.cancel();
    _connectionSub?.cancel();
    _errorSub?.cancel();
    _mobileInputController.dispose();
    _mobileInputFocusNode.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _handleFocusChanged() {
    if (_focusNode.hasFocus) {
      widget.onActivate();
    }
  }

  void _handleMobileInputFocusChanged() {
    if (_mobileInputFocusNode.hasFocus) {
      widget.onActivate();
      _resetMobileInput();
    }
  }

  void _focusTerminal() {
    widget.onActivate();
    final mobile = MediaQuery.sizeOf(context).width < 760;
    if (mobile) {
      _showMobileKeyboard();
    } else {
      _focusNode.requestFocus();
    }
  }

  void _showMobileKeyboard() {
    if (!_mobileInputFocusNode.hasFocus) {
      _mobileInputFocusNode.requestFocus();
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      if (_suppressMobileKeyboardShowForDrag) {
        return;
      }
      if (!_mobileInputFocusNode.hasFocus) {
        _mobileInputFocusNode.requestFocus();
      }
      if (!_mobileInputFocusNode.hasFocus) {
        return;
      }
      unawaited(SystemChannels.textInput.invokeMethod<void>('TextInput.show'));
    });
  }

  void _hideMobileKeyboard() {
    FocusManager.instance.primaryFocus?.unfocus();
    unawaited(SystemChannels.textInput.invokeMethod<void>('TextInput.hide'));
  }

  void _handleMobileTerminalPointerDown() {
    _mobileKeyboardDismissDragDistance = 0;
    _mobileKeyboardDismissedForDrag = false;
    _suppressMobileKeyboardShowForDrag = false;
    _focusTerminal();
  }

  void _handleMobileTerminalPointerMove(PointerMoveEvent event) {
    if (_mobileKeyboardDismissedForDrag ||
        event.delta.dy.abs() <= event.delta.dx.abs()) {
      return;
    }
    _mobileKeyboardDismissDragDistance =
        (_mobileKeyboardDismissDragDistance + event.delta.dy.abs())
            .clamp(0.0, _mobileKeyboardDismissThreshold)
            .toDouble();
    if (_mobileKeyboardDismissDragDistance < _mobileKeyboardDismissThreshold) {
      return;
    }
    _mobileKeyboardDismissedForDrag = true;
    _suppressMobileKeyboardShowForDrag = true;
    _hideMobileKeyboard();
  }

  void _handleMobileInputChanged(String value) {
    if (_syncingMobileInput) {
      return;
    }
    if (!_connected) {
      _resetMobileInput();
      return;
    }

    if (value.length < _mobileInputSentinel.length) {
      _sendTerminalData('\x7f');
      _resetMobileInput();
      return;
    }

    final inserted = value.startsWith(_mobileInputSentinel)
        ? value.substring(_mobileInputSentinel.length)
        : value;
    if (inserted.isNotEmpty) {
      _sendTerminalData(inserted.replaceAll('\n', '\r'));
    }
    _resetMobileInput();
  }

  void _resetMobileInput() {
    _syncingMobileInput = true;
    _mobileInputController.value = const TextEditingValue(
      text: _mobileInputSentinel,
      selection: TextSelection.collapsed(offset: _mobileInputSentinel.length),
    );
    _syncingMobileInput = false;
  }

  void _bindSocket() {
    final socket = widget.socketClient;
    if (socket == null) {
      _terminal.write(
        'socket client unavailable; showing buffered output only\r\n',
      );
      return;
    }
    _connected = socket.isConnected;

    _outputSub = socket.terminalOutput.listen((event) {
      if (event.sessionId == widget.session.id) {
        _hasLiveOutput = true;
        _terminal.write(event.output);
      }
    });
    _connectionSub = socket.connectionChanges.listen((connected) {
      if (mounted) {
        setState(() => _connected = connected);
      }
      if (connected) {
        _attachWhenReady();
      } else {
        _attached = false;
      }
    });
    _errorSub = socket.errors.listen((error) {
      if (error.sessionId != widget.session.id) {
        return;
      }
      if (error.isSessionNotFound) {
        widget.onSessionUnavailable(widget.session);
        return;
      }
      _terminal.write('\r\n${error.message}\r\n');
    });
  }

  void _attachWhenReady() {
    final socket = widget.socketClient;
    if (socket == null || _attached || !socket.isConnected) {
      return;
    }
    socket.createTerminal(
      workspaceId: widget.workspace.id,
      sessionId: widget.session.id,
      paneId: 'pane-${widget.session.id}',
      cols: _cols,
      rows: _rows,
    );
    socket.resizeTerminal(
      sessionId: widget.session.id,
      cols: _cols,
      rows: _rows,
    );
    _attached = true;
  }

  void _scheduleInitialBufferWrite() {
    if (_initialBufferWritten ||
        _initialBufferWriteScheduled ||
        !_terminalSized) {
      return;
    }
    if (_attachMessageWritten && widget.initialBuffer?.isNotEmpty != true) {
      return;
    }

    _initialBufferWriteScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      _writeInitialBufferIfReady();
    });
  }

  void _writeInitialBufferIfReady() {
    if (_initialBufferWritten || !_terminalSized) {
      return;
    }
    _initialBufferWriteScheduled = false;
    final initialBuffer = widget.initialBuffer;
    if (initialBuffer != null && initialBuffer.isNotEmpty && !_hasLiveOutput) {
      _initialBufferWritten = true;
      _attachMessageWritten = true;
      _terminal.write('\x1bc');
      _terminal.write(initialBuffer);
    } else if (!_attachMessageWritten) {
      _attachMessageWritten = true;
      _terminal.write('attaching ${widget.session.sessionName}...\r\n');
    }
  }

  void _sendTerminalData(String data) {
    final sent = widget.socketClient?.sendTerminalData(
      sessionId: widget.session.id,
      data: _normalizeTerminalInput(data),
    );
    if (sent != true) {
      _terminal.write('\r\nterminal input blocked while socket is offline\r\n');
    }
  }

  @override
  Widget build(BuildContext context) {
    final mobile = MediaQuery.sizeOf(context).width < 760;
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: _focusTerminal,
      child: Column(
        children: [
          if (widget.showHeader)
            LayoutBuilder(
              builder: (context, constraints) {
                final cramped = constraints.maxWidth < 230;
                return Container(
                  height: 30,
                  padding: EdgeInsets.symmetric(horizontal: cramped ? 6 : 10),
                  decoration: BoxDecoration(
                    color: AppColors.chrome(context),
                    border: Border(
                      bottom: BorderSide(color: AppColors.line(context)),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.circle,
                        size: 8,
                        color: _connected
                            ? AppColors.success(context)
                            : AppColors.warning(context),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          widget.session.sessionName,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: AppColors.secondaryText(context),
                            fontSize: cramped ? 11 : 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      if (!cramped)
                        Text(
                          _connected ? widget.session.status : 'socket offline',
                          style: TextStyle(
                            color: AppColors.mutedText(context),
                            fontSize: 11,
                          ),
                        ),
                      IconButton(
                        tooltip: 'Close terminal',
                        visualDensity: VisualDensity.compact,
                        padding: EdgeInsets.zero,
                        constraints: BoxConstraints.tightFor(
                          width: cramped ? 22 : 28,
                          height: 28,
                        ),
                        onPressed: () =>
                            widget.onTerminateSession(widget.session),
                        icon: const Icon(Icons.close, size: 14),
                      ),
                    ],
                  ),
                );
              },
            ),
          Expanded(
            child: Stack(
              children: [
                Positioned.fill(child: _buildTerminalView(mobile)),
                if (mobile)
                  Positioned(
                    left: 0,
                    top: 0,
                    width: 1,
                    height: 1,
                    child: ExcludeSemantics(
                      child: Opacity(
                        opacity: 0,
                        child: TextField(
                          key: ValueKey('terminal-input-${widget.session.id}'),
                          controller: _mobileInputController,
                          focusNode: _mobileInputFocusNode,
                          autofocus: widget.isActive,
                          autocorrect: false,
                          enableSuggestions: false,
                          keyboardType: TextInputType.multiline,
                          textInputAction: TextInputAction.newline,
                          maxLines: null,
                          onChanged: _handleMobileInputChanged,
                          onSubmitted: (_) => _sendTerminalData('\r'),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTerminalView(bool mobile) {
    final terminalView = TerminalView(
      _terminal,
      key: ValueKey('terminal-view-${widget.session.id}'),
      focusNode: _focusNode,
      autofocus: widget.isActive && !mobile,
      alwaysShowCursor: mobile && widget.isActive,
      readOnly: mobile,
      deleteDetection: !mobile,
      keyboardType: TextInputType.text,
      padding: EdgeInsets.all(mobile ? 6 : 8),
      textStyle: TerminalStyle(
        fontSize: mobile ? 10 : 13,
        height: mobile ? 1.16 : 1.25,
        fontFamily: _terminalFontFamily,
        fontFamilyFallback: _terminalFontFallback,
      ),
      theme: TerminalThemes.defaultTheme,
    );
    if (!mobile) {
      return terminalView;
    }
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => _handleMobileTerminalPointerDown(),
      onPointerMove: _handleMobileTerminalPointerMove,
      child: ExcludeFocus(child: terminalView),
    );
  }
}
