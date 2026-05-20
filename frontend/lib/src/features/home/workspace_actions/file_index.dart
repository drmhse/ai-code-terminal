part of '../act_home_page.dart';
// ignore_for_file: invalid_use_of_protected_member

extension _ActHomeFileIndex on _ActHomePageState {
  Future<Map<String, String>> _loadSessionBuffers(
    Iterable<TerminalSession> sessions,
  ) async {
    final activeSessions = sessions.toList(growable: false);
    final entries = await Future.wait(
      activeSessions.map((session) async {
        try {
          return MapEntry(session.id, await _api.sessionBuffer(session.id));
        } catch (_) {
          return null;
        }
      }),
    );
    return {
      for (final entry in entries)
        if (entry != null) entry.key: entry.value,
    };
  }

  Map<String, String> _reconcileSessionBuffers(
    Iterable<TerminalSession> sessions,
    Map<String, String> updates,
  ) {
    final activeSessionIds = sessions.map((session) => session.id).toSet();
    return {
      for (final entry in _sessionBuffers.entries)
        if (activeSessionIds.contains(entry.key)) entry.key: entry.value,
      ...updates,
    };
  }

  void _resetFileBrowserState({bool keepSearch = false}) {
    _files = const [];
    _fileIndex = const {};
    _fileIndexVersion += 1;
    _cachedFileSearchResults = const [];
    _cachedFileSearchQuery = '';
    _cachedFileSearchIndexVersion = -1;
    _indexedDirectoryPaths = const <String>{};
    _indexingDirectoryPaths = const <String>{};
    _isIndexingFiles = false;
    _fileIndexGeneration += 1;
    if (!keepSearch) {
      _fileSearchQuery = '';
    }
    _directoryChildren = const {};
    _expandedDirectories = const <String>{};
    _loadingDirectoryPaths = const <String>{};
    _directoryLoadErrors = const {};
  }

  _WorkspaceFileBrowserSnapshot _currentFileBrowserSnapshot() {
    return _WorkspaceFileBrowserSnapshot(
      files: List<FileItem>.unmodifiable(_files),
      fileIndex: Map<String, FileItem>.unmodifiable(_fileIndex),
      indexedDirectoryPaths: Set<String>.unmodifiable(_indexedDirectoryPaths),
      searchQuery: _fileSearchQuery,
      directoryChildren: Map<String, List<FileItem>>.unmodifiable({
        for (final entry in _directoryChildren.entries)
          entry.key: List<FileItem>.unmodifiable(entry.value),
      }),
      expandedDirectories: Set<String>.unmodifiable(_expandedDirectories),
      directoryLoadErrors: Map<String, String>.unmodifiable(
        _directoryLoadErrors,
      ),
      selectedFile: _selectedFile,
      selectedFileContent: _selectedFileContent,
      selectedFileHasLocalDraft: _selectedFileHasLocalDraft,
    );
  }

  void _cacheFileBrowserStateForCurrentWorkspace() {
    final workspaceId = _selectedWorkspace?.id;
    if (workspaceId == null) {
      return;
    }
    _fileBrowserSnapshots[workspaceId] = _currentFileBrowserSnapshot();
  }

