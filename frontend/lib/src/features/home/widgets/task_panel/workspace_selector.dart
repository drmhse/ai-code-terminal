part of '../task_panel.dart';
// ignore_for_file: invalid_use_of_protected_member

class _TaskWorkspaceSelector extends StatefulWidget {
  const _TaskWorkspaceSelector({
    required this.availableCollections,
    required this.availableWorkspaces,
    required this.taskWorkspaces,
    required this.selectedWorkspaceIds,
    required this.selectedCollectionIds,
    required this.errorText,
    required this.enabled,
    required this.onChanged,
    required this.onCollectionChanged,
  });

  final List<WorkspaceCollection> availableCollections;
  final List<Workspace> availableWorkspaces;
  final List<NativeTaskWorkspace> taskWorkspaces;
  final Set<String> selectedWorkspaceIds;
  final Set<String> selectedCollectionIds;
  final String? errorText;
  final bool enabled;
  final void Function(String workspaceId, bool selected) onChanged;
  final void Function(WorkspaceCollection collection, bool selected)
  onCollectionChanged;

  @override
  State<_TaskWorkspaceSelector> createState() => _TaskWorkspaceSelectorState();
}

class _TaskWorkspaceSelectorState extends State<_TaskWorkspaceSelector> {
  static const _maxVisibleProjects = 24;

  String _query = '';

  @override
  Widget build(BuildContext context) {
    final errorColor = Theme.of(context).colorScheme.error;
    final choices = _workspaceChoices();
    final selected = choices
        .where((choice) => widget.selectedWorkspaceIds.contains(choice.id))
        .toList(growable: false);
    final matching = choices
        .where(
          (choice) =>
              !widget.selectedWorkspaceIds.contains(choice.id) &&
              _matchesChoice(choice, _query),
        )
        .take(_maxVisibleProjects)
        .toList(growable: false);
    final totalMatching = choices
        .where(
          (choice) =>
              !widget.selectedWorkspaceIds.contains(choice.id) &&
              _matchesChoice(choice, _query),
        )
        .length;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
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
              const Icon(Icons.folder_copy, size: 18),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Projects',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
              Text(
                '${widget.selectedWorkspaceIds.length} selected',
                style: TextStyle(
                  color: AppColors.secondaryText(context),
                  fontSize: 12,
                ),
              ),
            ],
          ),
          if (widget.availableCollections.isNotEmpty) ...[
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
                for (final collection in widget.availableCollections)
                  FilterChip(
                    avatar: const Icon(Icons.account_tree_outlined, size: 16),
                    label: Text(collection.name),
                    selected: widget.selectedCollectionIds.contains(
                      collection.id,
                    ),
                    onSelected: widget.enabled
                        ? (selected) =>
                              widget.onCollectionChanged(collection, selected)
                        : null,
                  ),
              ],
            ),
          ],
          const SizedBox(height: 8),
          TextField(
            key: const ValueKey('task-detail-project-search'),
            enabled: widget.enabled,
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
          for (final choice in selected)
            _WorkspaceChoiceTile(
              key: ValueKey('task-project-choice-${choice.id}'),
              choice: choice,
              selected: true,
              onChanged: widget.enabled
                  ? (selected) => widget.onChanged(choice.id, selected)
                  : null,
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
          for (final choice in matching)
            _WorkspaceChoiceTile(
              key: ValueKey('task-project-choice-${choice.id}'),
              choice: choice,
              selected: false,
              onChanged: widget.enabled
                  ? (selected) => widget.onChanged(choice.id, selected)
                  : null,
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

  List<_WorkspaceChoice> _workspaceChoices() {
    final choices = <_WorkspaceChoice>[];
    final seen = <String>{};
    for (final workspace in widget.availableWorkspaces) {
      if (seen.add(workspace.id)) {
        choices.add(
          _WorkspaceChoice(
            workspace.id,
            workspace.name,
            workspace.githubRepo.isNotEmpty
                ? workspace.githubRepo
                : workspace.localPath,
          ),
        );
      }
    }
    for (final workspace in widget.taskWorkspaces) {
      if (seen.add(workspace.workspaceId)) {
        choices.add(
          _WorkspaceChoice(
            workspace.workspaceId,
            workspace.name,
            workspace.remote?.isNotEmpty == true
                ? workspace.remote!
                : workspace.path,
          ),
        );
      }
    }
    return choices;
  }

  bool _matchesChoice(_WorkspaceChoice choice, String query) {
    final normalized = query.trim().toLowerCase();
    if (normalized.isEmpty) {
      return true;
    }
    return choice.name.toLowerCase().contains(normalized) ||
        choice.subtitle.toLowerCase().contains(normalized);
  }
}

class _WorkspaceChoice {
  const _WorkspaceChoice(this.id, this.name, this.subtitle);

  final String id;
  final String name;
  final String subtitle;
}

class _WorkspaceChoiceTile extends StatelessWidget {
  const _WorkspaceChoiceTile({
    required this.choice,
    required this.selected,
    required this.onChanged,
    super.key,
  });

  final _WorkspaceChoice choice;
  final bool selected;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: CheckboxListTile(
        dense: true,
        contentPadding: EdgeInsets.zero,
        value: selected,
        onChanged: onChanged == null
            ? null
            : (value) => onChanged!(value ?? false),
        title: Text(
          choice.name,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          choice.subtitle,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 12),
        ),
      ),
    );
  }
}
