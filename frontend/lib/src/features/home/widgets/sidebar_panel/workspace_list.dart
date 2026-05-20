part of '../sidebar_panel.dart';

class _WorkspaceList extends StatelessWidget {
  const _WorkspaceList({
    required this.workspaces,
    required this.selectedWorkspace,
    required this.isLoading,
    required this.error,
    required this.onSelected,
    required this.onCreateWorkspace,
    required this.onCloneRepository,
    required this.isPreparingClone,
    this.collections = const [],
    this.selectedCollection,
    this.onCollectionSelected,
  });

  final List<Workspace> workspaces;
  final List<WorkspaceCollection> collections;
  final Workspace? selectedWorkspace;
  final WorkspaceCollection? selectedCollection;
  final bool isLoading;
  final String? error;
  final ValueChanged<Workspace> onSelected;
  final ValueChanged<WorkspaceCollection>? onCollectionSelected;
  final VoidCallback onCreateWorkspace;
  final VoidCallback onCloneRepository;
  final bool isPreparingClone;

  @override
  Widget build(BuildContext context) {
    if (workspaces.isEmpty) {
      if (isLoading) {
        return const _WorkspaceLoadingState();
      }
      if (error != null) {
        return _WorkspaceOfflineState(message: error!);
      }
      return _WorkspaceEmptyState(
        onCreateWorkspace: onCreateWorkspace,
        onCloneRepository: onCloneRepository,
        isPreparingClone: isPreparingClone,
      );
    }

    final groupedWorkspaceIds = collections
        .expand(
          (collection) =>
              collection.members.map((member) => member.workspaceId),
        )
        .toSet();
    final ungrouped = workspaces
        .where((workspace) => !groupedWorkspaceIds.contains(workspace.id))
        .toList(growable: false);
    final rows = <_WorkspaceListRow>[
      for (final collection in collections) ...[
        _WorkspaceListRow.collection(collection),
        for (final member in collection.members)
          _WorkspaceListRow.member(member),
      ],
      if (ungrouped.isNotEmpty && collections.isNotEmpty)
        const _WorkspaceListRow.header('UNGROUPED'),
      for (final workspace in ungrouped) _WorkspaceListRow.workspace(workspace),
    ];
    return Column(
      children: [
        if (isLoading || error != null)
          _WorkspaceStatusBanner(
            isLoading: isLoading,
            message: isLoading ? 'Refreshing workspaces...' : error!,
          ),
        Expanded(
          child: ListView.builder(
            addAutomaticKeepAlives: false,
            itemCount: rows.length,
            itemBuilder: (context, index) => _buildRow(context, rows[index]),
          ),
        ),
      ],
    );
  }

  Widget _buildRow(BuildContext context, _WorkspaceListRow row) {
    return switch (row.kind) {
      _WorkspaceListRowKind.collection => _SidebarTile(
        icon: Icons.account_tree_outlined,
        title: row.collection!.name,
        subtitle: '${row.collection!.members.length} projects',
        selected: row.collection!.id == selectedCollection?.id,
        onTap: onCollectionSelected == null
            ? null
            : () => onCollectionSelected!(row.collection!),
      ),
      _WorkspaceListRowKind.member => Padding(
        padding: const EdgeInsets.only(left: 16),
        child: _SidebarTile(
          icon: row.member!.role == 'primary'
              ? Icons.folder_special_outlined
              : Icons.folder_outlined,
          title: row.member!.workspace.name,
          subtitle: _workspaceSubtitle(row.member!.workspace),
          selected: row.member!.workspaceId == selectedWorkspace?.id,
          onTap: () => onSelected(row.member!.workspace),
        ),
      ),
      _WorkspaceListRowKind.header => Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
        child: Text(
          row.label!,
          style: TextStyle(
            color: AppColors.mutedText(context),
            fontSize: 11,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      _WorkspaceListRowKind.workspace => _SidebarTile(
        icon: Icons.folder,
        title: row.workspace!.name,
        subtitle: _workspaceSubtitle(row.workspace!),
        selected: row.workspace!.id == selectedWorkspace?.id,
        onTap: () => onSelected(row.workspace!),
      ),
    };
  }

  String _workspaceSubtitle(Workspace workspace) {
    return workspace.githubRepo.isEmpty
        ? workspace.localPath
        : workspace.githubRepo;
  }
}

enum _WorkspaceListRowKind { collection, member, header, workspace }

class _WorkspaceListRow {
  const _WorkspaceListRow.collection(WorkspaceCollection collection)
    : this._(kind: _WorkspaceListRowKind.collection, collection: collection);

  const _WorkspaceListRow.member(WorkspaceCollectionMember member)
    : this._(kind: _WorkspaceListRowKind.member, member: member);

  const _WorkspaceListRow.header(String label)
    : this._(kind: _WorkspaceListRowKind.header, label: label);

  const _WorkspaceListRow.workspace(Workspace workspace)
    : this._(kind: _WorkspaceListRowKind.workspace, workspace: workspace);

  const _WorkspaceListRow._({
    required this.kind,
    this.collection,
    this.member,
    this.label,
    this.workspace,
  });

  final _WorkspaceListRowKind kind;
  final WorkspaceCollection? collection;
  final WorkspaceCollectionMember? member;
  final String? label;
  final Workspace? workspace;
}

class _WorkspaceLoadingState extends StatelessWidget {
  const _WorkspaceLoadingState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 14),
            Text('Loading workspaces...'),
          ],
        ),
      ),
    );
  }
}

