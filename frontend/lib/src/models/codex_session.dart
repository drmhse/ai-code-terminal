import 'package:act_frontend/src/models/terminal_session.dart';

class CodexSessionSummary {
  const CodexSessionSummary({
    required this.id,
    required this.title,
    required this.rolloutPath,
    required this.updatedAt,
    required this.status,
    this.cwd,
    this.source,
    this.model,
    this.agentProvider = 'codex',
    this.runtimeSessionId,
    this.providerSessionId,
    this.providerSessionFile,
    this.providerModel,
    this.providerThinkingLevel,
    this.terminalSessionId,
    this.isBusy = false,
    this.queuedMessageCount = 0,
    this.workspaceTags = const [],
    this.collectionTags = const [],
    this.scopeType = 'workspace',
    this.scopeId,
    this.usage,
  });

  factory CodexSessionSummary.fromJson(Map<String, dynamic> json) {
    return CodexSessionSummary(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Untitled Codex session',
      cwd: json['cwd']?.toString(),
      rolloutPath: json['rollout_path']?.toString() ?? '',
      source: json['source']?.toString(),
      model: json['model']?.toString(),
      agentProvider: json['agent_provider']?.toString() ?? 'codex',
      runtimeSessionId: json['runtime_session_id']?.toString(),
      providerSessionId: json['provider_session_id']?.toString(),
      providerSessionFile: json['provider_session_file']?.toString(),
      providerModel: json['provider_model']?.toString(),
      providerThinkingLevel: json['provider_thinking_level']?.toString(),
      updatedAt: DateTime.tryParse(json['updated_at']?.toString() ?? ''),
      status: json['status']?.toString() ?? 'idle',
      terminalSessionId: json['terminal_session_id']?.toString(),
      isBusy: json['is_busy'] == true,
      queuedMessageCount: json['queued_message_count'] is num
          ? (json['queued_message_count'] as num).toInt()
          : 0,
      workspaceTags: _mapList(
        json['workspace_tags'],
        CodexWorkspaceTag.fromJson,
      ),
      collectionTags: _mapList(
        json['collection_tags'],
        CodexCollectionTag.fromJson,
      ),
      scopeType: json['scope_type']?.toString() ?? 'workspace',
      scopeId: json['scope_id']?.toString(),
      usage: json['usage'] is Map<String, dynamic>
          ? CodexSessionUsage.fromJson(json['usage'] as Map<String, dynamic>)
          : null,
    );
  }

  final String id;
  final String title;
  final String? cwd;
  final String rolloutPath;
  final String? source;
  final String? model;
  final String agentProvider;
  final String? runtimeSessionId;
  final String? providerSessionId;
  final String? providerSessionFile;
  final String? providerModel;
  final String? providerThinkingLevel;
  final DateTime? updatedAt;
  final String status;
  final String? terminalSessionId;
  final bool isBusy;
  final int queuedMessageCount;
  final List<CodexWorkspaceTag> workspaceTags;
  final List<CodexCollectionTag> collectionTags;
  final String scopeType;
  final String? scopeId;
  final CodexSessionUsage? usage;
}

class CodexSessionUsage {
  const CodexSessionUsage({
    required this.total,
    this.last,
    this.modelContextWindow,
    this.costUsd,
    this.primaryRateLimitUsedPercent,
    this.secondaryRateLimitUsedPercent,
  });

  factory CodexSessionUsage.fromJson(Map<String, dynamic> json) {
    return CodexSessionUsage(
      total: json['total'] is Map<String, dynamic>
          ? CodexTokenUsage.fromJson(json['total'] as Map<String, dynamic>)
          : const CodexTokenUsage(),
      last: json['last'] is Map<String, dynamic>
          ? CodexTokenUsage.fromJson(json['last'] as Map<String, dynamic>)
          : null,
      modelContextWindow: _readInt(json['model_context_window']),
      costUsd: _readDouble(json['cost_usd']),
      primaryRateLimitUsedPercent: _readDouble(
        json['primary_rate_limit_used_percent'],
      ),
      secondaryRateLimitUsedPercent: _readDouble(
        json['secondary_rate_limit_used_percent'],
      ),
    );
  }

  final CodexTokenUsage total;
  final CodexTokenUsage? last;
  final int? modelContextWindow;
  final double? costUsd;
  final double? primaryRateLimitUsedPercent;
  final double? secondaryRateLimitUsedPercent;
}

class CodexTokenUsage {
  const CodexTokenUsage({
    this.inputTokens = 0,
    this.cachedInputTokens = 0,
    this.cacheWriteTokens = 0,
    this.outputTokens = 0,
    this.reasoningOutputTokens = 0,
    this.totalTokens = 0,
  });

  factory CodexTokenUsage.fromJson(Map<String, dynamic> json) {
    return CodexTokenUsage(
      inputTokens: _readInt(json['input_tokens']) ?? 0,
      cachedInputTokens: _readInt(json['cached_input_tokens']) ?? 0,
      cacheWriteTokens: _readInt(json['cache_write_tokens']) ?? 0,
      outputTokens: _readInt(json['output_tokens']) ?? 0,
      reasoningOutputTokens: _readInt(json['reasoning_output_tokens']) ?? 0,
      totalTokens: _readInt(json['total_tokens']) ?? 0,
    );
  }

  final int inputTokens;
  final int cachedInputTokens;
  final int cacheWriteTokens;
  final int outputTokens;
  final int reasoningOutputTokens;
  final int totalTokens;
}

class CodexWorkspaceTag {
  const CodexWorkspaceTag({
    required this.workspaceId,
    required this.name,
    this.repository,
  });

