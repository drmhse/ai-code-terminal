part of '../codex_session_panel.dart';

String _eventTitle(CodexSessionEvent event) {
  if (_eventRunnerEnvelope(event)) {
    return 'Task brief';
  }
  if (event.kind == 'message' && event.role == 'user') {
    return event.status == null ? 'user' : 'user - ${event.status}';
  }
  if (event.kind == 'tool_call') {
    return event.title ?? 'Tool call';
  }
  if (event.kind == 'tool_output') {
    return event.status == null
        ? 'Tool output'
        : 'Tool output - ${event.status}';
  }
  return event.title ?? event.role ?? event.kind;
}

String? _eventBody(CodexSessionEvent event) {
  return event.text ?? event.output ?? event.command ?? event.status;
}

bool _eventTool(CodexSessionEvent event) {
  return event.kind.startsWith('tool');
}

bool _eventDiagnostic(CodexSessionEvent event) {
  return event.kind == 'diagnostic' || event.kind == 'error';
}

String? _extensionUiMethod(CodexSessionEvent event) {
  final command = event.command;
  if (command == null || !command.startsWith('extension_ui:')) {
    return null;
  }
  final parts = command.split(':');
  return parts.length >= 2 ? parts[1] : null;
}

String? _extensionUiRequestId(CodexSessionEvent event) {
  final command = event.command;
  if (command == null || !command.startsWith('extension_ui:')) {
    return null;
  }
  final parts = command.split(':');
  return parts.length >= 3 && parts[2].isNotEmpty ? parts[2] : null;
}

List<_ExtensionUiOption> _extensionUiOptions(CodexSessionEvent event) {
  final raw = event.output;
  if (raw == null || raw.trim().isEmpty) {
    return const [];
  }
  try {
    final decoded = jsonDecode(raw);
    if (decoded is! Map<String, dynamic>) {
      return const [];
    }
    final options = decoded['options'];
    if (options is! List) {
      return const [];
    }
    return [
      for (final option in options)
        if (_extensionUiOption(option) != null) _extensionUiOption(option)!,
    ];
  } catch (_) {
    return const [];
  }
}

_ExtensionUiOption? _extensionUiOption(Object? option) {
  if (option is String) {
    return _ExtensionUiOption(label: option, value: option);
  }
  if (option is Map<String, dynamic>) {
    final value = (option['value'] ?? option['id'] ?? option['label'])
        ?.toString()
        .trim();
    if (value == null || value.isEmpty) {
      return null;
    }
    final label = (option['label'] ?? option['title'] ?? value).toString();
    return _ExtensionUiOption(label: label, value: value);
  }
  return null;
}

class _ExtensionUiOption {
  const _ExtensionUiOption({required this.label, required this.value});

  final String label;
  final String value;
}

bool _eventVisible(CodexSessionEvent event) {
  final role = event.role?.toLowerCase();
  if (event.kind == 'reasoning' &&
      (_eventBody(event)?.trim().isEmpty ?? true)) {
    return false;
  }
  if (role == 'developer' ||
      role == 'system' ||
      event.kind == 'status' ||
      event.kind == 'turn' ||
      _eventQueuedUserMessage(event)) {
    return false;
  }
  return !_looksInternalCodexText(event.title) &&
      !_looksInternalCodexText(_eventBody(event));
}

List<CodexSessionEvent> _visibleCodexEvents(List<CodexSessionEvent> events) {
  return events.where(_eventVisible).toList(growable: false);
}

bool _eventQueuedUserMessage(CodexSessionEvent event) {
  return event.kind == 'message' &&
      event.role?.toLowerCase() == 'user' &&
      event.status?.toLowerCase() == 'queued';
}

bool _looksInternalCodexText(String? value) {
  final text = value?.trimLeft();
  if (text == null || text.isEmpty) {
    return false;
  }
  return text.startsWith('<environment_context') ||
      text.startsWith('<permissions') ||
      text.startsWith('<skills_instructions') ||
      text.startsWith('<turn_aborted') ||
      text.startsWith('# AGENTS.md instructions');
}

bool _eventFoldable(CodexSessionEvent event) {
  return _eventTool(event) ||
      _eventDiagnostic(event) ||
      event.kind == 'reasoning' ||
      _eventRunnerEnvelope(event);
}

bool _eventAutoExpanded(CodexSessionEvent event) {
  final status = event.status?.toLowerCase() ?? '';
  final failed = status.contains('failed') || status.contains('error');
  if (_eventTool(event)) {
    return failed;
  }
  return _eventDiagnostic(event) ||
      failed ||
      status.contains('running') ||
      status.contains('in_progress');
}

bool _toolGroupAutoExpanded(List<CodexSessionEvent> events) {
  return false;
}

