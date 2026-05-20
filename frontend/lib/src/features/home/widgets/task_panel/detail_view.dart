part of '../task_panel.dart';
// ignore_for_file: invalid_use_of_protected_member

class _TaskDetailView extends StatefulWidget {
  const _TaskDetailView({
    required this.task,
    required this.ready,
    required this.availableWorkspaces,
    required this.availableCollections,
    required this.onBack,
    required this.onRunTask,
    required this.onUpdateTask,
    required this.onOpenCodexSession,
    required this.onLoadArtifact,
    required this.onFinalizeRun,
    required this.onCreatePullRequests,
    required this.onCloneTask,
    super.key,
  });

  final NativeTask task;
  final bool ready;
  final List<Workspace> availableWorkspaces;
  final List<WorkspaceCollection> availableCollections;
  final VoidCallback onBack;
  final TaskRunCallback onRunTask;
  final TaskUpdateCallback onUpdateTask;
  final ValueChanged<String> onOpenCodexSession;
  final TaskArtifactLoadCallback onLoadArtifact;
  final TaskRunActionCallback onFinalizeRun;
  final TaskRunActionCallback onCreatePullRequests;
  final TaskCloneCallback onCloneTask;

  @override
  State<_TaskDetailView> createState() => _TaskDetailViewState();
}

class _TaskDetailViewState extends State<_TaskDetailView> {
  late final TextEditingController _titleController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _reportController;
  late Set<String> _workspaceIds;
  late Set<String> _collectionIds;
  late String _executionMode;
  late String _approvalMode;
  late String _evidencePreference;
  late String _agentProvider;
  String? _titleError;
  String? _workspaceError;
  bool _isSaving = false;
  bool _isRunning = false;
  bool _isFinalizing = false;
  bool _isCreatingPrs = false;
  bool _isCloning = false;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.task.title);
    _descriptionController = TextEditingController(
      text: widget.task.description,
    );
    _reportController = TextEditingController(
      text: widget.task.finalReportInstructions ?? '',
    );
    _workspaceIds = widget.task.workspaces
        .map((workspace) => workspace.workspaceId)
        .toSet();
    _collectionIds = widget.task.sourceCollections
        .map((collection) => collection.collectionId)
        .where((id) => id.isNotEmpty)
        .toSet();
    _executionMode = widget.task.executionMode;
    _approvalMode = widget.task.approvalMode;
    _evidencePreference = widget.task.evidencePreference;
    _agentProvider = CodingAgents.normalize(widget.task.agentProvider);
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _reportController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final latestRun = widget.task.latestRun;
    final activeRun = _taskRunActive(widget.task);
    final canEdit = _taskCanEdit(widget.task);
    final canRun = _taskCanRun(widget.task) && widget.ready && !_isRunning;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 6),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: AppColors.line(context))),
          ),
          child: Row(
            children: [
              IconButton(
                tooltip: 'Back to tasks',
                onPressed: widget.onBack,
                icon: const Icon(Icons.arrow_back, size: 19),
              ),
              Expanded(
                child: Text(
                  widget.task.title,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
              IconButton(
                tooltip: canEdit
                    ? (activeRun ? 'Task is already running' : 'Run task')
                    : 'Clone task',
                onPressed: canEdit
                    ? (canRun ? _run : null)
                    : (_isCloning ? null : _clone),
                icon: (_isRunning || activeRun || _isCloning)
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        canEdit ? Icons.play_arrow : Icons.copy_all,
                        size: 20,
                      ),
              ),
            ],
          ),
        ),
        Expanded(
          child: _buildDetailScroll(latestRun: latestRun, canEdit: canEdit),
        ),
        Container(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
          decoration: BoxDecoration(
            color: AppColors.chrome(context),
            border: Border(top: BorderSide(color: AppColors.line(context))),
          ),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isSaving ? null : widget.onBack,
                  icon: const Icon(Icons.list, size: 18),
                  label: const Text('List'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: canEdit
                      ? (_isSaving || activeRun ? null : _save)
                      : (_isCloning ? null : _clone),
                  icon: (_isSaving || _isCloning)
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(canEdit ? Icons.save : Icons.copy_all, size: 18),
                  label: Text(
                    !canEdit
                        ? (_isCloning ? 'Cloning' : 'Clone')
                        : activeRun && !_isSaving
                        ? 'Running'
                        : _isSaving
                        ? 'Saving'
                        : 'Save',
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