class _WorkspaceOfflineState extends StatelessWidget {
  const _WorkspaceOfflineState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.mutedText(context)),
        ),
      ),
    );
  }
}

class _WorkspaceStatusBanner extends StatelessWidget {
  const _WorkspaceStatusBanner({
    required this.isLoading,
    required this.message,
  });

  final bool isLoading;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(10, 0, 10, 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.field(context),
        border: Border.all(color: AppColors.line(context)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          if (isLoading)
            const SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else
            const Icon(Icons.cloud_off_outlined, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AppColors.secondaryText(context),
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _WorkspaceEmptyState extends StatelessWidget {
  const _WorkspaceEmptyState({
    required this.onCreateWorkspace,
    required this.onCloneRepository,
    required this.isPreparingClone,
  });

  final VoidCallback onCreateWorkspace;
  final VoidCallback onCloneRepository;
  final bool isPreparingClone;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: constraints.maxHeight > 32
                  ? constraints.maxHeight - 32
                  : 0,
            ),
            child: Center(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: AppColors.raised(context),
                  border: Border.all(color: AppColors.line(context)),
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.12),
                      blurRadius: 28,
                      offset: const Offset(0, 14),
                    ),
                  ],
                ),
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: AppColors.accent(
                              context,
                            ).withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: AppColors.accent(
                                context,
                              ).withValues(alpha: 0.26),
                            ),
                          ),
                          child: Icon(
                            Icons.account_tree_outlined,
                            color: AppColors.accent(context),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Start from GitHub',
                        style: TextStyle(
                          color: AppColors.primaryText(context),
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Clone a repository from GitHub to create the first ACT workspace.',
                        style: TextStyle(
                          color: AppColors.mutedText(context),
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 18),
                      _PrimaryWorkspaceAction(
                        onPressed: isPreparingClone ? null : onCloneRepository,
                        icon: Icons.download_outlined,
                        label: isPreparingClone
                            ? 'Opening GitHub...'
                            : 'Clone GitHub repo',
                        busy: isPreparingClone,
                      ),
                      const SizedBox(height: 10),
                      _SecondaryWorkspaceAction(
                        onPressed: onCreateWorkspace,
                        icon: Icons.create_new_folder_outlined,
                        label: 'Create empty workspace',
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _PrimaryWorkspaceAction extends StatelessWidget {
  const _PrimaryWorkspaceAction({
    required this.onPressed,
    required this.icon,
    required this.label,
    this.busy = false,
  });

  final VoidCallback? onPressed;
  final IconData icon;
  final String label;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return FilledButton.icon(
      onPressed: onPressed,
      icon: busy
          ? const SizedBox.square(
              dimension: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Icon(icon, size: 18),
      label: Text(label, overflow: TextOverflow.ellipsis),
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.accent(context),
        foregroundColor: const Color(0xFF02120D),
        minimumSize: const Size.fromHeight(46),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    );
  }
}

class _SecondaryWorkspaceAction extends StatelessWidget {
  const _SecondaryWorkspaceAction({
    required this.onPressed,
    required this.icon,
    required this.label,
  });

  final VoidCallback onPressed;
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 18),
      label: Text(label, overflow: TextOverflow.ellipsis),
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primaryText(context),
        minimumSize: const Size.fromHeight(46),
        side: BorderSide(
          color: AppColors.accent(context).withValues(alpha: 0.45),
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    );
  }
}