  void _restoreFileBrowserStateForWorkspace(Workspace? workspace) {
    _fileIndexGeneration += 1;
    _loadingDirectoryPaths = const <String>{};
    _indexingDirectoryPaths = const <String>{};
    _isIndexingFiles = false;

    final snapshot = workspace == null
        ? null
        : _fileBrowserSnapshots[workspace.id];
    if (snapshot == null) {
      _files = const [];
      _fileIndex = const {};
      _fileIndexVersion += 1;
      _cachedFileSearchResults = const [];
      _cachedFileSearchQuery = '';
      _cachedFileSearchIndexVersion = -1;
      _indexedDirectoryPaths = const <String>{};
      _fileSearchQuery = '';
      _directoryChildren = const {};
      _expandedDirectories = const <String>{};
      _directoryLoadErrors = const {};
      _selectedFile = null;
      _selectedFileContent = null;
      _selectedFileHasLocalDraft = false;
      return;
    }

    _files = snapshot.files;
    _fileIndex = snapshot.fileIndex;
    _fileIndexVersion += 1;
    _cachedFileSearchResults = const [];
    _cachedFileSearchQuery = '';
    _cachedFileSearchIndexVersion = -1;
    _indexedDirectoryPaths = snapshot.indexedDirectoryPaths;
    _fileSearchQuery = snapshot.searchQuery;
    _directoryChildren = snapshot.directoryChildren;
    _expandedDirectories = snapshot.expandedDirectories;
    _directoryLoadErrors = snapshot.directoryLoadErrors;
    _selectedFile = snapshot.selectedFile;
    _selectedFileContent = snapshot.selectedFileContent;
    _selectedFileHasLocalDraft = snapshot.selectedFileHasLocalDraft;
  }

  void _cacheCurrentFileBrowserStateIfSelected(Workspace workspace) {
    if (_selectedWorkspace?.id == workspace.id) {
      _cacheFileBrowserStateForCurrentWorkspace();
    }
  }

  void _seedFileIndex(Iterable<FileItem> files) {
    if (files.isEmpty) {
      return;
    }
    _fileIndex = {..._fileIndex, for (final file in files) file.path: file};
    _fileIndexVersion += 1;
  }

