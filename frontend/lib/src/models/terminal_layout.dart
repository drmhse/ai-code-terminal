import 'dart:convert';

class TerminalLayout {
  const TerminalLayout({
    required this.id,
    required this.name,
    required this.layoutType,
    required this.tree,
    required this.isDefault,
    required this.workspaceId,
  });

  factory TerminalLayout.fromJson(Map<String, dynamic> json) {
    final tree = _layoutTree(json);
    return TerminalLayout(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Layout',
      layoutType: json['layout_type']?.toString() ?? 'grid',
      tree: tree,
      isDefault: json['is_default'] == true,
      workspaceId: json['workspace_id']?.toString() ?? '',
    );
  }

  final String id;
  final String name;
  final String layoutType;
  final Map<String, dynamic> tree;
  final bool isDefault;
  final String workspaceId;

  int get paneCount {
    if (tree['panes'] is List) {
      return (tree['panes'] as List).length.clamp(1, 4);
    }
    return 1;
  }
}

Map<String, dynamic> _layoutTree(Map<String, dynamic> json) {
  final tree = json['tree'];
  if (tree is Map<String, dynamic>) {
    return tree;
  }

  try {
    final decoded = jsonDecode(json['tree_structure']?.toString() ?? '{}');
    if (decoded is Map<String, dynamic>) {
      return decoded;
    }
  } catch (_) {}

  return const {};
}
