part of '../act_api.dart';

extension ActApiTasks on ActApi {
  Future<List<NativeTask>> nativeTasks({
    String? workspaceId,
    String? scopeType,
    String? scopeId,
  }) async {
    final query = StringBuffer('/api/v1/tasks');
    var hasQuery = false;
    void append(String key, String? value) {
      final normalized = value?.trim();
      if (normalized == null || normalized.isEmpty) {
        return;
      }
      query.write(hasQuery ? '&' : '?');
      query.write('$key=${Uri.encodeQueryComponent(normalized)}');
      hasQuery = true;
    }

    append('workspace_id', workspaceId);
    append('scope_type', scopeType);
    append('scope_id', scopeId);
    final json = await _get(query.toString());
    return ApiEnvelope.list(json, NativeTask.fromJson);
  }

  Future<NativeTask> createNativeTask({
    required String title,
    required String description,
    required List<String> workspaceIds,
    List<String> collectionIds = const [],
    String finalReportInstructions = '',
    String executionMode = 'implement',
    String approvalMode = 'ask_before_edits',
    String evidencePreference = 'tests_plus_screenshots',
    String agentProvider = 'codex',
    String providerModel = '',
    String providerThinkingLevel = '',
  }) async {
    final json = await _post('/api/v1/tasks', {
      'title': title,
      'description': description,
      'workspace_ids': workspaceIds,
      'collection_ids': collectionIds,
      'final_report_instructions': finalReportInstructions,
      'execution_mode': executionMode,
      'approval_mode': approvalMode,
      'evidence_preference': evidencePreference,
      'agent_provider': agentProvider,
      if (providerModel.trim().isNotEmpty)
        'provider_model': providerModel.trim(),
      if (providerThinkingLevel.trim().isNotEmpty)
        'provider_thinking_level': providerThinkingLevel.trim(),
      'working_strategy': 'worktree',
    });
    return ApiEnvelope.item(json, NativeTask.fromJson);
  }

  Future<NativeTask> updateNativeTask({
    required String taskId,
    required String title,
    required String description,
    required List<String> workspaceIds,
    List<String> collectionIds = const [],
    String finalReportInstructions = '',
    String executionMode = 'implement',
    String approvalMode = 'ask_before_edits',
    String evidencePreference = 'tests_plus_screenshots',
    String agentProvider = 'codex',
    String providerModel = '',
    String providerThinkingLevel = '',
  }) async {
    final json = await _put('/api/v1/tasks/${Uri.encodeComponent(taskId)}', {
      'title': title,
      'description': description,
      'workspace_ids': workspaceIds,
      'collection_ids': collectionIds,
      'final_report_instructions': finalReportInstructions,
      'execution_mode': executionMode,
      'approval_mode': approvalMode,
      'evidence_preference': evidencePreference,
      'agent_provider': agentProvider,
      if (providerModel.trim().isNotEmpty)
        'provider_model': providerModel.trim(),
      if (providerThinkingLevel.trim().isNotEmpty)
        'provider_thinking_level': providerThinkingLevel.trim(),
      'working_strategy': 'worktree',
    });
    return ApiEnvelope.item(json, NativeTask.fromJson);
  }

  Future<NativeTaskAttachment> uploadNativeTaskAttachment({
    required String taskId,
    required String originalFilename,
    required String contentType,
    required List<int> bytes,
  }) async {
    final json = await _post(
      '/api/v1/tasks/${Uri.encodeComponent(taskId)}/attachments',
      {
        'original_filename': originalFilename,
        'content_type': contentType,
        'content_base64': base64Encode(bytes),
      },
    );
    return ApiEnvelope.item(json, NativeTaskAttachment.fromJson);
  }

  Future<void> deleteNativeTaskAttachment({
    required String taskId,
    required String attachmentId,
  }) async {
    await _delete(
      '/api/v1/tasks/${Uri.encodeComponent(taskId)}/attachments/'
      '${Uri.encodeComponent(attachmentId)}',
    );
  }

  Future<NativeTaskRun> startNativeTaskRun(
    String taskId, {
    String? agentProvider,
  }) async {
    final provider = agentProvider?.trim();
    final json = await _post(
      '/api/v1/tasks/${Uri.encodeComponent(taskId)}/runs',
      {
        'dirty_workspace_choice': 'use_worktree',
        if (provider != null && provider.isNotEmpty) 'agent_provider': provider,
      },
    );
    return ApiEnvelope.item(json, NativeTaskRun.fromJson);
  }

  Future<List<NativeTaskEvent>> nativeTaskRunEvents({
    required String taskId,
    required String runId,
  }) async {
    final json = await _get(
      '/api/v1/tasks/${Uri.encodeComponent(taskId)}/runs/'
      '${Uri.encodeComponent(runId)}/events',
    );
    return ApiEnvelope.list(json, NativeTaskEvent.fromJson);
  }

  Future<List<NativeTaskArtifact>> nativeTaskRunArtifacts({
    required String taskId,
    required String runId,
  }) async {
    final json = await _get(
      '/api/v1/tasks/${Uri.encodeComponent(taskId)}/runs/'
      '${Uri.encodeComponent(runId)}/artifacts',
    );
    return ApiEnvelope.list(json, NativeTaskArtifact.fromJson);
  }

  Future<NativeTaskArtifactContent> nativeTaskRunArtifact({
    required String taskId,
    required String runId,
    required String artifactId,
  }) async {
    final json = await _get(
      '/api/v1/tasks/${Uri.encodeComponent(taskId)}/runs/'
      '${Uri.encodeComponent(runId)}/artifacts/'
      '${Uri.encodeComponent(artifactId)}',
    );
    final content = ApiEnvelope.item(json, NativeTaskArtifactContent.fromJson);
    return content.withRawAccess(
      rawUrl: nativeTaskRunArtifactRawUri(
        taskId: taskId,
        runId: runId,
        artifactId: artifactId,
      ),
      authHeaders: authHeaders,
    );
  }

  Uri nativeTaskRunArtifactRawUri({
    required String taskId,
    required String runId,
    required String artifactId,
  }) {
    return _uri(
      '/api/v1/tasks/${Uri.encodeComponent(taskId)}/runs/'
      '${Uri.encodeComponent(runId)}/artifacts/'
      '${Uri.encodeComponent(artifactId)}/raw',
    );
  }

  Future<NativeTask> finalizeNativeTaskRun({
    required String taskId,
    required String runId,
  }) async {
    final json = await _post(
      '/api/v1/tasks/${Uri.encodeComponent(taskId)}/runs/'
      '${Uri.encodeComponent(runId)}/finalize',
      const <String, dynamic>{},
    );
    final item = ApiEnvelope.item<Map<String, dynamic>>(json, (value) => value);
    final task = item['task'];
    if (task is! Map<String, dynamic>) {
      throw const FormatException('Finalize response has no task');
    }
    return NativeTask.fromJson(task);
  }

  Future<NativeTask> createNativeTaskRunPullRequests({
    required String taskId,
    required String runId,
  }) async {
    final json = await _post(
      '/api/v1/tasks/${Uri.encodeComponent(taskId)}/runs/'
      '${Uri.encodeComponent(runId)}/pull-requests',
      const <String, dynamic>{},
    );
    final item = ApiEnvelope.item<Map<String, dynamic>>(json, (value) => value);
    final task = item['task'];
    if (task is! Map<String, dynamic>) {
      throw const FormatException('Pull request response has no task');
    }
    return NativeTask.fromJson(task);
  }
}
