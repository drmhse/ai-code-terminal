part of '../task_panel.dart';

class _TaskList extends StatelessWidget {
  const _TaskList({
    required this.tasks,
    required this.selectedTask,
    required this.isLoading,
    required this.readiness,
    required this.onTaskSelected,
    required this.onRunTask,
  });

  final List<NativeTask> tasks;
  final NativeTask? selectedTask;
  final bool isLoading;
  final RunnerReadiness? readiness;
  final ValueChanged<NativeTask> onTaskSelected;
  final TaskRunCallback onRunTask;

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (tasks.isEmpty) {
      return const _EmptyState(label: 'No ACT tasks');
    }
    return ListView.separated(
      padding: const EdgeInsets.all(10),
      itemCount: tasks.length,
      separatorBuilder: (_, _) =>
          Divider(height: 1, color: AppColors.line(context)),
      itemBuilder: (context, index) {
        final task = tasks[index];
        return _TaskTile(
          task: task,
          ready: _runnerReadyForAgent(readiness, task.agentProvider),
          selected: task.id == selectedTask?.id,
          onSelected: () => onTaskSelected(task),
          onRun: () => onRunTask(task),
        );
      },
    );
  }
}
