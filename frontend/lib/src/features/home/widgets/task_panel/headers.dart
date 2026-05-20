part of '../task_panel.dart';

class _Header extends StatelessWidget {
  const _Header({
    required this.ready,
    required this.isLoading,
    required this.onRefresh,
    required this.onCreateTask,
  });

  final bool ready;
  final bool isLoading;
  final VoidCallback onRefresh;
  final VoidCallback onCreateTask;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.line(context))),
      ),
      child: Row(
        children: [
          Icon(
            ready ? Icons.task_alt : Icons.admin_panel_settings_outlined,
            size: 18,
            color: ready
                ? AppColors.accent(context)
                : AppColors.warning(context),
          ),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'ACT Tasks',
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          IconButton(
            tooltip: 'Refresh tasks',
            onPressed: isLoading ? null : onRefresh,
            icon: const Icon(Icons.refresh, size: 18),
          ),
          IconButton(
            tooltip: 'New task',
            onPressed: onCreateTask,
            icon: const Icon(Icons.add_task, size: 18),
          ),
        ],
      ),
    );
  }
}

class _TaskStatusHeader extends StatelessWidget {
  const _TaskStatusHeader({required this.task});

  final NativeTask task;

  @override
  Widget build(BuildContext context) {
    final latestRun = task.latestRun;
    final activeRun = _taskRunActive(task);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.accent(context).withValues(alpha: 0.10),
        border: Border.all(color: AppColors.line(context)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              activeRun
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(
                      Icons.task_alt,
                      color: _statusColor(context, task.status),
                    ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  task.status.replaceAll('_', ' '),
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _DetailRow(
            label: 'Projects',
            value: task.workspaces
                .map((workspace) => workspace.name)
                .join(', '),
          ),
          _DetailRow(
            label: 'Agent',
            value: CodingAgents.byId(task.agentProvider).label,
          ),
          _DetailRow(
            label: 'Latest run',
            value: latestRun?.status ?? 'Not started',
          ),
        ],
      ),
    );
  }
}