bool _toolEventNeedsAttention(CodexSessionEvent event) {
  final status = event.status?.toLowerCase() ?? '';
  return _eventTool(event) &&
      (status.contains('failed') || status.contains('error'));
}

String _toolGroupSummary(List<CodexSessionEvent> events) {
  final calls = events
      .where(
        (event) => event.kind == 'tool_call' || event.kind == 'tool_status',
      )
      .map(_eventTitle)
      .where((title) => title.trim().isNotEmpty)
      .toList(growable: false);
  final count = events.length == 1 ? '1 event' : '${events.length} events';
  if (calls.isEmpty) {
    return count;
  }
  final preview = calls.take(3).join(' -> ');
  final suffix = calls.length > 3 ? ' -> ...' : '';
  return '$count / $preview$suffix';
}

String _groupTimeLabel(CodexSessionEvent first, CodexSessionEvent last) {
  final start = _timeLabel(first.timestamp);
  final end = _timeLabel(last.timestamp);
  if (start.isEmpty || start == end) {
    return start;
  }
  return '$start-$end';
}

bool _eventRunnerEnvelope(CodexSessionEvent event) {
  if (event.kind != 'message' || event.role?.toLowerCase() != 'user') {
    return false;
  }
  final text = _eventBody(event)?.trimLeft() ?? '';
  return text.startsWith('ACT RUNNER POLICY:') ||
      text.contains('\n\nACT RUNNER POLICY:');
}

String _previewLine(String text) {
  final trimmed = text.trim();
  if (trimmed.isEmpty) {
    return '';
  }
  return trimmed
      .split('\n')
      .firstWhere((line) => line.trim().isNotEmpty, orElse: () => trimmed)
      .trimRight();
}

String _formatJsonForDisplay(String text) {
  final trimmed = text.trim();
  if (trimmed.isEmpty ||
      !(trimmed.startsWith('{') || trimmed.startsWith('['))) {
    return text;
  }
  try {
    return const JsonEncoder.withIndent('  ').convert(jsonDecode(trimmed));
  } catch (_) {
    return text;
  }
}

bool _textLooksJson(String text) {
  final trimmed = text.trimLeft();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

bool _sessionBusy(CodexSessionSummary session) {
  return session.isBusy ||
      session.status == 'running' ||
      session.status == 'starting' ||
      session.status == 'interrupting';
}

String _sessionStatusLabel(CodexSessionSummary session) {
  final base = session.status;
  final queued = session.queuedMessageCount;
  if (queued <= 0) {
    return base;
  }
  final label = queued == 1 ? '1 queued' : '$queued queued';
  return '$base - $label';
}

Color _sessionStatusColor(BuildContext context, CodexSessionSummary session) {
  return switch (session.status) {
    'running' || 'starting' || 'active' => AppColors.success(context),
    'queued' || 'interrupting' => AppColors.accent(context),
    'failed' || 'interrupted' => AppColors.warning(context),
    _ => AppColors.mutedText(context),
  };
}

String? _sessionWorkspaceTagsLabel(CodexSessionSummary session) {
  final names = <String>[];
  for (final tag in session.collectionTags) {
    final name = tag.name.trim();
    if (name.isNotEmpty && !names.contains(name)) {
      names.add(name);
    }
  }
  for (final tag in session.workspaceTags) {
    final name = tag.name.trim();
    if (name.isNotEmpty && !names.contains(name)) {
      names.add(name);
    }
  }
  if (names.isEmpty) {
    return null;
  }
  return names.join(', ');
}

String _shortPath(String path) {
  final parts = path.split('/').where((part) => part.isNotEmpty).toList();
  if (parts.length <= 2) {
    return path;
  }
  return '${parts[parts.length - 2]}/${parts.last}';
}

Workspace? _workspaceForId(List<Workspace> workspaces, String? workspaceId) {
  if (workspaceId == null || workspaceId.isEmpty) {
    return null;
  }
  return workspaces.cast<Workspace?>().firstWhere(
    (workspace) => workspace?.id == workspaceId,
    orElse: () => null,
  );
}

WorkspaceCollection? _collectionForId(
  List<WorkspaceCollection> collections,
  String? collectionId,
) {
  if (collectionId == null || collectionId.isEmpty) {
    return null;
  }
  return collections.cast<WorkspaceCollection?>().firstWhere(
    (collection) => collection?.id == collectionId,
    orElse: () => null,
  );
}

String _timeLabel(DateTime? timestamp) {
  if (timestamp == null) {
    return '';
  }
  final local = timestamp.toLocal();
  return '${local.hour.toString().padLeft(2, '0')}:'
      '${local.minute.toString().padLeft(2, '0')}';
}
