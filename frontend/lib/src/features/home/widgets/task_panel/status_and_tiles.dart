part of '../task_panel.dart';

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 86,
            child: Text(
              label,
              style: TextStyle(
                color: AppColors.mutedText(context),
                fontSize: 12,
              ),
            ),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 12))),
        ],
      ),
    );
  }
}

class _ReadinessStrip extends StatelessWidget {
  const _ReadinessStrip({required this.readiness});

  final RunnerReadiness readiness;

  @override
  Widget build(BuildContext context) {
    final color = readiness.ready
        ? AppColors.success(context)
        : AppColors.warning(context);
    final detail = readiness.ready
        ? '${readiness.runnerMode} / ${readiness.availableDiskGb}GB free'
        : readiness.blockedReasons.join(' / ');
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        border: Border(bottom: BorderSide(color: AppColors.line(context))),
      ),
      child: Text(
        detail.isEmpty ? readiness.codexLoginStatus : detail,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(color: AppColors.primaryText(context), fontSize: 12),
      ),
    );
  }
}

class _TaskTile extends StatelessWidget {
  const _TaskTile({
    required this.task,
    required this.ready,
    required this.selected,
    required this.onSelected,
    required this.onRun,
  });

  final NativeTask task;
  final bool ready;
  final bool selected;
  final VoidCallback onSelected;
  final VoidCallback onRun;

  @override
  Widget build(BuildContext context) {
    final run = task.latestRun;
    final activeRun = _taskRunActive(task);
    final canRun = ready && _taskCanRun(task);
    return Material(
      color: selected
          ? AppColors.accent(context).withValues(alpha: 0.14)
          : Colors.transparent,
      child: ListTile(
        dense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 6),
        leading: Icon(
          _taskStatusIcon(task.status),
          color: _statusColor(context, task.status),
          size: 19,
        ),
        title: Text(task.title, overflow: TextOverflow.ellipsis),
        subtitle: Text(
          [
            CodingAgents.byId(task.agentProvider).label,
            task.executionMode.replaceAll('_', ' '),
            task.workspaces.map((workspace) => workspace.name).join(', '),
            if (run != null) run.status,
          ].where((part) => part.trim().isNotEmpty).join(' / '),
          overflow: TextOverflow.ellipsis,
        ),
        trailing: _TaskTileTrailing(
          activeRun: activeRun,
          canRun: canRun,
          onRun: onRun,
        ),
        onTap: onSelected,
      ),
    );
  }
}

class _TaskTileTrailing extends StatelessWidget {
  const _TaskTileTrailing({
    required this.activeRun,
    required this.canRun,
    required this.onRun,
  });

  final bool activeRun;
  final bool canRun;
  final VoidCallback onRun;

  @override
  Widget build(BuildContext context) {
    if (activeRun) {
      return const SizedBox(
        width: 40,
        child: Center(
          child: SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }
    if (!canRun) {
      return const SizedBox(width: 40);
    }
    return IconButton(
      tooltip: 'Run task',
      onPressed: onRun,
      icon: const Icon(Icons.play_arrow, size: 18),
    );
  }
}

IconData _taskStatusIcon(String status) {
  return switch (status) {
    'done' || 'completed' || 'awaiting_feedback' => Icons.check_circle,
    'running' => Icons.play_circle,
    'needs_attention' => Icons.error_outline,
    'archived' => Icons.archive_outlined,
    _ => Icons.radio_button_unchecked,
  };
}

Color _statusColor(BuildContext context, String status) {
  return switch (status) {
    'done' || 'completed' || 'awaiting_feedback' => AppColors.success(context),
    'running' => AppColors.accent(context),
    'needs_attention' => AppColors.warning(context),
    _ => AppColors.mutedText(context),
  };
}

bool _taskRunActive(NativeTask task) {
  final status = task.status.toLowerCase();
  final runStatus = task.latestRun?.status.toLowerCase();
  return _activeTaskStatus(status) ||
      (runStatus != null && _activeTaskStatus(runStatus));
}

bool _activeTaskStatus(String status) {
  return status == 'queued' ||
      status == 'starting' ||
      status == 'running' ||
      status == 'finalizing' ||
      status == 'interrupting';
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.accent(context).withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        message,
        style: TextStyle(color: AppColors.primaryText(context), fontSize: 12),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(label, style: TextStyle(color: AppColors.mutedText(context))),
    );
  }
}
