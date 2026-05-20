part of '../act_home_page.dart';
// ignore_for_file: invalid_use_of_protected_member

extension _ActHomeCreateTaskLauncher on _ActHomePageState {
  Future<void> _showCreateTaskDialog() async {
    final workspace = _selectedWorkspace;
    final collection = _selectedCollection;
    if (workspace == null && collection == null) {
      return;
    }

    final composer = _CreateTaskDialog(
      workspace: workspace,
      workspaces: _workspaces,
      collections: _collections,
      selectedCollection: collection,
      readiness: _runnerReadiness,
      initialAgentProvider: _selectedAgentProvider,
      initialProviderModel: _selectedProviderModel,
      initialProviderThinkingLevel: _selectedProviderThinkingLevel,
    );
    final isMobile = MediaQuery.sizeOf(context).width < 760;
    final Future<_CreateTaskDraft?> draftFuture;
    if (isMobile) {
      draftFuture = Navigator.of(context).push<_CreateTaskDraft>(
        MaterialPageRoute(fullscreenDialog: true, builder: (_) => composer),
      );
    } else {
      draftFuture = showDialog<_CreateTaskDraft>(
        context: context,
        builder: (_) => composer,
      );
    }
    final draft = await draftFuture;

    if (!mounted || draft == null) {
      return;
    }

    NativeTask? createdTask;
    try {
      createdTask = await _api.createNativeTask(
        title: draft.title,
        description: draft.description.isEmpty
            ? draft.title
            : draft.description,
        workspaceIds: draft.workspaceIds,
        collectionIds: draft.collectionIds,
        finalReportInstructions: draft.finalReportInstructions,
        executionMode: draft.executionMode,
        approvalMode: draft.approvalMode,
        evidencePreference: draft.evidencePreference,
        agentProvider: draft.agentProvider,
        providerModel: draft.providerModel,
        providerThinkingLevel: draft.providerThinkingLevel,
      );
      final failedUploads = <String>[];
      for (final attachment in draft.attachments) {
        try {
          await _api.uploadNativeTaskAttachment(
            taskId: createdTask.id,
            originalFilename: attachment.name,
            contentType: attachment.contentType,
            bytes: attachment.bytes,
          );
        } catch (_) {
          failedUploads.add(attachment.name);
        }
      }
      await _refreshTasksForWorkspace(_selectedWorkspace);
      if (!mounted) {
        return;
      }
      setState(() {
        _selectedTask = _tasks.cast<NativeTask?>().firstWhere(
          (task) => task?.id == createdTask?.id,
          orElse: () => createdTask,
        );
        if (failedUploads.isEmpty) {
          _statusMessage = 'Created ${createdTask?.title ?? 'task'}';
        } else {
          _statusMessage =
              'Created ${createdTask?.title ?? 'task'}, but failed to upload: ${failedUploads.join(', ')}';
        }
      });
    } catch (error) {
      if (createdTask == null) {
        setState(() => _statusMessage = 'Task creation failed: $error');
      } else {
        await _refreshTasksForWorkspace(_selectedWorkspace);
        if (mounted) {
          setState(
            () => _statusMessage =
                'Created ${createdTask?.title ?? 'task'}, but attachment upload failed: $error',
          );
        }
      }
    }
  }

  bool _taskMatchesScope(
    NativeTask task, {
    Workspace? workspace,
    WorkspaceCollection? collection,
  }) {
    if (collection != null) {
      final collectionWorkspaceIds = collection.members
          .map((member) => member.workspaceId)
          .where((id) => id.isNotEmpty)
          .toSet();
      return task.sourceCollections.any(
            (source) => source.collectionId == collection.id,
          ) ||
          task.workspaces.any(
            (taskWorkspace) =>
                collectionWorkspaceIds.contains(taskWorkspace.workspaceId),
          ) ||
          task.sourceCollections.any(
            (source) =>
                source.workspaceIds.any(collectionWorkspaceIds.contains),
          );
    }
    if (workspace == null) {
      return true;
    }
    return task.workspaces.any(
      (taskWorkspace) => taskWorkspace.workspaceId == workspace.id,
    );
  }

  void _setTaskScopeFilter(String? scopeType, String? scopeId) {
    final normalizedType = scopeType?.trim();
    final normalizedId = scopeId?.trim();
    setState(() {
      if (normalizedType == 'workspace' &&
          normalizedId != null &&
          normalizedId.isNotEmpty) {
        _taskScopeType = 'workspace';
        _taskScopeId = normalizedId;
      } else if (normalizedType == 'collection' &&
          normalizedId != null &&
          normalizedId.isNotEmpty) {
        _taskScopeType = 'collection';
        _taskScopeId = normalizedId;
      } else {
        _taskScopeType = null;
        _taskScopeId = null;
      }
      _selectedTask = null;
      _tasks = const [];
    });
    unawaited(_refreshTasksForWorkspace(_selectedWorkspace));
  }

  Workspace? _workspaceForTaskScope(String? workspaceId) {
    if (workspaceId == null || workspaceId.isEmpty) {
      return null;
    }
    return _workspaces.cast<Workspace?>().firstWhere(
      (workspace) => workspace?.id == workspaceId,
      orElse: () => null,
    );
  }

  WorkspaceCollection? _collectionForTaskScope(String? collectionId) {
    if (collectionId == null || collectionId.isEmpty) {
      return null;
    }
    return _collections.cast<WorkspaceCollection?>().firstWhere(
      (collection) => collection?.id == collectionId,
      orElse: () => null,
    );
  }

  String _taskScopeKey(String? scopeType, String? scopeId) {
    final normalizedType = scopeType?.trim();
    final normalizedId = scopeId?.trim();
    if (normalizedType == null ||
        normalizedType.isEmpty ||
        normalizedId == null ||
        normalizedId.isEmpty) {
      return 'all';
    }
    return '$normalizedType:$normalizedId';
  }
}
