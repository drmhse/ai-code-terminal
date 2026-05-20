part of '../act_home_page.dart';
// ignore_for_file: invalid_use_of_protected_member

extension _ActHomeWorkspaceCollectionActions on _ActHomePageState {
  Future<void> _createEmptyWorkspace() async {
    final name = _workspaceNameController.text.trim();
    if (name.isEmpty) {
      setState(() => _statusMessage = 'Workspace name is required');
      return;
    }

    try {
      final workspace = await _api.createEmptyWorkspace(
        name: name,
        path: _workspacePathController.text.trim(),
        collectionId: _selectedCollection?.id,
      );
      _workspaceNameController.clear();
      _workspacePathController.clear();
      _cacheFileBrowserStateForCurrentWorkspace();
      setState(() {
        _selectedWorkspace = workspace;
        _restoreFileBrowserStateForWorkspace(workspace);
        _mobileIndex = 0;
      });
      await _refreshAll();
    } catch (error) {
      setState(() => _statusMessage = 'Workspace creation failed: $error');
    }
  }

  Future<void> _showCreateWorkspaceDialog() async {
    await showCreateWorkspaceDialog(
      context: context,
      nameController: _workspaceNameController,
      pathController: _workspacePathController,
      onCreate: _createEmptyWorkspace,
    );
  }

  Future<void> _showCollectionManager() async {
    if (!_hasToken) {
      return;
    }
    await showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      backgroundColor: AppColors.panel(context),
      builder: (context) {
        return _CollectionManagerSheet(
          collections: _collections,
          workspaces: _workspaces,
          selectedCollection: _selectedCollection,
          selectedWorkspace: _selectedWorkspace,
          onCreate: _createCollectionFromManager,
          onRename: _renameCollectionFromManager,
          onDelete: _deleteCollectionFromManager,
          onAddWorkspace: _addWorkspaceToCollectionFromManager,
          onRemoveWorkspace: _removeWorkspaceFromCollectionFromManager,
          onSetPrimary: _setCollectionPrimaryFromManager,
        );
      },
    );
  }

  Future<WorkspaceCollection> _createCollectionFromManager(
    String name,
    List<String> workspaceIds,
  ) async {
    final collection = await _api.createCollection(
      name: name,
      workspaceIds: workspaceIds,
    );
    _upsertCollection(collection, select: false);
    setState(() => _statusMessage = 'Created ${collection.name}');
    return collection;
  }

  Future<WorkspaceCollection> _renameCollectionFromManager(
    WorkspaceCollection collection,
    String name,
  ) async {
    final updated = await _api.updateCollection(
      collectionId: collection.id,
      name: name,
      description: collection.description,
    );
    _upsertCollection(updated, select: _selectedCollection?.id == updated.id);
    setState(() => _statusMessage = 'Renamed ${updated.name}');
    return updated;
  }

  Future<void> _deleteCollectionFromManager(
    WorkspaceCollection collection,
  ) async {
    await _api.deleteCollection(collection.id);
    setState(() {
      _collections = [
        for (final candidate in _collections)
          if (candidate.id != collection.id) candidate,
      ];
      if (_selectedCollection?.id == collection.id) {
        _selectedCollection = null;
      }
      _statusMessage = 'Deleted ${collection.name}';
    });
    unawaited(_refreshCodexSessions(silent: true));
  }

  Future<WorkspaceCollection> _addWorkspaceToCollectionFromManager(
    WorkspaceCollection collection,
    Workspace workspace,
  ) async {
    final updated = await _api.addWorkspaceToCollection(
      collectionId: collection.id,
      workspaceId: workspace.id,
    );
    _upsertCollection(updated, select: _selectedCollection?.id == updated.id);
    setState(() => _statusMessage = 'Added ${workspace.name}');
    return updated;
  }

  Future<WorkspaceCollection> _removeWorkspaceFromCollectionFromManager(
    WorkspaceCollection collection,
    Workspace workspace,
  ) async {
    final updated = await _api.removeWorkspaceFromCollection(
      collectionId: collection.id,
      workspaceId: workspace.id,
    );
    _upsertCollection(updated, select: _selectedCollection?.id == updated.id);
    if (_selectedWorkspace?.id == workspace.id &&
        _selectedCollection?.id == updated.id &&
        !updated.containsWorkspace(workspace.id)) {
      setState(() => _selectedCollection = null);
    }
    setState(() => _statusMessage = 'Removed ${workspace.name}');
    return updated;
  }

  Future<WorkspaceCollection> _setCollectionPrimaryFromManager(
    WorkspaceCollection collection,
    Workspace workspace,
  ) async {
    final updated = await _api.setCollectionDefaultWorkspace(
      collectionId: collection.id,
      workspaceId: workspace.id,
    );
    _upsertCollection(updated, select: _selectedCollection?.id == updated.id);
    setState(() => _statusMessage = '${workspace.name} is primary');
    return updated;
  }

  void _upsertCollection(
    WorkspaceCollection collection, {
    required bool select,
  }) {
    setState(() {
      final next = [
        collection,
        for (final candidate in _collections)
          if (candidate.id != collection.id) candidate,
      ];
      next.sort((left, right) => left.name.compareTo(right.name));
      _collections = next;
      if (select) {
        _selectedCollection = collection;
      }
    });
  }
}
