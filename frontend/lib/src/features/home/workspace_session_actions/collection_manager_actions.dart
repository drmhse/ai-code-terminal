part of '../act_home_page.dart';
// ignore_for_file: invalid_use_of_protected_member

extension _CollectionManagerActions on _CollectionManagerSheetState {
  Future<void> _createCollection() async {
    final name = _createController.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Name is required');
      return;
    }
    setState(() {
      _busyKey = 'create';
      _error = null;
    });
    try {
      final collection = await widget.onCreate(
        name,
        _newWorkspaceIds.toList(growable: false),
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _collections = _replaceCollection(_collections, collection);
        _selectedCollectionId = collection.id;
        _renameController.text = collection.name;
        _createController.clear();
        _newWorkspaceIds = const <String>{};
        _showCreateCollection = false;
      });
    } catch (error) {
      if (mounted) {
        setState(() => _error = error.toString());
      }
    } finally {
      if (mounted) {
        setState(() => _busyKey = null);
      }
    }
  }

  void _selectCollection(WorkspaceCollection collection) {
    setState(() {
      _selectedCollectionId = collection.id;
      _renameController.text = collection.name;
    });
  }

  Future<void> _rename(WorkspaceCollection collection) async {
    final name = _renameController.text.trim();
    if (name.isEmpty) {
      return;
    }
    setState(() => _busyKey = 'rename');
    try {
      final updated = await widget.onRename(collection, name);
      if (!mounted) {
        return;
      }
      setState(() {
        _collections = _replaceCollection(_collections, updated);
        _selectedCollectionId = updated.id;
        _renameController.text = updated.name;
      });
    } finally {
      if (mounted) {
        setState(() => _busyKey = null);
      }
    }
  }

  Future<void> _delete(WorkspaceCollection collection) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Delete collection'),
          content: Text(collection.name),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete'),
            ),
          ],
        );
      },
    );
    if (confirmed != true) {
      return;
    }
    setState(() => _busyKey = 'delete');
    try {
      await widget.onDelete(collection);
      if (!mounted) {
        return;
      }
      setState(() {
        _collections = [
          for (final candidate in _collections)
            if (candidate.id != collection.id) candidate,
        ];
        _selectedCollectionId = _collections.isEmpty
            ? null
            : _collections.first.id;
        _renameController.text = _selectedCollection?.name ?? '';
      });
    } finally {
      if (mounted) {
        setState(() => _busyKey = null);
      }
    }
  }

  Future<void> _addWorkspace(
    WorkspaceCollection collection,
    Workspace workspace,
  ) async {
    setState(() => _busyKey = 'add:${workspace.id}');
    try {
      final updated = await widget.onAddWorkspace(collection, workspace);
      if (mounted) {
        _replaceSelected(updated);
      }
    } finally {
      if (mounted) {
        setState(() => _busyKey = null);
      }
    }
  }

  Future<void> _removeWorkspace(
    WorkspaceCollection collection,
    Workspace workspace,
  ) async {
    setState(() => _busyKey = 'member:${workspace.id}');
    try {
      final updated = await widget.onRemoveWorkspace(collection, workspace);
      if (mounted) {
        _replaceSelected(updated);
      }
    } finally {
      if (mounted) {
        setState(() => _busyKey = null);
      }
    }
  }

  Future<void> _setPrimary(
    WorkspaceCollection collection,
    Workspace workspace,
  ) async {
    setState(() => _busyKey = 'member:${workspace.id}');
    try {
      final updated = await widget.onSetPrimary(collection, workspace);
      if (mounted) {
        _replaceSelected(updated);
      }
    } finally {
      if (mounted) {
        setState(() => _busyKey = null);
      }
    }
  }

  void _replaceSelected(WorkspaceCollection collection) {
    setState(() {
      _collections = _replaceCollection(_collections, collection);
      _selectedCollectionId = collection.id;
      _renameController.text = collection.name;
    });
  }

  List<WorkspaceCollection> _replaceCollection(
    List<WorkspaceCollection> collections,
    WorkspaceCollection collection,
  ) {
    final next = [
      collection,
      for (final candidate in collections)
        if (candidate.id != collection.id) candidate,
    ];
    next.sort(_compareCollections);
    return next;
  }

  static int _compareCollections(
    WorkspaceCollection left,
    WorkspaceCollection right,
  ) {
    return left.name.toLowerCase().compareTo(right.name.toLowerCase());
  }
}
