class WorkspaceGitChangesOverview {
  const WorkspaceGitChangesOverview({
    required this.workspaceId,
    required this.name,
    required this.localPath,
    required this.githubRepo,
    required this.githubUrl,
    required this.isGitRepository,
    required this.isClean,
    required this.hasUncommittedChanges,
    required this.hasUnpushedChanges,
    required this.stagedCount,
    required this.unstagedCount,
    required this.untrackedCount,
    required this.ahead,
    required this.behind,
    required this.status,
    this.branch,
    this.remote,
    this.upstream,
    this.error,
  });

  factory WorkspaceGitChangesOverview.fromJson(Map<String, dynamic> json) {
    return WorkspaceGitChangesOverview(
      workspaceId: json['workspace_id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Workspace',
      localPath: json['local_path']?.toString() ?? '',
      githubRepo: json['github_repo']?.toString() ?? '',
      githubUrl: json['github_url']?.toString() ?? '',
      branch: json['branch']?.toString(),
      remote: json['remote']?.toString(),
      upstream: json['upstream']?.toString(),
      isGitRepository: json['is_git_repository'] == true,
      isClean: json['is_clean'] == true,
      hasUncommittedChanges: json['has_uncommitted_changes'] == true,
      hasUnpushedChanges: json['has_unpushed_changes'] == true,
      stagedCount: _readInt(json['staged_count']),
      unstagedCount: _readInt(json['unstaged_count']),
      untrackedCount: _readInt(json['untracked_count']),
      ahead: _readInt(json['ahead']),
      behind: _readInt(json['behind']),
      status: json['status']?.toString() ?? 'unknown',
      error: json['error']?.toString(),
    );
  }

  final String workspaceId;
  final String name;
  final String localPath;
  final String githubRepo;
  final String githubUrl;
  final String? branch;
  final String? remote;
  final String? upstream;
  final bool isGitRepository;
  final bool isClean;
  final bool hasUncommittedChanges;
  final bool hasUnpushedChanges;
  final int stagedCount;
  final int unstagedCount;
  final int untrackedCount;
  final int ahead;
  final int behind;
  final String status;
  final String? error;

  bool get needsAttention =>
      hasUncommittedChanges || hasUnpushedChanges || error != null;

  int get localChangeCount => stagedCount + unstagedCount + untrackedCount;
}

class GitHubCliStatus {
  const GitHubCliStatus({
    required this.installed,
    required this.authenticated,
    this.version,
    this.username,
    this.tokenSource,
    this.message,
  });

  factory GitHubCliStatus.fromJson(Map<String, dynamic> json) {
    return GitHubCliStatus(
      installed: json['installed'] == true,
      authenticated: json['authenticated'] == true,
      version: json['version']?.toString(),
      username: json['username']?.toString(),
      tokenSource: json['token_source']?.toString(),
      message: json['message']?.toString(),
    );
  }

  final bool installed;
  final bool authenticated;
  final String? version;
  final String? username;
  final String? tokenSource;
  final String? message;
}

int _readInt(Object? value) {
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value?.toString() ?? '') ?? 0;
}
