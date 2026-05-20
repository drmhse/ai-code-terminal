class FileItem {
  const FileItem({
    required this.name,
    required this.path,
    required this.isDirectory,
    this.size,
    this.gitStatus,
    this.gitStatusSummary,
  });

  factory FileItem.fromJson(Map<String, dynamic> json) {
    return FileItem(
      name: json['name']?.toString() ?? '',
      path: json['path']?.toString() ?? '',
      isDirectory: json['is_directory'] == true,
      size: json['size'] is num ? (json['size'] as num).toInt() : null,
      gitStatus: json['git_status']?.toString(),
      gitStatusSummary: json['git_status_summary'] is Map<String, dynamic>
          ? GitStatusSummary.fromJson(
              json['git_status_summary'] as Map<String, dynamic>,
            )
          : null,
    );
  }

  final String name;
  final String path;
  final bool isDirectory;
  final int? size;
  final String? gitStatus;
  final GitStatusSummary? gitStatusSummary;
}

class GitStatusSummary {
  const GitStatusSummary({
    this.changed = false,
    this.staged = false,
    this.unstaged = false,
    this.untracked = false,
    this.deleted = false,
    this.renamed = false,
    this.conflicted = false,
  });

  factory GitStatusSummary.fromJson(Map<String, dynamic> json) {
    return GitStatusSummary(
      changed: json['changed'] == true,
      staged: json['staged'] == true,
      unstaged: json['unstaged'] == true,
      untracked: json['untracked'] == true,
      deleted: json['deleted'] == true,
      renamed: json['renamed'] == true,
      conflicted: json['conflicted'] == true,
    );
  }

  final bool changed;
  final bool staged;
  final bool unstaged;
  final bool untracked;
  final bool deleted;
  final bool renamed;
  final bool conflicted;
}
