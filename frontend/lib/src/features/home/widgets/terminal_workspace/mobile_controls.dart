part of '../terminal_workspace.dart';

class _TerminalPrompt extends StatelessWidget {
  const _TerminalPrompt({
    required this.onCreateSession,
    required this.canCreate,
    this.isCreatingSession = false,
  });

  final VoidCallback onCreateSession;
  final bool canCreate;
  final bool isCreatingSession;

  @override
  Widget build(BuildContext context) {
    final message = canCreate
        ? r'$ create a terminal session to begin'
        : r'$ select a workspace before starting a terminal';
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            message,
            style: TextStyle(
              color: AppColors.secondaryText(context),
              fontFamily: 'monospace',
            ),
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: canCreate && !isCreatingSession ? onCreateSession : null,
            icon: isCreatingSession
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.add),
            label: Text(
              isCreatingSession ? 'Starting terminal...' : 'New terminal',
            ),
          ),
        ],
      ),
    );
  }
}

class _TerminalMobileControls extends StatelessWidget {
  const _TerminalMobileControls({
    required this.activeSessionName,
    required this.onSendRaw,
    required this.onSendLine,
    required this.onOpenComposer,
    required this.onHideKeyboard,
    required this.isConnected,
  });

  final String activeSessionName;
  final bool Function(String) onSendRaw;
  final bool Function(String) onSendLine;
  final VoidCallback onOpenComposer;
  final VoidCallback onHideKeyboard;
  final bool isConnected;

  @override
  Widget build(BuildContext context) {
    final panelColor = AppColors.chrome(context).withValues(alpha: 0.96);
    return SafeArea(
      top: false,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        curve: Curves.easeOut,
        padding: const EdgeInsets.fromLTRB(6, 6, 6, 6),
        decoration: BoxDecoration(
          color: panelColor,
          border: Border(
            top: BorderSide(
              color: AppColors.accent(context).withValues(alpha: 0.45),
            ),
          ),
        ),
        child: _buildExpanded(context),
      ),
    );
  }

  Widget _buildExpanded(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _MobileLineComposer(
          activeSessionName: activeSessionName,
          onSendRaw: onSendRaw,
          onSendLine: onSendLine,
          onOpenComposer: onOpenComposer,
          isConnected: isConnected,
        ),
        const SizedBox(height: 6),
        SizedBox(
          height: 46,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: _buildKeyButtons()),
          ),
        ),
      ],
    );
  }

  List<Widget> _buildKeyButtons() {
    return [
      _MobileKeyButton(
        label: 'Done',
        icon: Icons.keyboard_hide,
        tooltip: 'Hide keyboard',
        onPressed: onHideKeyboard,
      ),
      _MobileKeyButton(
        label: 'BS',
        icon: Icons.backspace_outlined,
        tooltip: 'Backspace',
        onPressed: () => onSendRaw('\x7f'),
      ),
      _MobileKeyButton(
        label: 'Up',
        icon: Icons.keyboard_arrow_up,
        onPressed: () => onSendRaw('\x1b[A'),
      ),
      _MobileKeyButton(
        label: 'Down',
        icon: Icons.keyboard_arrow_down,
        onPressed: () => onSendRaw('\x1b[B'),
      ),
      _MobileKeyButton(
        label: 'Left',
        icon: Icons.keyboard_arrow_left,
        onPressed: () => onSendRaw('\x1b[D'),
      ),
      _MobileKeyButton(
        label: 'Right',
        icon: Icons.keyboard_arrow_right,
        onPressed: () => onSendRaw('\x1b[C'),
      ),
      _MobileKeyButton(
        label: 'Esc',
        icon: Icons.keyboard_command_key,
        onPressed: () => onSendRaw('\x1b'),
      ),
      _MobileKeyButton(
        label: 'C-c',
        icon: Icons.cancel_outlined,
        tooltip: 'Ctrl+C',
        onPressed: () => onSendRaw('\x03'),
      ),
      _MobileKeyButton(
        label: 'EOF',
        icon: Icons.power_settings_new,
        tooltip: 'Ctrl+D',
        onPressed: () => onSendRaw('\x04'),
      ),
      _MobileKeyButton(
        label: 'C-l',
        icon: Icons.cleaning_services_outlined,
        tooltip: 'Ctrl+L',
        onPressed: () => onSendRaw('\x0c'),
      ),
      _MobileKeyButton(
        label: 'C-r',
        icon: Icons.manage_search,
        tooltip: 'Ctrl+R',
        onPressed: () => onSendRaw('\x12'),
      ),
      _MobileKeyButton(
        label: 'Tab',
        icon: Icons.keyboard_tab,
        onPressed: () => onSendRaw('\t'),
      ),
      _MobileKeyButton(
        label: 'Enter',
        icon: Icons.keyboard_return,
        onPressed: () => onSendRaw('\r'),
      ),
      _MobileKeyButton(
        label: 'Delete',
        icon: Icons.delete_outline,
        tooltip: 'Forward delete',
        onPressed: () => onSendRaw('\x1b[3~'),
      ),
    ];
  }
}

