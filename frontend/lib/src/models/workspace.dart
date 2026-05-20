class Workspace {
  const Workspace({
    required this.id,
    required this.name,
    required this.localPath,
    required this.isActive,
    required this.githubRepo,
    required this.githubUrl,
    this.sourceKind,
    this.sourceProvider,
    this.sourceRef,
    this.openedFromPath,
  });

  factory Workspace.fromJson(Map<String, dynamic> json) {
    return Workspace(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Workspace',
      localPath: json['local_path']?.toString() ?? '',
      isActive: json['is_active'] == true,
      githubRepo: json['github_repo']?.toString() ?? '',
      githubUrl: json['github_url']?.toString() ?? '',
      sourceKind: json['source_kind']?.toString(),
      sourceProvider: json['source_provider']?.toString(),
      sourceRef: json['source_ref']?.toString(),
      openedFromPath: json['opened_from_path']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'local_path': localPath,
    'is_active': isActive,
    'github_repo': githubRepo,
    'github_url': githubUrl,
    'source_kind': sourceKind,
    'source_provider': sourceProvider,
    'source_ref': sourceRef,
    'opened_from_path': openedFromPath,
  };

  final String id;
  final String name;
  final String localPath;
  final bool isActive;
  final String githubRepo;
  final String githubUrl;
  final String? sourceKind;
  final String? sourceProvider;
  final String? sourceRef;
  final String? openedFromPath;
}
