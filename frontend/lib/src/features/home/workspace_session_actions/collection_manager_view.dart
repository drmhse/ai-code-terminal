part of '../act_home_page.dart';
// ignore_for_file: invalid_use_of_protected_member

typedef _CollectionCreateCallback =
    Future<WorkspaceCollection> Function(
      String name,
      List<String> workspaceIds,
    );
typedef _CollectionRenameCallback =
    Future<WorkspaceCollection> Function(
      WorkspaceCollection collection,
      String name,
    );
typedef _CollectionDeleteCallback =
    Future<void> Function(WorkspaceCollection collection);
typedef _CollectionWorkspaceCallback =
    Future<WorkspaceCollection> Function(
      WorkspaceCollection collection,
      Workspace workspace,
    );

int _compareCollections(WorkspaceCollection left, WorkspaceCollection right) {
  return left.name.toLowerCase().compareTo(right.name.toLowerCase());
}

class _CollectionManagerSheet extends StatefulWidget {
  const _CollectionManagerSheet({
    required this.collections,
    required this.workspaces,
    required this.selectedCollection,
    required this.selectedWorkspace,
    required this.onCreate,
    required this.onRename,
    required this.onDelete,
    required this.onAddWorkspace,
    required this.onRemoveWorkspace,
    required this.onSetPrimary,
  });

  final List<WorkspaceCollection> collections;
  final List<Workspace> workspaces;
  final WorkspaceCollection? selectedCollection;
  final Workspace? selectedWorkspace;
  final _CollectionCreateCallback onCreate;
  final _CollectionRenameCallback onRename;
  final _CollectionDeleteCallback onDelete;
  final _CollectionWorkspaceCallback onAddWorkspace;
  final _CollectionWorkspaceCallback onRemoveWorkspace;
  final _CollectionWorkspaceCallback onSetPrimary;

  @override
  State<_CollectionManagerSheet> createState() =>
      _CollectionManagerSheetState();
}

class _CollectionManagerSheetState extends State<_CollectionManagerSheet> {
  late List<WorkspaceCollection> _collections;
  late String? _selectedCollectionId;
  late final TextEditingController _createController;
  late final TextEditingController _renameController;
  late Set<String> _newWorkspaceIds;
  late bool _showCreateCollection;
  String? _error;
  String? _busyKey;

  @override
  void initState() {
    super.initState();
    _collections = [...widget.collections]..sort(_compareCollections);
    _selectedCollectionId =
        widget.selectedCollection?.id ??
        (_collections.isEmpty ? null : _collections.first.id);
    _createController = TextEditingController();
    _renameController = TextEditingController(text: _selectedCollection?.name);
    _newWorkspaceIds = {
      if (widget.selectedWorkspace != null) widget.selectedWorkspace!.id,
    };
    _showCreateCollection = _collections.isEmpty;
  }

  @override
  void dispose() {
    _createController.dispose();
    _renameController.dispose();
    super.dispose();
  }

  WorkspaceCollection? get _selectedCollection {
    final id = _selectedCollectionId;
    if (id == null) {
      return null;
    }
    return _collections.cast<WorkspaceCollection?>().firstWhere(
      (collection) => collection?.id == id,
      orElse: () => null,
    );
  }

