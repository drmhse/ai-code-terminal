part of '../terminal_workspace.dart';
// ignore_for_file: invalid_use_of_protected_member

class _CommandComposerSheet extends StatefulWidget {
  const _CommandComposerSheet({required this.workspace});

  final Workspace workspace;

  @override
  State<_CommandComposerSheet> createState() => _CommandComposerSheetState();
}

class _CommandComposerSheetState extends State<_CommandComposerSheet> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    Navigator.pop(context, _controller.text);
  }

  void _useTemplate(String command) {
    setState(() {
      _controller.text = command;
      _controller.selection = TextSelection.collapsed(offset: command.length);
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final compact = MediaQuery.sizeOf(context).width < 420;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.terminal, color: AppColors.accent(context)),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  widget.workspace.name,
                  overflow: TextOverflow.ellipsis,
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
          const SizedBox(height: 6),
          Text(
            'Compose on the full keyboard, then send one clean command into the active terminal.',
            style: TextStyle(
              color: AppColors.mutedText(context),
              fontSize: compact ? 12 : 13,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _CommandTemplate(
                label: 'codex',
                onTap: () => _useTemplate('codex'),
              ),
              _CommandTemplate(
                label: 'claude',
                onTap: () => _useTemplate('claude'),
              ),
              _CommandTemplate(
                label: 'git status',
                onTap: () => _useTemplate('git status'),
              ),
              _CommandTemplate(
                label: 'ls -la',
                onTap: () => _useTemplate('ls -la'),
              ),
            ],
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _controller,
            autofocus: true,
            minLines: 3,
            maxLines: 6,
            textInputAction: TextInputAction.newline,
            style: const TextStyle(fontFamily: 'monospace'),
            decoration: InputDecoration(
              hintText: 'Type a shell command or agent prompt',
              filled: true,
              fillColor: AppColors.field(context),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: AppColors.line(context)),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: _submit,
                  icon: const Icon(Icons.keyboard_return),
                  label: const Text('Send'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CommandTemplate extends StatelessWidget {
  const _CommandTemplate({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      label: Text(label),
      avatar: const Icon(Icons.north_east, size: 14),
      onPressed: onTap,
      backgroundColor: AppColors.raised(context),
      side: BorderSide(color: AppColors.line(context)),
    );
  }
}