  List<FileItem> get _fileSearchResults {
    final query = _fileSearchQuery.trim().toLowerCase();
    if (query.isEmpty) {
      return const [];
    }
    if (query == _cachedFileSearchQuery &&
        _fileIndexVersion == _cachedFileSearchIndexVersion) {
      return _cachedFileSearchResults;
    }
    final terms = query.split(RegExp(r'\s+')).where((term) => term.isNotEmpty);
    final results = _fileIndex.values
        .where((file) {
          final haystack = '${file.name}\n${file.path}'.toLowerCase();
          return terms.every(haystack.contains);
        })
        .toList(growable: false);
    results.sort((a, b) {
      if (a.isDirectory != b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.path.toLowerCase().compareTo(b.path.toLowerCase());
    });
    _cachedFileSearchQuery = query;
    _cachedFileSearchIndexVersion = _fileIndexVersion;
    _cachedFileSearchResults = results.take(120).toList(growable: false);
    return _cachedFileSearchResults;
  }

  void _handleFileSearchChanged(String query) {
    final workspace = _selectedWorkspace;
    setState(() {
      _fileSearchQuery = query;
      if (workspace != null) {
        _cacheCurrentFileBrowserStateIfSelected(workspace);
      }
    });
    if (workspace != null && query.trim().isNotEmpty) {
      unawaited(_hydrateFileIndexForWorkspace(workspace));
    }
  }

  Future<void> _hydrateFileIndexForWorkspace(Workspace workspace) async {
    final generation = _fileIndexGeneration;
    final queued = <FileItem>[
      ..._files.where(_shouldHydrateDirectory),
      for (final children in _directoryChildren.values)
        ...children.where(_shouldHydrateDirectory),
    ];
    final seen = <String>{
      ..._indexedDirectoryPaths,
      ..._indexingDirectoryPaths,
    };
    if (queued.isEmpty) {
      return;
    }
    if (mounted) {
      setState(() => _isIndexingFiles = true);
    }

    var visited = 0;
    var changedSinceFlush = 0;
    var nextDirectoryChildren = _directoryChildren;
    var nextFileIndex = _fileIndex;
    var nextIndexedDirectoryPaths = _indexedDirectoryPaths;
    var nextIndexingDirectoryPaths = _indexingDirectoryPaths;
    const flushEvery = 24;

    void flushIndexingState({bool finished = false}) {
      if (!mounted ||
          generation != _fileIndexGeneration ||
          _selectedWorkspace?.id != workspace.id) {
        return;
      }
      setState(() {
        _directoryChildren = nextDirectoryChildren;
        _fileIndex = nextFileIndex;
        _fileIndexVersion += changedSinceFlush > 0 ? 1 : 0;
        _indexedDirectoryPaths = nextIndexedDirectoryPaths;
        _indexingDirectoryPaths = nextIndexingDirectoryPaths;
        _isIndexingFiles = !finished;
        _cacheCurrentFileBrowserStateIfSelected(workspace);
      });
      changedSinceFlush = 0;
    }

    while (queued.isNotEmpty && visited < 700) {
      if (!mounted ||
          generation != _fileIndexGeneration ||
          _selectedWorkspace?.id != workspace.id) {
        return;
      }
      final directory = queued.removeAt(0);
      if (!seen.add(directory.path)) {
        continue;
      }
      visited += 1;
      nextIndexingDirectoryPaths = {
        ...nextIndexingDirectoryPaths,
        directory.path,
      };
      try {
        final listing = await _api.workspaceFiles(
          workspace.id,
          path: _relativePath(directory.path, workspace.localPath),
        );
        if (!mounted ||
            generation != _fileIndexGeneration ||
            _selectedWorkspace?.id != workspace.id) {
          return;
        }
        final childDirectories = listing.items.where(_shouldHydrateDirectory);
        nextDirectoryChildren = {
          ...nextDirectoryChildren,
          directory.path: listing.items,
        };
        nextFileIndex = {
          ...nextFileIndex,
          for (final file in listing.items) file.path: file,
        };
        nextIndexedDirectoryPaths = {
          ...nextIndexedDirectoryPaths,
          directory.path,
        };
        nextIndexingDirectoryPaths = {
          for (final path in nextIndexingDirectoryPaths)
            if (path != directory.path) path,
        };
        changedSinceFlush += 1;
        if (changedSinceFlush >= flushEvery) {
          flushIndexingState();
        }
        queued.addAll(childDirectories);
      } catch (_) {
        if (!mounted ||
            generation != _fileIndexGeneration ||
            _selectedWorkspace?.id != workspace.id) {
          return;
        }
        nextIndexedDirectoryPaths = {
          ...nextIndexedDirectoryPaths,
          directory.path,
        };
        nextIndexingDirectoryPaths = {
          for (final path in nextIndexingDirectoryPaths)
            if (path != directory.path) path,
        };
        changedSinceFlush += 1;
        if (changedSinceFlush >= flushEvery) {
          flushIndexingState();
        }
      }
    }

    if (mounted &&
        generation == _fileIndexGeneration &&
        _selectedWorkspace?.id == workspace.id) {
      flushIndexingState(finished: true);
    }
  }

  bool _shouldHydrateDirectory(FileItem file) {
    return file.isDirectory &&
        !_ActHomePageState._backgroundIndexSkippedDirs.contains(file.name);
  }

  void _selectFocusedTerminalForWorkspace(
    String workspaceId,
    Iterable<TerminalSession> sessions,
  ) {
    if (sessions.any((session) => session.id == _activeTerminalSessionId)) {
      return;
    }
    final workspaceSessions = sessions
        .where((session) => session.workspaceId == workspaceId)
        .toList(growable: false);
    if (workspaceSessions.isEmpty) {
      _activeTerminalSessionId = sessions.isEmpty ? null : sessions.first.id;
      return;
    }
    _activeTerminalSessionId = workspaceSessions.first.id;
  }

  Map<String, String> _sessionBuffersWithout(String sessionId) {
    return {
      for (final entry in _sessionBuffers.entries)
        if (entry.key != sessionId) entry.key: entry.value,
    };
  }

  String _trimTerminalBuffer(String value) {
    const maxBufferChars = 60000;
    if (value.length <= maxBufferChars) {
      return value;
    }
    return value.substring(value.length - maxBufferChars);
  }
}
