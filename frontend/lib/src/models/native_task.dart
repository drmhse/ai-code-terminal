class RunnerReadiness {
  const RunnerReadiness({
    required this.runnerMode,
    required this.codexLoginStatus,
    required this.codexVersion,
    this.piStatus = 'unknown',
    this.piVersion = 'unknown',
    this.piSessionDir = '',
    required this.workspaceRoot,
    required this.artifactRoot,
    required this.runtimeRoot,
    required this.codexHome,
    required this.availableDiskGb,
    required this.minFreeDiskGb,
    required this.githubProviderStatus,
    required this.ready,
    required this.blockedReasons,
  });

  factory RunnerReadiness.fromJson(Map<String, dynamic> json) {
    return RunnerReadiness(
      runnerMode: json['runner_mode']?.toString() ?? 'local_single_user',
      codexLoginStatus: json['codex_login_status']?.toString() ?? 'unknown',
      codexVersion: json['codex_version']?.toString() ?? 'unknown',
      piStatus: json['pi_status']?.toString() ?? 'unknown',
      piVersion: json['pi_version']?.toString() ?? 'unknown',
      piSessionDir: json['pi_session_dir']?.toString() ?? '',
      workspaceRoot: json['workspace_root']?.toString() ?? '',
      artifactRoot: json['artifact_root']?.toString() ?? '',
      runtimeRoot: json['runtime_root']?.toString() ?? '',
      codexHome: json['codex_home']?.toString() ?? '',
      availableDiskGb:
          int.tryParse(json['available_disk_gb']?.toString() ?? '') ?? 0,
      minFreeDiskGb:
          int.tryParse(json['min_free_disk_gb']?.toString() ?? '') ?? 0,
      githubProviderStatus: json['github_provider_status']?.toString() ?? '',
      ready: json['ready'] == true,
      blockedReasons: _stringList(json['blocked_reasons']),
    );
  }

  final String runnerMode;
  final String codexLoginStatus;
  final String codexVersion;
  final String piStatus;
  final String piVersion;
  final String piSessionDir;
  final String workspaceRoot;
  final String artifactRoot;
  final String runtimeRoot;
  final String codexHome;
  final int availableDiskGb;
  final int minFreeDiskGb;
  final String githubProviderStatus;
  final bool ready;
  final List<String> blockedReasons;
}

class NativeTask {
  const NativeTask({
    required this.id,
    required this.title,
    required this.description,
    required this.executionMode,
    required this.approvalMode,
    required this.evidencePreference,
    required this.status,
    required this.workspaces,
    required this.attachments,
    required this.runs,
    this.agentProvider = 'codex',
    this.providerModel,
    this.providerThinkingLevel,
    this.sourceCollections = const [],
    this.finalReportInstructions,
  });

  factory NativeTask.fromJson(Map<String, dynamic> json) {
    return NativeTask(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Untitled task',
      description: json['description']?.toString() ?? '',
      finalReportInstructions: json['final_report_instructions']?.toString(),
      executionMode: json['execution_mode']?.toString() ?? 'implement',
      approvalMode: json['approval_mode']?.toString() ?? 'ask_before_edits',
      evidencePreference:
          json['evidence_preference']?.toString() ?? 'tests_only',
      status: json['status']?.toString() ?? 'ready',
      agentProvider: json['agent_provider']?.toString() ?? 'codex',
      providerModel: json['provider_model']?.toString(),
      providerThinkingLevel: json['provider_thinking_level']?.toString(),
      sourceCollections: _mapList(
        json['source_collections'],
        NativeTaskSourceCollection.fromJson,
      ),
      workspaces: _mapList(json['workspaces'], NativeTaskWorkspace.fromJson),
      attachments: _mapList(json['attachments'], NativeTaskAttachment.fromJson),
      runs: _mapList(json['runs'], NativeTaskRun.fromJson),
    );
  }

  final String id;
  final String title;
  final String description;
  final String? finalReportInstructions;
  final String executionMode;
  final String approvalMode;
  final String evidencePreference;
  final String status;
  final String agentProvider;
  final String? providerModel;
  final String? providerThinkingLevel;
  final List<NativeTaskSourceCollection> sourceCollections;
  final List<NativeTaskWorkspace> workspaces;
  final List<NativeTaskAttachment> attachments;
  final List<NativeTaskRun> runs;

  NativeTaskRun? get latestRun => runs.isEmpty ? null : runs.first;
}

class NativeTaskSourceCollection {
  const NativeTaskSourceCollection({
    required this.collectionId,
    required this.name,
    required this.workspaceIds,
    this.defaultWorkspaceId,
  });