  @override
  Widget build(BuildContext context) {
    final selected = _selectedCollection;
    return FractionallySizedBox(
      heightFactor: 0.92,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
            child: Row(
              children: [
                Icon(
                  Icons.account_tree_outlined,
                  color: AppColors.accent(context),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Manage collections',
                    style: TextStyle(
                      color: AppColors.primaryText(context),
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
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
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 18),
              children: [
                _managerSummary(context, selected),
                if (_collections.isNotEmpty) const SizedBox(height: 12),
                _collectionSelector(context),
                if (selected != null) ...[
                  const SizedBox(height: 12),
                  _collectionDetail(context, selected),
                ],
                const SizedBox(height: 12),
                _showCreateCollection
                    ? _createCollectionPanel(context)
                    : _createCollectionButton(context),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _managerSummary(BuildContext context, WorkspaceCollection? selected) {
    final collectionCount = _collections.length;
    final projectCount = selected?.members.length ?? widget.workspaces.length;
    final title = selected == null
        ? collectionCount == 0
              ? 'No collections yet'
              : '$collectionCount collections'
        : selected.name;
    final subtitle = selected == null
        ? 'Create a collection only when several projects belong together.'
        : '${projectCount == 1 ? '1 project' : '$projectCount projects'} grouped for multi-project work';
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.field(context),
        border: Border.all(color: AppColors.line(context)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(Icons.account_tree_outlined, color: AppColors.accent(context)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.secondaryText(context),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _createCollectionButton(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: TextButton.icon(
        onPressed: () => setState(() => _showCreateCollection = true),
        icon: const Icon(Icons.create_new_folder_outlined, size: 18),
        label: const Text('Create collection'),
        style: TextButton.styleFrom(
          foregroundColor: AppColors.secondaryText(context),
        ),
      ),
    );
  }

  Widget _createCollectionPanel(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.line(context)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.create_new_folder_outlined, size: 18),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'New collection',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
              IconButton(
                tooltip: 'Hide create collection',
                onPressed: _collections.isEmpty
                    ? null
                    : () => setState(() => _showCreateCollection = false),
                icon: const Icon(Icons.expand_less),
              ),
              FilledButton.icon(
                onPressed: _busyKey == 'create' ? null : _createCollection,
                icon: _busyKey == 'create'
                    ? const SizedBox.square(
                        dimension: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.add, size: 16),
                label: const Text('Create'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _createController,
            textInputAction: TextInputAction.done,
            decoration: InputDecoration(labelText: 'Name', errorText: _error),
            onSubmitted: (_) => _createCollection(),
            onChanged: (_) {
              if (_error != null) {
                setState(() => _error = null);
              }
            },
          ),
          if (widget.workspaces.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final workspace in widget.workspaces)
                  FilterChip(
                    avatar: const Icon(Icons.folder_outlined, size: 15),
                    label: Text(workspace.name),
                    selected: _newWorkspaceIds.contains(workspace.id),
                    onSelected: (selected) {
                      setState(() {
                        if (selected) {
                          _newWorkspaceIds = {
                            ..._newWorkspaceIds,
                            workspace.id,
                          };
                        } else {
                          _newWorkspaceIds = {
                            for (final id in _newWorkspaceIds)
                              if (id != workspace.id) id,
                          };
                        }
                      });
                    },
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _collectionSelector(BuildContext context) {
    if (_collections.isEmpty) {
      return Text(
        'No collections',
        style: TextStyle(color: AppColors.mutedText(context)),
      );
    }
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final collection in _collections)
          ChoiceChip(
            avatar: const Icon(Icons.account_tree_outlined, size: 15),
            label: Text(collection.name),
            selected: collection.id == _selectedCollectionId,
            onSelected: (_) => _selectCollection(collection),
          ),
      ],
    );
  }

  Widget _collectionDetail(
    BuildContext context,
    WorkspaceCollection collection,
  ) {
    final availableWorkspaces = widget.workspaces
        .where((workspace) => !collection.containsWorkspace(workspace.id))
        .toList(growable: false);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.field(context),
        border: Border.all(color: AppColors.line(context)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _renameController,
                  decoration: const InputDecoration(
                    labelText: 'Collection name',
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                tooltip: 'Rename collection',
                onPressed: _busyKey == 'rename'
                    ? null
                    : () => _rename(collection),
                icon: _busyKey == 'rename'
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_outlined),
              ),
              IconButton(
                tooltip: 'Delete collection',
                onPressed: _busyKey == 'delete'
                    ? null
                    : () => _delete(collection),
                icon: const Icon(Icons.delete_outline),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Projects',
            style: TextStyle(
              color: AppColors.secondaryText(context),
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          if (collection.members.isEmpty)
            Text(
              'Empty collection',
              style: TextStyle(color: AppColors.mutedText(context)),
            )
          else
            for (final member in collection.members)
              _CollectionMemberTile(
                member: member,
                defaultWorkspaceId: collection.defaultWorkspaceId,
                busy: _busyKey == 'member:${member.workspaceId}',
                onSetPrimary: () => _setPrimary(collection, member.workspace),
                onRemove: () => _removeWorkspace(collection, member.workspace),
              ),
          if (availableWorkspaces.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              'Add project',
              style: TextStyle(
                color: AppColors.secondaryText(context),
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final workspace in availableWorkspaces)
                  ActionChip(
                    avatar: const Icon(Icons.add, size: 15),
                    label: Text(workspace.name),
                    onPressed: _busyKey == 'add:${workspace.id}'
                        ? null
                        : () => _addWorkspace(collection, workspace),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
