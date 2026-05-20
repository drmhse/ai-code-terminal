import 'package:act_frontend/src/models/workspace.dart';

class WorkspaceCollection {
  const WorkspaceCollection({
    required this.id,
    required this.name,
    required this.members,
    this.description,
    this.color,
    this.icon,
    this.defaultWorkspaceId,
  });

  factory WorkspaceCollection.fromJson(Map<String, dynamic> json) {
    return WorkspaceCollection(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Collection',
      description: json['description']?.toString(),
      color: json['color']?.toString(),
      icon: json['icon']?.toString(),
      defaultWorkspaceId: json['default_workspace_id']?.toString(),
      members: _mapList(json['members'], WorkspaceCollectionMember.fromJson),
    );
  }

  final String id;
  final String name;
  final String? description;
  final String? color;
  final String? icon;
  final String? defaultWorkspaceId;
  final List<WorkspaceCollectionMember> members;

  bool containsWorkspace(String workspaceId) {
    return members.any((member) => member.workspaceId == workspaceId);
  }

  Workspace? get primaryWorkspace {
    if (members.isEmpty) {
      return null;
    }
    final defaultId = defaultWorkspaceId;
    if (defaultId != null && defaultId.isNotEmpty) {
      for (final member in members) {
        if (member.workspaceId == defaultId) {
          return member.workspace;
        }
      }
    }
    for (final member in members) {
      if (member.role == 'primary') {
        return member.workspace;
      }
    }
    return members.first.workspace;
  }
}

class WorkspaceCollectionMember {
  const WorkspaceCollectionMember({
    required this.collectionId,
    required this.workspaceId,
    required this.role,
    required this.workspace,
  });

  factory WorkspaceCollectionMember.fromJson(Map<String, dynamic> json) {
    final workspace = json['workspace'];
    return WorkspaceCollectionMember(
      collectionId: json['collection_id']?.toString() ?? '',
      workspaceId: json['workspace_id']?.toString() ?? '',
      role: json['role']?.toString() ?? 'member',
      workspace: workspace is Map<String, dynamic>
          ? Workspace.fromJson(workspace)
          : const Workspace(
              id: '',
              name: 'Workspace',
              localPath: '',
              isActive: false,
              githubRepo: '',
              githubUrl: '',
            ),
    );
  }

  final String collectionId;
  final String workspaceId;
  final String role;
  final Workspace workspace;
}

List<T> _mapList<T>(Object? value, T Function(Map<String, dynamic>) parser) {
  if (value is! List) {
    return const [];
  }
  return value
      .whereType<Map<String, dynamic>>()
      .map(parser)
      .toList(growable: false);
}
