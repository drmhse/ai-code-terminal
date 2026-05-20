part of '../codex_session_panel.dart';

class _CodexEventTile extends StatelessWidget {
  const _CodexEventTile({
    required this.event,
    required this.expanded,
    required this.onToggle,
    this.onExtensionUiResponse,
  });

  final CodexSessionEvent event;
  final bool expanded;
  final VoidCallback? onToggle;
  final CodexExtensionUiCallback? onExtensionUiResponse;

  @override
  Widget build(BuildContext context) {
    final text = _eventBody(event);
    final isUser = event.role == 'user';
    final isAssistantMessage = event.kind == 'message' && event.role != 'user';
    final isDiagnostic = _eventDiagnostic(event);
    final isTool = _eventTool(event);
    final extensionMethod = _extensionUiMethod(event);
    final extensionOptions = _extensionUiOptions(event);
    final color = isUser
        ? AppColors.accent(context).withValues(alpha: 0.16)
        : isDiagnostic
        ? AppColors.warning(context).withValues(alpha: 0.12)
        : isTool
        ? AppColors.field(context)
        : AppColors.raised(context);
    final maxWidth = isAssistantMessage ? 680.0 : 560.0;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isDiagnostic
                  ? AppColors.warning(context).withValues(alpha: 0.34)
                  : AppColors.line(context),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                InkWell(
                  onTap: onToggle,
                  child: Row(
                    children: [
                      Icon(
                        _eventIcon(event),
                        size: 15,
                        color: isDiagnostic
                            ? AppColors.warning(context)
                            : AppColors.accent(context),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          _eventTitle(event),
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: AppColors.secondaryText(context),
                            fontWeight: FontWeight.w800,
                            fontSize: 11,
                          ),
                        ),
                      ),
                      if (text != null && text.trim().isNotEmpty && expanded)
                        IconButton(
                          tooltip: 'Copy',
                          visualDensity: VisualDensity.compact,
                          padding: EdgeInsets.zero,
                          constraints: BoxConstraints.tightFor(
                            width: 26,
                            height: 26,
                          ),
                          onPressed: () =>
                              Clipboard.setData(ClipboardData(text: text)),
                          icon: const Icon(Icons.copy, size: 14),
                        ),
                      if (onToggle != null)
                        Icon(
                          expanded ? Icons.expand_less : Icons.expand_more,
                          size: 18,
                          color: AppColors.mutedText(context),
                        ),
                      const SizedBox(width: 6),
                      Text(
                        _timeLabel(event.timestamp),
                        style: TextStyle(
                          color: AppColors.mutedText(context),
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                ),
                if (text != null && text.trim().isNotEmpty) ...[
                  const SizedBox(height: 6),
                  if (expanded || !_eventFoldable(event))
                    isTool || isDiagnostic
                        ? _CodexHighlightedCode(data: text)
                        : _CodexMarkdown(data: text)
                  else
                    Text(
                      _previewLine(text),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.secondaryText(context),
                        fontSize: 12,
                        height: 1.32,
                        fontFamily: isTool ? 'monospace' : null,
                      ),
                    ),
                ],
                if (_extensionUiRequestId(event) != null &&
                    onExtensionUiResponse != null) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      if (extensionMethod == 'confirm') ...[
                        FilledButton.tonal(
                          onPressed: () =>
                              onExtensionUiResponse!(event, 'confirm'),
                          child: const Text('Allow'),
                        ),
                        TextButton(
                          onPressed: () =>
                              onExtensionUiResponse!(event, 'deny'),
                          child: const Text('Deny'),
                        ),
                      ] else if (extensionMethod == 'select' &&
                          extensionOptions.isNotEmpty) ...[
                        for (final option in extensionOptions)
                          FilledButton.tonal(
                            onPressed: () => onExtensionUiResponse!(
                              event,
                              'select:${option.value}',
                            ),
                            child: Text(option.label),
                          ),
                      ] else
                        FilledButton.tonal(
                          onPressed: () =>
                              onExtensionUiResponse!(event, 'value'),
                          child: const Text('Respond'),
                        ),
                      TextButton(
                        onPressed: () =>
                            onExtensionUiResponse!(event, 'cancel'),
                        child: const Text('Cancel'),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
