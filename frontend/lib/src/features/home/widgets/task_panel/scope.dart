part of '../task_panel.dart';

class _TaskScopeBar extends StatelessWidget {
  const _TaskScopeBar({
    required this.workspaces,
    required this.collections,
    required this.scopeType,
    required this.scopeId,
    required this.taskCount,
    required this.onScopeChanged,
  });

  final List<Workspace> workspaces;
  final List<WorkspaceCollection> collections;
  final String? scopeType;
  final String? scopeId;
  final int taskCount;
  final TaskScopeChangedCallback onScopeChanged;

  @override
  Widget build(BuildContext context) {
    final label = _label();
    final icon = switch (scopeType) {
      'collection' => Icons.account_tree_outlined,
      'workspace' => Icons.folder_outlined,
      _ => Icons.all_inbox,
    };
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.line(context))),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.accent(context)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '$label - $taskCount ${taskCount == 1 ? 'task' : 'tasks'}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AppColors.secondaryText(context),
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          IconButton(
            tooltip: 'Filter tasks',
            onPressed: () => _openFilter(context),
            icon: const Icon(Icons.tune, size: 19),
          ),
        ],
      ),
    );
  }

  String _label() {
    if (scopeType == 'collection') {
      final collection = collections.cast<WorkspaceCollection?>().firstWhere(
        (candidate) => candidate?.id == scopeId,
        orElse: () => null,
      );
      return collection == null ? 'Collection tasks' : collection.name;
    }
    if (scopeType == 'workspace') {
      final workspace = workspaces.cast<Workspace?>().firstWhere(
        (candidate) => candidate?.id == scopeId,
        orElse: () => null,
      );
      return workspace == null ? 'Project tasks' : workspace.name;
    }
    return 'All tasks';
  }

  Future<void> _openFilter(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      backgroundColor: AppColors.panel(context),
      builder: (context) {
        return _TaskScopeSheet(
          workspaces: workspaces,
          collections: collections,
          scopeType: scopeType,
          scopeId: scopeId,
          onSelected: (type, id) {
            Navigator.pop(context);
            onScopeChanged(type, id);
          },
        );
      },
    );
  }
}

class _TaskScopeSheet extends StatelessWidget {
  const _TaskScopeSheet({
    required this.workspaces,
    required this.collections,
    required this.scopeType,
    required this.scopeId,
    required this.onSelected,
  });

  final List<Workspace> workspaces;
  final List<WorkspaceCollection> collections;
  final String? scopeType;
  final String? scopeId;
  final TaskScopeChangedCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 10, 8),
            child: Row(
              children: [
                Icon(Icons.tune, color: AppColors.accent(context)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Task filter',
                    style: TextStyle(
                      color: AppColors.primaryText(context),
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Close',
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: AppColors.line(context)),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              children: [
                ListTile(
                  selected: scopeType == null,
                  leading: const Icon(Icons.all_inbox),
                  title: const Text('All tasks'),
                  onTap: () => onSelected(null, null),
                ),
                if (collections.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                    child: Text(
                      'COLLECTIONS',
                      style: TextStyle(
                        color: AppColors.mutedText(context),
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                for (final collection in collections)
                  ListTile(
                    selected:
                        scopeType == 'collection' && scopeId == collection.id,
                    leading: const Icon(Icons.account_tree_outlined),
                    title: Text(
                      collection.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text('${collection.members.length} projects'),
                    onTap: () => onSelected('collection', collection.id),
                  ),
                if (workspaces.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                    child: Text(
                      'PROJECTS',
                      style: TextStyle(
                        color: AppColors.mutedText(context),
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                for (final workspace in workspaces)
                  ListTile(
                    selected:
                        scopeType == 'workspace' && scopeId == workspace.id,
                    leading: const Icon(Icons.folder_outlined),
                    title: Text(
                      workspace.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      workspace.githubRepo.isNotEmpty
                          ? workspace.githubRepo
                          : workspace.localPath,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    onTap: () => onSelected('workspace', workspace.id),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
