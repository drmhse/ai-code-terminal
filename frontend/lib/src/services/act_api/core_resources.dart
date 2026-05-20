part of '../act_api.dart';

extension ActApiCoreResources on ActApi {
  Future<HealthStatus> health() async {
    final json = await _getPublic('/api/v1/health');
    return HealthStatus.fromJson(json);
  }

  Future<DeploymentConfig> deploymentConfig() async {
    final json = await _getPublic('/api/v1/deployment/config');
    final data = json['data'];
    if (data is! Map<String, dynamic>) {
      throw const ActApiException('Expected ACT deployment config response');
    }
    return DeploymentConfig.fromJson(data);
  }

  Future<UserProfile> me() async {
    final json = await _get('/api/v1/auth/me');
    return UserProfile.fromJson(_unwrapObject(json));
  }

  Future<List<Workspace>> workspaces() async {
    final json = await _get('/api/v1/workspaces');
    return ApiEnvelope.list(json, Workspace.fromJson);
  }

  Future<List<WorkspaceGitChangesOverview>> workspaceGitChanges() async {
    final json = await _get('/api/v1/workspaces/git/changes');
    return ApiEnvelope.list(json, WorkspaceGitChangesOverview.fromJson);
  }

  Future<List<WorkspaceCollection>> collections() async {
    final json = await _get('/api/v1/collections');
    return ApiEnvelope.list(json, WorkspaceCollection.fromJson);
  }

  Future<WorkspaceCollection> createCollection({
    required String name,
    List<String> workspaceIds = const [],
  }) async {
    final json = await _post('/api/v1/collections', {
      'name': name,
      'workspace_ids': workspaceIds,
    });
    return ApiEnvelope.item(json, WorkspaceCollection.fromJson);
  }

  Future<WorkspaceCollection> updateCollection({
    required String collectionId,
    required String name,
    String? description,
  }) async {
    final json = await _put(
      '/api/v1/collections/${Uri.encodeComponent(collectionId)}',
      {'name': name, 'description': description},
    );
    return ApiEnvelope.item(json, WorkspaceCollection.fromJson);
  }

  Future<WorkspaceCollection> addWorkspaceToCollection({
    required String collectionId,
    required String workspaceId,
  }) async {
    final json = await _post(
      '/api/v1/collections/${Uri.encodeComponent(collectionId)}/members',
      {'workspace_id': workspaceId},
    );
    return ApiEnvelope.item(json, WorkspaceCollection.fromJson);
  }

  Future<WorkspaceCollection> removeWorkspaceFromCollection({
    required String collectionId,
    required String workspaceId,
  }) async {
    final json = await _delete(
      '/api/v1/collections/${Uri.encodeComponent(collectionId)}/members/'
      '${Uri.encodeComponent(workspaceId)}',
    );
    return ApiEnvelope.item(json, WorkspaceCollection.fromJson);
  }

  Future<WorkspaceCollection> setCollectionDefaultWorkspace({
    required String collectionId,
    required String workspaceId,
  }) async {
    final json = await _post(
      '/api/v1/collections/${Uri.encodeComponent(collectionId)}/default-workspace',
      {'workspace_id': workspaceId},
    );
    return ApiEnvelope.item(json, WorkspaceCollection.fromJson);
  }

  Future<void> deleteCollection(String collectionId) async {
    await _delete('/api/v1/collections/${Uri.encodeComponent(collectionId)}');
  }

  Future<Workspace> createEmptyWorkspace({
    required String name,
    required String path,
    String? collectionId,
  }) async {
    final json = await _post('/api/v1/workspaces/empty', {
      'name': name,
      'path': path.isEmpty ? null : path,
      if (collectionId?.trim().isNotEmpty == true)
        'collection_id': collectionId!.trim(),
    });
    return ApiEnvelope.item(json, Workspace.fromJson);
  }

  Future<GitHubProviderStatus> githubProviderStatus({
    String? redirectUri,
  }) async {
    final query = StringBuffer('/api/v1/github/status');
    if (redirectUri != null && redirectUri.trim().isNotEmpty) {
      query.write(
        '?redirect_uri=${Uri.encodeQueryComponent(redirectUri.trim())}',
      );
    }
    final json = await _get(query.toString());
    return ApiEnvelope.item(json, GitHubProviderStatus.fromJson);
  }

