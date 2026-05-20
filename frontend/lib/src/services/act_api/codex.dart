part of '../act_api.dart';

extension ActApiCodex on ActApi {
  Future<List<CodingAgentModel>> codingAgentModels() async {
    final json = await _get('/api/v1/codex/models');
    return ApiEnvelope.list(json, CodingAgentModel.fromJson);
  }

  Future<List<CodexSessionSummary>> codexSessions({
    int limit = 40,
    String? workspaceId,
    String? scopeType,
    String? scopeId,
  }) async {
    final query = StringBuffer('/api/v1/codex/sessions?limit=$limit');
    if (workspaceId != null && workspaceId.trim().isNotEmpty) {
      query.write(
        '&workspace_id=${Uri.encodeQueryComponent(workspaceId.trim())}',
      );
    }
    if (scopeType?.trim().isNotEmpty == true) {
      query.write('&scope_type=${Uri.encodeQueryComponent(scopeType!.trim())}');
    }
    if (scopeId?.trim().isNotEmpty == true) {
      query.write('&scope_id=${Uri.encodeQueryComponent(scopeId!.trim())}');
    }
    final json = await _get(query.toString());
    return ApiEnvelope.list(json, CodexSessionSummary.fromJson);
  }

  Future<CodexLaunchResponse> launchCodexSession({
    String? workspaceId,
    String? scopeType,
    String? scopeId,
    String? prompt,
    String agentProvider = 'codex',
    String? providerModel,
    String? providerThinkingLevel,
  }) async {
    final json = await _post('/api/v1/codex/sessions', {
      if (workspaceId?.trim().isNotEmpty == true)
        'workspace_id': workspaceId!.trim(),
      if (scopeType?.trim().isNotEmpty == true) 'scope_type': scopeType!.trim(),
      if (scopeId?.trim().isNotEmpty == true) 'scope_id': scopeId!.trim(),
      if (prompt != null && prompt.trim().isNotEmpty) 'prompt': prompt.trim(),
      'agent_provider': agentProvider,
      if (providerModel?.trim().isNotEmpty == true)
        'provider_model': providerModel!.trim(),
      if (providerThinkingLevel?.trim().isNotEmpty == true)
        'provider_thinking_level': providerThinkingLevel!.trim(),
    });
    return ApiEnvelope.item(json, CodexLaunchResponse.fromJson);
  }

  Future<CodexSessionSummary> sendCodexMessage({
    required String sessionId,
    required String workspaceId,
    String? scopeType,
    String? scopeId,
    required String prompt,
    String mode = 'queue',
  }) async {
    final json = await _post(
      '/api/v1/codex/sessions/${Uri.encodeComponent(sessionId)}/messages',
      {
        'workspace_id': workspaceId,
        if (scopeType?.trim().isNotEmpty == true)
          'scope_type': scopeType!.trim(),
        if (scopeId?.trim().isNotEmpty == true) 'scope_id': scopeId!.trim(),
        'prompt': prompt,
        'mode': mode,
      },
    );
    return ApiEnvelope.item(json, CodexSessionSummary.fromJson);
  }

  Future<CodexSessionSummary> interruptCodexSession(String sessionId) async {
    final json = await _post(
      '/api/v1/codex/sessions/${Uri.encodeComponent(sessionId)}/interrupt',
      const <String, dynamic>{},
    );
    return ApiEnvelope.item(json, CodexSessionSummary.fromJson);
  }

  Future<CodexSessionSummary> respondCodexExtensionUi({
    required String sessionId,
    required String requestId,
    String? value,
    bool? confirmed,
    bool cancelled = false,
  }) async {
    final body = <String, dynamic>{};
    if (value != null) {
      body['value'] = value;
    }
    if (confirmed != null) {
      body['confirmed'] = confirmed;
    }
    if (cancelled) {
      body['cancelled'] = true;
    }
    final json = await _post(
      '/api/v1/codex/sessions/${Uri.encodeComponent(sessionId)}/extension-ui/'
      '${Uri.encodeComponent(requestId)}',
      body,
    );
    return ApiEnvelope.item(json, CodexSessionSummary.fromJson);
  }

  Future<List<CodexSessionEvent>> codexSessionEvents(
    String sessionId, {
    int limit = 300,
  }) async {
    final json = await _get(
      '/api/v1/codex/sessions/${Uri.encodeComponent(sessionId)}/events'
      '?limit=$limit',
    );
    return ApiEnvelope.list(json, CodexSessionEvent.fromJson);
  }

  Future<CodexSessionChanges> codexSessionChanges(String sessionId) async {
    final json = await _get(
      '/api/v1/codex/sessions/${Uri.encodeComponent(sessionId)}/changes',
    );
    return ApiEnvelope.item(json, CodexSessionChanges.fromJson);
  }
}
