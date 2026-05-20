part of '../codex_session_panel.dart';

class _CodexEventStream extends StatelessWidget {
  const _CodexEventStream({
    required this.controller,
    required this.entries,
    required this.expandedIndexes,
    required this.onToggle,
    required this.showNewMessages,
    required this.onShowLatest,
    required this.isBusy,
    required this.progressEvents,
    this.onExtensionUiResponse,
  });

  final ScrollController controller;
  final List<_CodexStreamEntry> entries;
  final Set<int> expandedIndexes;
  final ValueChanged<int> onToggle;
  final bool showNewMessages;
  final VoidCallback onShowLatest;
  final bool isBusy;
  final List<CodexSessionEvent> progressEvents;
  final CodexExtensionUiCallback? onExtensionUiResponse;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ListView.separated(
          controller: controller,
          padding: const EdgeInsets.all(10),
          addAutomaticKeepAlives: false,
          addRepaintBoundaries: true,
          addSemanticIndexes: false,
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          itemCount: entries.length + (isBusy ? 1 : 0),
          separatorBuilder: (_, _) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            if (isBusy && index == entries.length) {
              return RepaintBoundary(
                child: _AgentProgressTile(events: progressEvents),
              );
            }
            final entry = entries[index];
            final child = entry.toolEvents != null
                ? _toolGroupTile(entry)
                : _eventTile(entry);
            return KeyedSubtree(
              key: ValueKey('codex-stream-entry-${entry.key}'),
              child: child,
            );
          },
        ),
        if (showNewMessages)
          Positioned(
            right: 12,
            bottom: 12,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.accent(context),
                foregroundColor: Colors.black,
                visualDensity: VisualDensity.compact,
              ),
              onPressed: onShowLatest,
              icon: const Icon(Icons.arrow_downward, size: 14),
              label: const Text('New messages'),
            ),
          ),
      ],
    );
  }

  Widget _toolGroupTile(_CodexStreamEntry entry) {
    final group = entry.toolEvents!;
    return _CodexToolGroupTile(
      events: group,
      expanded:
          _toolGroupAutoExpanded(group) || expandedIndexes.contains(entry.key),
      expandedIndexes: expandedIndexes,
      onToggleGroup: () => onToggle(entry.key),
      onToggleEvent: onToggle,
    );
  }

  Widget _eventTile(_CodexStreamEntry entry) {
    final event = entry.event!;
    return _CodexEventTile(
      event: event,
      expanded:
          _eventAutoExpanded(event) || expandedIndexes.contains(event.index),
      onToggle: _eventFoldable(event) ? () => onToggle(event.index) : null,
      onExtensionUiResponse: onExtensionUiResponse,
    );
  }
}

class _CodexStreamEntry {
  const _CodexStreamEntry._({required this.key, this.event, this.toolEvents});

  factory _CodexStreamEntry.event(CodexSessionEvent event) {
    return _CodexStreamEntry._(key: event.index, event: event);
  }

  factory _CodexStreamEntry.toolGroup(List<CodexSessionEvent> events) {
    return _CodexStreamEntry._(
      key: -1000000 - events.first.index,
      toolEvents: List.unmodifiable(events),
    );
  }

  final int key;
  final CodexSessionEvent? event;
  final List<CodexSessionEvent>? toolEvents;
}

List<_CodexStreamEntry> _groupCodexStream(List<CodexSessionEvent> events) {
  final entries = <_CodexStreamEntry>[];
  final toolBuffer = <CodexSessionEvent>[];

  void flushTools() {
    if (toolBuffer.isEmpty) {
      return;
    }
    entries.add(_CodexStreamEntry.toolGroup(toolBuffer));
    toolBuffer.clear();
  }

  for (final event in events) {
    if (_eventTool(event)) {
      toolBuffer.add(event);
    } else {
      flushTools();
      entries.add(_CodexStreamEntry.event(event));
    }
  }
  flushTools();
  return entries;
}

class _CodexToolGroupTile extends StatelessWidget {
  const _CodexToolGroupTile({
    required this.events,
    required this.expanded,
    required this.expandedIndexes,
    required this.onToggleGroup,
    required this.onToggleEvent,
  });

  final List<CodexSessionEvent> events;
  final bool expanded;
  final Set<int> expandedIndexes;
  final VoidCallback onToggleGroup;
  final ValueChanged<int> onToggleEvent;

  @override
  Widget build(BuildContext context) {
    final first = events.first;
    final last = events.last;
    final failures = events.where(_toolEventNeedsAttention).length;
    final title = failures > 0
        ? 'Tool Calls - $failures need attention'
        : 'Tool Calls';
    return Align(
      alignment: Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 680),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: AppColors.field(context),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.line(context)),
          ),
          child: Column(
            children: [
              InkWell(
                onTap: onToggleGroup,
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Row(
                    children: [
                      Icon(
                        Icons.terminal,
                        size: 15,
                        color: AppColors.accent(context),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: AppColors.secondaryText(context),
                                fontWeight: FontWeight.w800,
                                fontSize: 11,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              _toolGroupSummary(events),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: AppColors.mutedText(context),
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        expanded ? Icons.expand_less : Icons.expand_more,
                        size: 18,
                        color: AppColors.mutedText(context),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        _groupTimeLabel(first, last),
                        style: TextStyle(
                          color: AppColors.mutedText(context),
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (expanded)
                for (final event in events)
                  _CodexToolCallRow(
                    event: event,
                    expanded:
                        _eventAutoExpanded(event) ||
                        expandedIndexes.contains(event.index),
                    onToggle: _eventFoldable(event)
                        ? () => onToggleEvent(event.index)
                        : null,
                  ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CodexToolCallRow extends StatelessWidget {
  const _CodexToolCallRow({
    required this.event,
    required this.expanded,
    required this.onToggle,
  });

  final CodexSessionEvent event;
  final bool expanded;
  final VoidCallback? onToggle;

  @override
  Widget build(BuildContext context) {
    final text = _eventBody(event);
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.line(context))),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InkWell(
              onTap: onToggle,
              child: Row(
                children: [
                  Icon(
                    _eventIcon(event),
                    size: 14,
                    color: AppColors.accent(context),
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
                      size: 17,
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
              const SizedBox(height: 5),
              if (expanded)
                _CodexHighlightedCode(data: text)
              else
                Text(
                  _previewLine(text),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.secondaryText(context),
                    fontSize: 12,
                    height: 1.32,
                    fontFamily: 'monospace',
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