  factory NativeTaskSourceCollection.fromJson(Map<String, dynamic> json) {
    return NativeTaskSourceCollection(
      collectionId: json['collection_id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Collection',
      defaultWorkspaceId: json['default_workspace_id']?.toString(),
      workspaceIds: _stringList(json['workspace_ids']),
    );
  }

  final String collectionId;
  final String name;
  final String? defaultWorkspaceId;
  final List<String> workspaceIds;
}

class NativeTaskWorkspace {
  const NativeTaskWorkspace({
    required this.workspaceId,
    required this.name,
    required this.path,
    required this.workingStrategy,
    required this.dirtyState,
    this.remote,
  });

  factory NativeTaskWorkspace.fromJson(Map<String, dynamic> json) {
    return NativeTaskWorkspace(
      workspaceId: json['workspace_id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Workspace',
      path: json['path']?.toString() ?? '',
      remote: json['remote']?.toString(),
      workingStrategy: json['working_strategy']?.toString() ?? 'worktree',
      dirtyState: json['dirty_state']?.toString() ?? 'unknown',
    );
  }

  final String workspaceId;
  final String name;
  final String path;
  final String? remote;
  final String workingStrategy;
  final String dirtyState;
}

class NativeTaskAttachment {
  const NativeTaskAttachment({
    required this.id,
    required this.originalFilename,
    required this.contentType,
    required this.byteSize,
    required this.checksumSha256,
  });

  factory NativeTaskAttachment.fromJson(Map<String, dynamic> json) {
    return NativeTaskAttachment(
      id: json['id']?.toString() ?? '',
      originalFilename: json['original_filename']?.toString() ?? 'attachment',
      contentType: json['content_type']?.toString() ?? '',
      byteSize: int.tryParse(json['byte_size']?.toString() ?? '') ?? 0,
      checksumSha256: json['checksum_sha256']?.toString() ?? '',
    );
  }

  final String id;
  final String originalFilename;
  final String contentType;
  final int byteSize;
  final String checksumSha256;
}

class NativeTaskRun {
  const NativeTaskRun({
    required this.id,
    required this.taskId,
    required this.status,
    required this.runnerMode,
    required this.executionMode,
    required this.approvalMode,
    required this.artifactDir,
    required this.queuePosition,
    this.codexSessionId,
    this.agentProvider = 'codex',
    this.providerSessionId,
    this.providerSessionFile,
    this.providerModel,
    this.providerThinkingLevel,
    this.finalReport,
    this.artifacts = const [],
    this.pullRequests = const [],
  });

  factory NativeTaskRun.fromJson(Map<String, dynamic> json) {
    return NativeTaskRun(
      id: json['id']?.toString() ?? '',
      taskId: json['task_id']?.toString() ?? '',
      status: json['status']?.toString() ?? 'queued',
      runnerMode: json['runner_mode']?.toString() ?? 'local_single_user',
      executionMode: json['execution_mode']?.toString() ?? 'implement',
      approvalMode: json['approval_mode']?.toString() ?? 'ask_before_edits',
      artifactDir: json['artifact_dir']?.toString() ?? '',
      queuePosition:
          int.tryParse(json['queue_position']?.toString() ?? '') ?? 0,
      codexSessionId: json['codex_session_id']?.toString(),
      agentProvider: json['agent_provider']?.toString() ?? 'codex',
      providerSessionId: json['provider_session_id']?.toString(),
      providerSessionFile: json['provider_session_file']?.toString(),
      providerModel: json['provider_model']?.toString(),
      providerThinkingLevel: json['provider_thinking_level']?.toString(),
      finalReport: json['final_report']?.toString(),
      artifacts: _mapList(json['artifacts'], NativeTaskArtifact.fromJson),
      pullRequests: _mapList(
        json['pull_requests'],
        NativeTaskPullRequest.fromJson,
      ),
    );
  }

  final String id;
  final String taskId;
  final String status;
  final String runnerMode;
  final String executionMode;
  final String approvalMode;
  final String artifactDir;
  final int queuePosition;
  final String? codexSessionId;
  final String agentProvider;
  final String? providerSessionId;
  final String? providerSessionFile;
  final String? providerModel;
  final String? providerThinkingLevel;
  final String? finalReport;
  final List<NativeTaskArtifact> artifacts;
  final List<NativeTaskPullRequest> pullRequests;
}

class NativeTaskArtifact {
  const NativeTaskArtifact({
    required this.id,
    required this.runId,
    required this.artifactType,
    required this.name,
    required this.byteSize,
    required this.previewKind,
    this.contentType,
    this.workspaceId,
    this.sourcePath,
    this.previewCapabilities = const NativeTaskPreviewCapabilities(),
  });