class _MobileLineComposer extends StatefulWidget {
  const _MobileLineComposer({
    required this.activeSessionName,
    required this.onSendRaw,
    required this.onSendLine,
    required this.onOpenComposer,
    required this.isConnected,
  });

  final String activeSessionName;
  final bool Function(String) onSendRaw;
  final bool Function(String) onSendLine;
  final VoidCallback onOpenComposer;
  final bool isConnected;

  @override
  State<_MobileLineComposer> createState() => _MobileLineComposerState();
}

class _MobileLineComposerState extends State<_MobileLineComposer> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  final _keyboardFocusNode = FocusNode(skipTraversal: true);
  bool _handlingBackspaceKey = false;

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    _keyboardFocusNode.dispose();
    super.dispose();
  }

  void _send() {
    final text = _controller.text;
    if (text.trim().isEmpty || !widget.isConnected) {
      return;
    }
    if (widget.onSendLine(text)) {
      _controller.clear();
      _focusNode.requestFocus();
    }
  }

  KeyEventResult _handleKeyEvent(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent ||
        event.logicalKey != LogicalKeyboardKey.backspace ||
        !widget.isConnected) {
      return KeyEventResult.ignored;
    }
    if (_controller.text.isNotEmpty) {
      return KeyEventResult.ignored;
    }
    _handlingBackspaceKey = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _handlingBackspaceKey = false;
    });
    return widget.onSendRaw('\x7f')
        ? KeyEventResult.handled
        : KeyEventResult.ignored;
  }

  void _handleChanged(String value) {
    if (!widget.isConnected || _handlingBackspaceKey) {
      return;
    }
    if (value.length >= _lastText.length) {
      _lastText = value;
      return;
    }
    _lastText = value;
    if (value.isEmpty) {
      widget.onSendRaw('\x7f');
    }
  }

  String _lastText = '';

  @override
  Widget build(BuildContext context) {
    return KeyboardListener(
      focusNode: _keyboardFocusNode,
      onKeyEvent: (event) => _handleKeyEvent(_focusNode, event),
      child: SizedBox(
        height: 42,
        child: TextField(
          controller: _controller,
          focusNode: _focusNode,
          readOnly: !widget.isConnected,
          textInputAction: TextInputAction.send,
          autocorrect: false,
          enableSuggestions: false,
          style: const TextStyle(fontFamily: 'monospace', fontSize: 14),
          onChanged: _handleChanged,
          onSubmitted: (_) => _send(),
          decoration: InputDecoration(
            hintText: widget.isConnected
                ? 'Send to ${widget.activeSessionName}'
                : 'Terminal socket offline',
            labelText: 'Active: ${widget.activeSessionName}',
            isDense: true,
            filled: true,
            fillColor: AppColors.field(context),
            prefixIcon: IconButton(
              tooltip: 'Command',
              onPressed: widget.onOpenComposer,
              icon: const Icon(Icons.keyboard_command_key, size: 18),
            ),
            suffixIcon: IconButton(
              tooltip: 'Send line',
              onPressed: widget.isConnected ? _send : null,
              icon: const Icon(Icons.send, size: 18),
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: AppColors.line(context)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: AppColors.line(context)),
            ),
            disabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: AppColors.line(context)),
            ),
          ),
        ),
      ),
    );
  }
}

class _MobileKeyButton extends StatelessWidget {
  const _MobileKeyButton({
    required this.label,
    required this.onPressed,
    this.icon,
    this.tooltip,
  });

  final String label;
  final IconData? icon;
  final String? tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 4),
      child: Tooltip(
        message: tooltip ?? label,
        child: OutlinedButton(
          onPressed: onPressed,
          style: OutlinedButton.styleFrom(
            fixedSize: const Size(48, 46),
            minimumSize: const Size(48, 46),
            padding: EdgeInsets.zero,
            foregroundColor: AppColors.primaryText(context),
            side: BorderSide(color: AppColors.line(context)),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(6),
            ),
          ),
          child: icon == null
              ? Text(label)
              : Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 8,
                        fontWeight: FontWeight.w700,
                        height: 1,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Icon(icon, size: 17, semanticLabel: tooltip ?? label),
                  ],
                ),
        ),
      ),
    );
  }
}