  Future<GitHubCliStatus> githubCliStatus() async {
    final json = await _get('/api/v1/github/cli/status');
    return ApiEnvelope.item(json, GitHubCliStatus.fromJson);
  }

  Future<GitHubRepositoryPage> githubRepositoriesPage({
    String search = '',
    int page = 1,
    int perPage = 50,
  }) async {
    final query = StringBuffer(
      '/api/v1/github/repositories'
      '?page=$page&per_page=$perPage',
    );
    if (search.trim().isNotEmpty) {
      query.write('&search=${Uri.encodeQueryComponent(search.trim())}');
    }
    final json = await _get(query.toString());
    final data = json['data'];
    if (data is! Map<String, dynamic>) {
      throw const ActApiException('Expected a GitHub repository response');
    }
    return GitHubRepositoryPage.fromJson(data);
  }

  Future<List<GitHubRepository>> githubRepositories({
    String search = '',
  }) async {
    return (await githubRepositoriesPage(search: search)).repositories;
  }

  Future<Workspace> cloneGitHubRepository(
    GitHubRepository repository, {
    String? collectionId,
  }) async {
    final json = await _post('/api/v1/github/clone', {
      'name': repository.name,
      'git_url': repository.cloneUrl,
      'branch': repository.defaultBranch,
      'description': repository.description,
      if (collectionId?.trim().isNotEmpty == true)
        'collection_id': collectionId!.trim(),
    });
    final data = json['data'];
    if (data is! Map<String, dynamic>) {
      throw const ActApiException('Expected a GitHub clone response');
    }
    final workspace = data['workspace'];
    if (workspace is! Map<String, dynamic>) {
      throw const ActApiException('Clone response did not include a workspace');
    }
    return Workspace.fromJson(workspace);
  }

  Future<List<TerminalSession>> sessions() async {
    final json = await _get('/api/v1/sessions');
    return ApiEnvelope.list(json, TerminalSession.fromJson);
  }

  Future<TerminalSession> createSession(String workspaceId) async {
    final json = await _post('/api/v1/sessions', {
      'workspace_id': workspaceId,
      'session_name': 'Flutter session',
      'terminal_size': {'cols': 120, 'rows': 34},
    });
    return ApiEnvelope.item(json, TerminalSession.fromJson);
  }

  Future<void> terminateSession(String sessionId) async {
    await _delete('/api/v1/sessions/${Uri.encodeComponent(sessionId)}');
  }

  Future<List<ServerProcess>> serverProcesses() async {
    final json = await _get('/api/v1/processes');
    return ApiEnvelope.list(json, ServerProcess.fromJson);
  }

  Future<void> stopServerProcess(String processId) async {
    await _post(
      '/api/v1/processes/${Uri.encodeComponent(processId)}/stop',
      const <String, dynamic>{},
    );
  }

  Future<void> restartServerProcess(String processId) async {
    await _post(
      '/api/v1/processes/${Uri.encodeComponent(processId)}/restart',
      const <String, dynamic>{},
    );
  }

  Future<String> sessionBuffer(String sessionId) async {
    final json = await _get('/api/v1/sessions/$sessionId/buffer');
    return json['data']?.toString() ?? '';
  }

  Future<SystemStats> systemStats() async {
    final json = await _get('/api/v1/system/stats');
    return ApiEnvelope.item(json, SystemStats.fromJson);
  }

  Future<DirectoryListing> workspaceFiles(
    String workspaceId, {
    String path = '.',
  }) async {
    final uriPath =
        '/api/v1/workspaces/$workspaceId/files'
        '?path=${Uri.encodeQueryComponent(path)}';
    final json = await _get(uriPath);
    return ApiEnvelope.item(json, DirectoryListing.fromJson);
  }

  Future<FileContent> workspaceFileContent(
    String workspaceId, {
    required String path,
  }) async {
    final json = await _get(
      '/api/v1/workspaces/$workspaceId/files/content'
      '?path=${Uri.encodeQueryComponent(path)}',
    );
    return ApiEnvelope.item(json, FileContent.fromJson);
  }

  Future<void> saveWorkspaceFileContent(
    String workspaceId, {
    required String path,
    required String content,
  }) async {
    await _put('/api/v1/workspaces/$workspaceId/files/content', {
      'path': path,
      'content': content,
    });
  }

  Future<RunnerReadiness> runnerReadiness() async {
    final json = await _get('/api/v1/tasks/readiness');
    return ApiEnvelope.item(json, RunnerReadiness.fromJson);
  }
}