  factory CodexWorkspaceTag.fromJson(Map<String, dynamic> json) {
    return CodexWorkspaceTag(
      workspaceId: json['workspace_id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      repository: json['repository']?.toString(),
    );
  }

  final String workspaceId;
  final String name;
  final String? repository;
}

class CodexSessionChanges {
  const CodexSessionChanges({
    required this.sessionId,
    required this.workspacePath,
    required this.gitRoot,
    required this.summary,
    required this.files,
    required this.diffStat,
    required this.diff,
    required this.truncated,
    this.branch,
  });

  factory CodexSessionChanges.fromJson(Map<String, dynamic> json) {
    return CodexSessionChanges(
      sessionId: json['session_id']?.toString() ?? '',
      workspacePath: json['workspace_path']?.toString() ?? '',
      gitRoot: json['git_root']?.toString() ?? '',
      branch: json['branch']?.toString(),
      summary: json['summary'] is Map<String, dynamic>
          ? CodexChangeSummary.fromJson(json['summary'] as Map<String, dynamic>)
          : const CodexChangeSummary(),
      files: _mapList(json['files'], CodexChangedFile.fromJson),
      diffStat: json['diff_stat']?.toString() ?? '',
      diff: json['diff']?.toString() ?? '',
      truncated: json['truncated'] == true,
    );
  }

  final String sessionId;
  final String workspacePath;
  final String gitRoot;
  final String? branch;
  final CodexChangeSummary summary;
  final List<CodexChangedFile> files;
  final String diffStat;
  final String diff;
  final bool truncated;
}

class CodexChangeSummary {
  const CodexChangeSummary({
    this.changedFiles = 0,
    this.stagedFiles = 0,
    this.unstagedFiles = 0,
    this.untrackedFiles = 0,
  });

  factory CodexChangeSummary.fromJson(Map<String, dynamic> json) {
    return CodexChangeSummary(
      changedFiles: json['changed_files'] is num
          ? (json['changed_files'] as num).toInt()
          : 0,
      stagedFiles: json['staged_files'] is num
          ? (json['staged_files'] as num).toInt()
          : 0,
      unstagedFiles: json['unstaged_files'] is num
          ? (json['unstaged_files'] as num).toInt()
          : 0,
      untrackedFiles: json['untracked_files'] is num
          ? (json['untracked_files'] as num).toInt()
          : 0,
    );
  }

  final int changedFiles;
  final int stagedFiles;
  final int unstagedFiles;
  final int untrackedFiles;
}

class CodexChangedFile {
  const CodexChangedFile({
    required this.path,
    required this.status,
    required this.staged,
    required this.unstaged,
    this.oldPath,
  });

  factory CodexChangedFile.fromJson(Map<String, dynamic> json) {
    return CodexChangedFile(
      path: json['path']?.toString() ?? '',
      oldPath: json['old_path']?.toString(),
      status: json['status']?.toString() ?? 'modified',
      staged: json['staged']?.toString() ?? ' ',
      unstaged: json['unstaged']?.toString() ?? ' ',
    );
  }

  final String path;
  final String? oldPath;
  final String status;
  final String staged;
  final String unstaged;
}

class CodexCollectionTag {
  const CodexCollectionTag({required this.collectionId, required this.name});

  factory CodexCollectionTag.fromJson(Map<String, dynamic> json) {
    return CodexCollectionTag(
      collectionId: json['collection_id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
    );
  }

  final String collectionId;
  final String name;
}

class CodexSessionEvent {
  const CodexSessionEvent({
    required this.index,
    required this.kind,
    this.timestamp,
    this.role,
    this.title,
    this.text,
    this.command,
    this.output,
    this.status,
    this.usage,
  });

  factory CodexSessionEvent.fromJson(Map<String, dynamic> json) {
    return CodexSessionEvent(
      index: json['index'] is num ? (json['index'] as num).toInt() : 0,
      timestamp: DateTime.tryParse(json['timestamp']?.toString() ?? ''),
      kind: json['kind']?.toString() ?? 'event',
      role: json['role']?.toString(),
      title: json['title']?.toString(),
      text: json['text']?.toString(),
      command: json['command']?.toString(),
      output: json['output']?.toString(),
      status: json['status']?.toString(),
      usage: json['usage'] is Map<String, dynamic>
          ? CodexSessionUsage.fromJson(json['usage'] as Map<String, dynamic>)
          : null,
    );
  }

  final int index;
  final DateTime? timestamp;
  final String kind;
  final String? role;
  final String? title;
  final String? text;
  final String? command;
  final String? output;
  final String? status;
  final CodexSessionUsage? usage;
}

class CodexLaunchResponse {
  const CodexLaunchResponse({required this.codexSession, this.terminalSession});

  factory CodexLaunchResponse.fromJson(Map<String, dynamic> json) {
    final terminal = json['terminal_session'];
    final codex = json['codex_session'];
    if (codex is! Map<String, dynamic>) {
      throw const FormatException('Codex launch response has no session');
    }
    return CodexLaunchResponse(
      terminalSession: terminal is Map<String, dynamic>
          ? TerminalSession.fromJson(terminal)
          : null,
      codexSession: CodexSessionSummary.fromJson(codex),
    );
  }

  final TerminalSession? terminalSession;
  final CodexSessionSummary codexSession;
}

List<T> _mapList<T>(Object? value, T Function(Map<String, dynamic>) mapper) {
  if (value is! List) {
    return const [];
  }
  return value
      .whereType<Map<String, dynamic>>()
      .map(mapper)
      .toList(growable: false);
}

int? _readInt(Object? value) {
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value?.toString() ?? '');
}

double? _readDouble(Object? value) {
  if (value is num) {
    return value.toDouble();
  }
  return double.tryParse(value?.toString() ?? '');
}
