part of '../act_home_page.dart';
// ignore_for_file: invalid_use_of_protected_member

class _DialogHeader extends StatelessWidget {
  const _DialogHeader({required this.onClose});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
      child: Row(
        children: [
          Icon(Icons.task_alt, color: AppColors.accent(context)),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'New ACT task',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
            ),
          ),
          IconButton(
            tooltip: 'Close',
            onPressed: onClose,
            icon: const Icon(Icons.close),
          ),
        ],
      ),
    );
  }
}

class _WorkspacePicker extends StatefulWidget {
  const _WorkspacePicker({
    required this.collections,
    required this.selectedCollectionIds,
    required this.workspaces,
    required this.selectedWorkspaceIds,
    required this.errorText,
    required this.onToggled,
    required this.onCollectionToggled,
  });

  final List<WorkspaceCollection> collections;
  final Set<String> selectedCollectionIds;
  final List<Workspace> workspaces;
  final Set<String> selectedWorkspaceIds;
  final String? errorText;
  final void Function(Workspace workspace, bool selected) onToggled;
  final void Function(WorkspaceCollection collection, bool selected)
  onCollectionToggled;

  @override
  State<_WorkspacePicker> createState() => _WorkspacePickerState();
}

class _WorkspacePickerState extends State<_WorkspacePicker> {
  static const _maxVisibleProjects = 24;

  String _query = '';

  @override
  Widget build(BuildContext context) {
    final errorColor = Theme.of(context).colorScheme.error;
    final selected = widget.workspaces
        .where(
          (workspace) => widget.selectedWorkspaceIds.contains(workspace.id),
        )
        .toList(growable: false);
    final matching = widget.workspaces
        .where(
          (workspace) =>
              !widget.selectedWorkspaceIds.contains(workspace.id) &&
              _matchesWorkspace(workspace, _query),
        )
        .take(_maxVisibleProjects)
        .toList(growable: false);
    final totalMatching = widget.workspaces
        .where(
          (workspace) =>
              !widget.selectedWorkspaceIds.contains(workspace.id) &&
              _matchesWorkspace(workspace, _query),
        )
        .length;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.accent(context).withValues(alpha: 0.11),
        border: Border.all(
          color: widget.errorText == null
              ? AppColors.line(context)
              : errorColor,
        ),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.folder_copy, color: AppColors.accent(context)),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Projects',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
              _ProjectCountPill(count: widget.selectedWorkspaceIds.length),
            ],
          ),
          if (widget.collections.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'Collections',
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
                for (final collection in widget.collections)
                  FilterChip(
                    avatar: const Icon(Icons.account_tree_outlined, size: 16),
                    label: Text(collection.name),
                    selected: widget.selectedCollectionIds.contains(
                      collection.id,
                    ),
                    onSelected: (selected) =>
                        widget.onCollectionToggled(collection, selected),
                  ),
              ],
            ),
          ],
          const SizedBox(height: 8),
          TextField(
            key: const ValueKey('create-task-project-search'),
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              labelText: 'Search projects',
            ),
            onChanged: (value) => setState(() => _query = value),
          ),
          if (selected.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'Selected',
              style: TextStyle(
                color: AppColors.secondaryText(context),
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
          ],
          for (final workspace in selected)
            _ProjectChoiceTile(
              key: ValueKey('create-project-choice-${workspace.id}'),
              workspace: workspace,
              selected: true,
              onChanged: (selected) => widget.onToggled(workspace, selected),
            ),
          const SizedBox(height: 8),
          Text(
            _query.trim().isEmpty ? 'Available projects' : 'Matching projects',
            style: TextStyle(
              color: AppColors.secondaryText(context),
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          for (final workspace in matching)
            _ProjectChoiceTile(
              key: ValueKey('create-project-choice-${workspace.id}'),
              workspace: workspace,
              selected: false,
              onChanged: (selected) => widget.onToggled(workspace, selected),
            ),
          if (matching.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Text(
                _query.trim().isEmpty
                    ? 'No more projects available.'
                    : 'No projects match that search.',
                style: TextStyle(
                  color: AppColors.mutedText(context),
                  fontSize: 12,
                ),
              ),
            ),
          if (totalMatching > matching.length)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Showing ${matching.length} of $totalMatching. Search to narrow.',
                style: TextStyle(
                  color: AppColors.mutedText(context),
                  fontSize: 12,
                ),
              ),
            ),
          if (widget.errorText != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                widget.errorText!,
                style: TextStyle(color: errorColor, fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }

  bool _matchesWorkspace(Workspace workspace, String query) {
    final normalized = query.trim().toLowerCase();
    if (normalized.isEmpty) {
      return true;
    }
    return workspace.name.toLowerCase().contains(normalized) ||
        workspace.githubRepo.toLowerCase().contains(normalized) ||
        workspace.localPath.toLowerCase().contains(normalized);
  }
}

class _ProjectCountPill extends StatelessWidget {
  const _ProjectCountPill({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.accent(context).withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        child: Text(
          '$count selected',
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
        ),
      ),
    );
  }
}

class _ProjectChoiceTile extends StatelessWidget {
  const _ProjectChoiceTile({
    required this.workspace,
    required this.selected,
    required this.onChanged,
    super.key,
  });

  final Workspace workspace;
  final bool selected;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final subtitle = workspace.githubRepo.isNotEmpty
        ? workspace.githubRepo
        : workspace.localPath;
    return Material(
      color: selected
          ? AppColors.accent(context).withValues(alpha: 0.12)
          : Colors.transparent,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => onChanged(!selected),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 6),
          child: Row(
            children: [
              Checkbox(
                value: selected,
                onChanged: (value) => onChanged(value ?? false),
              ),
              const SizedBox(width: 4),
              Icon(Icons.folder, color: AppColors.accent(context)),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      workspace.name,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.secondaryText(context),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
