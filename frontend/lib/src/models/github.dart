class GitHubProviderStatus {
  const GitHubProviderStatus({
    required this.available,
    required this.provider,
    required this.hasAccessToken,
    required this.hasRefreshToken,
    required this.scopes,
    this.actionRequired = false,
    this.actionCode,
    this.missingScopes = const [],
    this.reauthUrl,
    this.expiresAt,
  });

  factory GitHubProviderStatus.fromJson(Map<String, dynamic> json) {
    return GitHubProviderStatus(
      available: json['available'] == true,
      provider: json['provider']?.toString() ?? 'github',
      hasAccessToken: json['has_access_token'] == true,
      hasRefreshToken: json['has_refresh_token'] == true,
      expiresAt: json['expires_at']?.toString(),
      scopes: _stringList(json['scopes']),
      actionRequired: json['action_required'] == true,
      actionCode: json['action_code']?.toString(),
      missingScopes: _stringList(json['missing_scopes']),
      reauthUrl: json['reauth_url']?.toString(),
    );
  }

  final bool available;
  final String provider;
  final bool hasAccessToken;
  final bool hasRefreshToken;
  final String? expiresAt;
  final List<String> scopes;
  final bool actionRequired;
  final String? actionCode;
  final List<String> missingScopes;
  final String? reauthUrl;
}

class GitHubRepository {
  const GitHubRepository({
    required this.id,
    required this.name,
    required this.fullName,
    required this.cloneUrl,
    required this.private,
    required this.defaultBranch,
    this.description,
    this.language,
    this.updatedAt,
    this.cloned = false,
    this.clonedWorkspaceId,
    this.clonedWorkspaceName,
    this.clonedLocalPath,
    this.permissions = const GitHubRepositoryPermissions(pull: true),
    this.viewerPermission = 'read',
  });

  factory GitHubRepository.fromJson(Map<String, dynamic> json) {
    final permissions = GitHubRepositoryPermissions.fromJson(
      json['permissions'],
      isPrivate: json['private'] == true,
    );
    return GitHubRepository(
      id: int.tryParse(json['id']?.toString() ?? '') ?? 0,
      name: json['name']?.toString() ?? '',
      fullName: json['full_name']?.toString() ?? '',
      cloneUrl: json['clone_url']?.toString() ?? '',
      private: json['private'] == true,
      defaultBranch: json['default_branch']?.toString() ?? 'main',
      description: json['description']?.toString(),
      language: json['language']?.toString(),
      updatedAt: json['updated_at']?.toString(),
      cloned: json['cloned'] == true,
      clonedWorkspaceId: json['cloned_workspace_id']?.toString(),
      clonedWorkspaceName: json['cloned_workspace_name']?.toString(),
      clonedLocalPath: json['cloned_local_path']?.toString(),
      permissions: permissions,
      viewerPermission:
          json['viewer_permission']?.toString() ??
          permissions.normalizedViewerPermission,
    );
  }

  final int id;
  final String name;
  final String fullName;
  final String cloneUrl;
  final bool private;
  final String defaultBranch;
  final String? description;
  final String? language;
  final String? updatedAt;
  final bool cloned;
  final String? clonedWorkspaceId;
  final String? clonedWorkspaceName;
  final String? clonedLocalPath;
  final GitHubRepositoryPermissions permissions;
  final String viewerPermission;

  bool get canRead =>
      _permissionRank(viewerPermission) >= _permissionRank('read');
  bool get canWrite =>
      _permissionRank(viewerPermission) >= _permissionRank('write');
  String get permissionLabel => _permissionLabel(viewerPermission);
}

class GitHubRepositoryPermissions {
  const GitHubRepositoryPermissions({
    this.pull = false,
    this.triage = false,
    this.push = false,
    this.maintain = false,
    this.admin = false,
  });

  factory GitHubRepositoryPermissions.fromJson(
    Object? json, {
    required bool isPrivate,
  }) {
    if (json is! Map<String, dynamic>) {
      return GitHubRepositoryPermissions(pull: !isPrivate);
    }
    return GitHubRepositoryPermissions(
      pull: json['pull'] == true,
      triage: json['triage'] == true,
      push: json['push'] == true,
      maintain: json['maintain'] == true,
      admin: json['admin'] == true,
    );
  }

  final bool pull;
  final bool triage;
  final bool push;
  final bool maintain;
  final bool admin;

  String get normalizedViewerPermission {
    if (admin) return 'admin';
    if (maintain) return 'maintain';
    if (push) return 'write';
    if (triage) return 'triage';
    if (pull) return 'read';
    return 'none';
  }
}

class GitHubRepositoryPage {
  const GitHubRepositoryPage({
    required this.repositories,
    required this.page,
    required this.perPage,
    required this.hasMore,
    this.nextPage,
  });

  factory GitHubRepositoryPage.fromJson(Map<String, dynamic> json) {
    final repositories = json['repositories'];
    return GitHubRepositoryPage(
      repositories: repositories is List
          ? repositories
                .whereType<Map<String, dynamic>>()
                .map(GitHubRepository.fromJson)
                .toList(growable: false)
          : const [],
      page: int.tryParse(json['page']?.toString() ?? '') ?? 1,
      perPage: int.tryParse(json['per_page']?.toString() ?? '') ?? 50,
      hasMore: json['has_more'] == true,
      nextPage: int.tryParse(json['next_page']?.toString() ?? ''),
    );
  }

  final List<GitHubRepository> repositories;
  final int page;
  final int perPage;
  final bool hasMore;
  final int? nextPage;
}

List<String> _stringList(Object? value) {
  if (value is List) {
    return value.map((entry) => entry.toString()).toList(growable: false);
  }
  if (value is String && value.isNotEmpty) {
    return value
        .split(RegExp(r'\s+'))
        .where((entry) => entry.isNotEmpty)
        .toList();
  }
  return const [];
}

int _permissionRank(String permission) {
  switch (permission.toLowerCase()) {
    case 'admin':
      return 5;
    case 'maintain':
      return 4;
    case 'write':
    case 'push':
      return 3;
    case 'triage':
      return 2;
    case 'read':
    case 'pull':
      return 1;
    default:
      return 0;
  }
}

String _permissionLabel(String permission) {
  switch (permission.toLowerCase()) {
    case 'admin':
      return 'Admin';
    case 'maintain':
      return 'Maintain';
    case 'write':
    case 'push':
      return 'Write';
    case 'triage':
      return 'Triage';
    case 'read':
    case 'pull':
      return 'Read';
    default:
      return 'No access';
  }
}
