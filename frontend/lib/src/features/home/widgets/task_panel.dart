import 'dart:convert';

import 'package:act_frontend/src/app/app_colors.dart';
import 'package:act_frontend/src/models/coding_agent.dart';
import 'package:act_frontend/src/models/native_task.dart';
import 'package:act_frontend/src/models/workspace.dart';
import 'package:act_frontend/src/models/workspace_collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

part 'task_panel/scope.dart';
part 'task_panel/task_list.dart';
part 'task_panel/detail_view.dart';
part 'task_panel/detail_scroll.dart';
part 'task_panel/detail_actions.dart';
part 'task_panel/headers.dart';
part 'task_panel/workspace_selector.dart';
part 'task_panel/editors.dart';
part 'task_panel/artifacts.dart';
part 'task_panel/status_and_tiles.dart';

typedef TaskRunCallback = Future<void> Function(NativeTask task);
typedef TaskUpdateCallback =
    Future<void> Function(NativeTask task, TaskUpdateDraft draft);
typedef TaskArtifactLoadCallback =
    Future<NativeTaskArtifactContent> Function(
      NativeTask task,
      NativeTaskRun run,
      NativeTaskArtifact artifact,
    );
typedef TaskRunActionCallback =
    Future<void> Function(NativeTask task, NativeTaskRun run);
typedef TaskCloneCallback = Future<void> Function(NativeTask task);
typedef TaskScopeChangedCallback =
    void Function(String? scopeType, String? scopeId);

class TaskUpdateDraft {
  const TaskUpdateDraft({
    required this.title,
    required this.description,
    required this.workspaceIds,
    this.collectionIds = const [],
    required this.finalReportInstructions,
    required this.executionMode,
    required this.approvalMode,
    required this.evidencePreference,
    required this.agentProvider,
    required this.providerModel,
    required this.providerThinkingLevel,
  });

  final String title;
  final String description;
  final List<String> workspaceIds;
  final List<String> collectionIds;
  final String finalReportInstructions;
  final String executionMode;
  final String approvalMode;
  final String evidencePreference;
  final String agentProvider;
  final String providerModel;
  final String providerThinkingLevel;
}

class TaskPanel extends StatelessWidget {
  const TaskPanel({
    required this.readiness,
    required this.availableWorkspaces,
    required this.tasks,
    required this.selectedTask,
    required this.isLoading,
    required this.executionStatus,
    required this.onRefresh,
    required this.onTaskCleared,
    required this.onTaskSelected,
    required this.onRunTask,
    required this.onUpdateTask,
    required this.onOpenCodexSession,
    required this.onLoadArtifact,
    required this.onFinalizeRun,
    required this.onCreatePullRequests,
    required this.onCloneTask,
    required this.onCreateTask,
    this.availableCollections = const [],
    this.selectedCollection,
    this.taskScopeType,
    this.taskScopeId,
    this.onTaskScopeChanged,
    this.showHeader = true,
    this.agentProvider = 'codex',
    super.key,
  });

  final RunnerReadiness? readiness;
  final List<Workspace> availableWorkspaces;
  final List<WorkspaceCollection> availableCollections;
  final WorkspaceCollection? selectedCollection;
  final String? taskScopeType;
  final String? taskScopeId;
  final bool showHeader;
  final String agentProvider;
  final List<NativeTask> tasks;
  final NativeTask? selectedTask;
  final bool isLoading;
  final String? executionStatus;
  final VoidCallback onRefresh;
  final TaskScopeChangedCallback? onTaskScopeChanged;
  final VoidCallback onTaskCleared;
  final ValueChanged<NativeTask> onTaskSelected;
  final TaskRunCallback onRunTask;
  final TaskUpdateCallback onUpdateTask;
  final ValueChanged<String> onOpenCodexSession;
  final TaskArtifactLoadCallback onLoadArtifact;
  final TaskRunActionCallback onFinalizeRun;
  final TaskRunActionCallback onCreatePullRequests;
  final TaskCloneCallback onCloneTask;
  final VoidCallback onCreateTask;

  @override
  Widget build(BuildContext context) {
    final defaultReady = _runnerReadyForAgent(readiness, agentProvider);
    return Container(
      color: AppColors.chrome(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (showHeader)
            _Header(
              ready: defaultReady,
              isLoading: isLoading,
              onRefresh: onRefresh,
              onCreateTask: onCreateTask,
            ),
          if (readiness != null) _ReadinessStrip(readiness: readiness!),
          if (executionStatus != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
              child: _StatusPill(message: executionStatus!),
            ),
          if (selectedTask == null)
            _TaskScopeBar(
              workspaces: availableWorkspaces,
              collections: availableCollections,
              scopeType: taskScopeType,
              scopeId: taskScopeId,
              taskCount: tasks.length,
              onScopeChanged: onTaskScopeChanged ?? (_, _) {},
            ),
          Expanded(
            child: selectedTask == null
                ? _TaskList(
                    tasks: tasks,
                    selectedTask: selectedTask,
                    isLoading: isLoading,
                    readiness: readiness,
                    onTaskSelected: onTaskSelected,
                    onRunTask: onRunTask,
                  )
                : _TaskDetailView(
                    key: ValueKey(selectedTask!.id),
                    task: selectedTask!,
                    ready: _runnerReadyForAgent(
                      readiness,
                      selectedTask!.agentProvider,
                    ),
                    availableWorkspaces: availableWorkspaces,
                    availableCollections: availableCollections,
                    onBack: onTaskCleared,
                    onRunTask: onRunTask,
                    onUpdateTask: onUpdateTask,
                    onOpenCodexSession: onOpenCodexSession,
                    onLoadArtifact: onLoadArtifact,
                    onFinalizeRun: onFinalizeRun,
                    onCreatePullRequests: onCreatePullRequests,
                    onCloneTask: onCloneTask,
                  ),
          ),
        ],
      ),
    );
  }
}