  factory NativeTaskArtifact.fromJson(Map<String, dynamic> json) {
    return NativeTaskArtifact(
      id: json['id']?.toString() ?? '',
      runId: json['run_id']?.toString() ?? '',
      artifactType: json['artifact_type']?.toString() ?? 'artifact',
      name: json['name']?.toString() ?? 'artifact',
      contentType: json['content_type']?.toString(),
      byteSize: int.tryParse(json['byte_size']?.toString() ?? '') ?? 0,
      workspaceId: json['workspace_id']?.toString(),
      sourcePath: json['source_path']?.toString(),
      previewKind: json['preview_kind']?.toString() ?? 'binary',
      previewCapabilities: NativeTaskPreviewCapabilities.fromJson(
        json['preview_capabilities'],
      ),
    );
  }

  final String id;
  final String runId;
  final String artifactType;
  final String name;
  final String? contentType;
  final int byteSize;
  final String? workspaceId;
  final String? sourcePath;
  final String previewKind;
  final NativeTaskPreviewCapabilities previewCapabilities;
}

class NativeTaskPreviewCapabilities {
  const NativeTaskPreviewCapabilities({
    this.text = false,
    this.markdown = false,
    this.image = false,
    this.pdf = false,
    this.video = false,
    this.raw = true,
    this.download = true,
  });

  factory NativeTaskPreviewCapabilities.fromJson(Object? json) {
    if (json is! Map<String, dynamic>) {
      return const NativeTaskPreviewCapabilities();
    }
    return NativeTaskPreviewCapabilities(
      text: json['text'] == true,
      markdown: json['markdown'] == true,
      image: json['image'] == true,
      pdf: json['pdf'] == true,
      video: json['video'] == true,
      raw: json['raw'] != false,
      download: json['download'] != false,
    );
  }

  final bool text;
  final bool markdown;
  final bool image;
  final bool pdf;
  final bool video;
  final bool raw;
  final bool download;
}

class NativeTaskArtifactContent {
  const NativeTaskArtifactContent({
    required this.artifact,
    this.text,
    this.base64,
    this.rawUrl,
    this.authHeaders = const {},
  });

  factory NativeTaskArtifactContent.fromJson(Map<String, dynamic> json) {
    final artifact = json['artifact'];
    if (artifact is! Map<String, dynamic>) {
      throw const FormatException('Artifact response has no artifact');
    }
    return NativeTaskArtifactContent(
      artifact: NativeTaskArtifact.fromJson(artifact),
      text: json['text']?.toString(),
      base64: json['base64']?.toString(),
    );
  }

  final NativeTaskArtifact artifact;
  final String? text;
  final String? base64;
  final Uri? rawUrl;
  final Map<String, String> authHeaders;

  NativeTaskArtifactContent withRawAccess({
    required Uri rawUrl,
    required Map<String, String> authHeaders,
  }) {
    return NativeTaskArtifactContent(
      artifact: artifact,
      text: text,
      base64: base64,
      rawUrl: rawUrl,
      authHeaders: authHeaders,
    );
  }
}

class NativeTaskPullRequest {
  const NativeTaskPullRequest({
    required this.id,
    required this.repository,
    required this.state,
    required this.url,
    this.action = '',
    this.workspaceId,
    this.branch,
    this.title,
    this.error,
  });

  factory NativeTaskPullRequest.fromJson(Map<String, dynamic> json) {
    return NativeTaskPullRequest(
      id: json['id']?.toString() ?? '',
      repository: json['repository']?.toString() ?? '',
      state: json['state']?.toString() ?? '',
      url: json['url']?.toString() ?? '',
      action: json['action']?.toString() ?? json['state']?.toString() ?? '',
      workspaceId: json['workspace_id']?.toString(),
      branch: json['branch']?.toString(),
      title: json['title']?.toString(),
      error: json['error']?.toString(),
    );
  }

  final String id;
  final String repository;
  final String state;
  final String url;
  final String action;
  final String? workspaceId;
  final String? branch;
  final String? title;
  final String? error;
}

class NativeTaskEvent {
  const NativeTaskEvent({
    required this.index,
    required this.type,
    this.title,
    this.text,
    this.status,
  });

  factory NativeTaskEvent.fromJson(Map<String, dynamic> json) {
    return NativeTaskEvent(
      index: int.tryParse(json['index']?.toString() ?? '') ?? 0,
      type: json['type']?.toString() ?? 'event',
      title: json['title']?.toString(),
      text: json['text']?.toString(),
      status: json['status']?.toString(),
    );
  }

  final int index;
  final String type;
  final String? title;
  final String? text;
  final String? status;
}

List<String> _stringList(Object? value) {
  if (value is List) {
    return value.map((item) => item.toString()).toList(growable: false);
  }
  return const [];
}

List<T> _mapList<T>(Object? value, T Function(Map<String, dynamic>) parse) {
  if (value is! List) {
    return const [];
  }
  return value
      .whereType<Map<String, dynamic>>()
      .map(parse)
      .toList(growable: false);
}
