part of '../task_panel.dart';
// ignore_for_file: invalid_use_of_protected_member

extension _TaskDetailActions on _TaskDetailViewState {
  Future<void> _save() async {
    final title = _titleController.text.trim();
    final workspaceIds = _workspaceIds.toList(growable: false);
    if (title.isEmpty) {
      setState(() => _titleError = 'Task title is required');
      return;
    }
    if (workspaceIds.isEmpty) {
      setState(() => _workspaceError = 'Select at least one project');
      return;
    }
    setState(() => _isSaving = true);
    try {
      await widget.onUpdateTask(
        widget.task,
        TaskUpdateDraft(
          title: title,
          description: _descriptionController.text.trim(),
          workspaceIds: workspaceIds,
          collectionIds: _collectionIds.toList(growable: false),
          finalReportInstructions: _reportController.text.trim(),
          executionMode: _executionMode,
          approvalMode: _approvalMode,
          evidencePreference: _evidencePreference,
          agentProvider: _agentProvider,
          providerModel: _providerModelForAgent(_agentProvider),
          providerThinkingLevel: _providerThinkingLevelForAgent(_agentProvider),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  Future<void> _run() async {
    setState(() => _isRunning = true);
    try {
      await widget.onRunTask(widget.task);
    } finally {
      if (mounted) {
        setState(() => _isRunning = false);
      }
    }
  }

  Future<void> _clone() async {
    setState(() => _isCloning = true);
    try {
      await widget.onCloneTask(widget.task);
    } finally {
      if (mounted) {
        setState(() => _isCloning = false);
      }
    }
  }

  Future<void> _finalize(NativeTaskRun run) async {
    setState(() => _isFinalizing = true);
    try {
      await widget.onFinalizeRun(widget.task, run);
    } finally {
      if (mounted) {
        setState(() => _isFinalizing = false);
      }
    }
  }

  Future<void> _createPullRequests(NativeTaskRun run) async {
    setState(() => _isCreatingPrs = true);
    try {
      await widget.onCreatePullRequests(widget.task, run);
    } finally {
      if (mounted) {
        setState(() => _isCreatingPrs = false);
      }
    }
  }

  void _setWorkspaceSelected(String workspaceId, bool selected) {
    setState(() {
      if (selected) {
        _workspaceIds = {..._workspaceIds, workspaceId};
      } else {
        _workspaceIds = {
          for (final id in _workspaceIds)
            if (id != workspaceId) id,
        };
      }
      _workspaceError = null;
    });
  }

  void _setCollectionSelected(WorkspaceCollection collection, bool selected) {
    setState(() {
      if (selected) {
        _collectionIds = {..._collectionIds, collection.id};
        _workspaceIds = {
          ..._workspaceIds,
          ...collection.members.map((member) => member.workspaceId),
        };
      } else {
        _collectionIds = {
          for (final id in _collectionIds)
            if (id != collection.id) id,
        };
      }
      _workspaceError = null;
    });
  }

  String _formatBytes(int bytes) {
    if (bytes >= 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    if (bytes >= 1024) {
      return '${(bytes / 1024).toStringAsFixed(1)} KB';
    }
    return '$bytes B';
  }

  String _providerModelForAgent(String agentProvider) {
    if (CodingAgents.normalize(agentProvider) ==
        CodingAgents.normalize(widget.task.agentProvider)) {
      return widget.task.providerModel ?? '';
    }
    return CodingAgents.byId(agentProvider).defaultModel;
  }

  String _providerThinkingLevelForAgent(String agentProvider) {
    if (CodingAgents.normalize(agentProvider) ==
        CodingAgents.normalize(widget.task.agentProvider)) {
      return widget.task.providerThinkingLevel ?? '';
    }
    return CodingAgents.byId(agentProvider).defaultThinkingLevel;
  }
}

bool _prRequested(NativeTaskRun run) {
  return run.executionMode == 'implement_and_pr' ||
      run.approvalMode == 'auto_edit_and_create_pr';
}

bool _taskCanEdit(NativeTask task) {
  final status = task.status.toLowerCase();
  return task.runs.isEmpty && (status == 'ready' || status == 'draft');
}

bool _taskCanRun(NativeTask task) {
  return _taskCanEdit(task) && !_taskRunActive(task);
}

bool _taskCanFinalize(NativeTask task, NativeTaskRun run) {
  final taskStatus = task.status.toLowerCase();
  final runStatus = run.status.toLowerCase();
  if (_activeTaskStatus(taskStatus) || _activeTaskStatus(runStatus)) {
    return false;
  }
  final hasReport = run.finalReport?.trim().isNotEmpty == true;
  final hasArtifacts = run.artifacts.isNotEmpty;
  return runStatus == 'completed' && (!hasReport || !hasArtifacts);
}

bool _taskCanCreatePullRequests(NativeTaskRun run) {
  if (!_prRequested(run) || _activeTaskStatus(run.status.toLowerCase())) {
    return false;
  }
  return run.pullRequests.isEmpty ||
      run.pullRequests.any(
        (pr) => !const {
          'created',
          'updated',
          'unchanged',
        }.contains(pr.action.isEmpty ? pr.state : pr.action),
      );
}

bool _runnerReadyForAgent(RunnerReadiness? readiness, String provider) {
  if (readiness == null) {
    return false;
  }
  final commonBlockers = readiness.blockedReasons.where(
    (reason) => reason != 'Codex is not logged in',
  );
  if (commonBlockers.isNotEmpty) {
    return false;
  }
  if (provider == 'pi') {
    return !readiness.piStatus.toLowerCase().startsWith('unavailable');
  }
  return readiness.codexLoginStatus.toLowerCase().contains('logged in');
}
