part of '../act_home_page.dart';
// ignore_for_file: invalid_use_of_protected_member

extension _ActHomeFileActions on _ActHomePageState {
  Future<void> _selectFile(FileItem file) async {
    if (file.isDirectory) {
      await _toggleDirectory(file);
      return;
    }

    final workspace = _selectedWorkspace;
    if (workspace == null) {
      return;
    }
    final relativePath = _relativePath(file.path, workspace.localPath);
    final tabKey = _editorTabKey(workspace.id, relativePath);
    final existingTab = _editorTabByKey(tabKey);
    final tab =
        existingTab ??
        _OpenEditorTab(
          key: tabKey,
          workspaceId: workspace.id,
          relativePath: relativePath,
          file: file,
        );
    final loadGeneration =
        _fileIndexGeneration + DateTime.now().microsecondsSinceEpoch;
    setState(() {
      if (existingTab == null) {
        _openEditorTabs.add(tab);
      }
      _activeEditorTabKey = tab.key;
      _activeWorkbenchTabKey = tab.key;
      tab.isLoading = existingTab?.content == null;
      tab.loadGeneration = loadGeneration;
      _syncSelectedFileFromEditorTab(tab);
      _showMobileEditor = MediaQuery.sizeOf(context).width < 760;
      _mobileIndex = MediaQuery.sizeOf(context).width < 760 ? 0 : _mobileIndex;
      _statusMessage = existingTab?.content == null
          ? 'Opening ${file.name}...'
          : 'Opened ${file.name}';
      _cacheCurrentFileBrowserStateIfSelected(workspace);
    });
    if (existingTab != null && existingTab.content != null) {
      return;
    }

    final cached = await _readCachedFileContent(
      workspaceId: workspace.id,
      path: relativePath,
    );
    final cachedTab = _editorTabByKey(tabKey);
    if (mounted &&
        cachedTab != null &&
        cachedTab.loadGeneration == loadGeneration &&
        _selectedWorkspace?.id == workspace.id &&
        cached != null) {
      setState(() {
        cachedTab.content = cached.content;
        cachedTab.draftText = cached.dirty ? cached.content.content : null;
        cachedTab.hasUnsavedDraft = cached.dirty;
        _statusMessage = cached.dirty
            ? 'Showing local draft for ${file.name}'
            : 'Showing cached ${file.name}';
        if (_activeEditorTabKey == cachedTab.key) {
          _syncSelectedFileFromEditorTab(cachedTab);
        }
        _cacheCurrentFileBrowserStateIfSelected(workspace);
      });
    }

    try {
      final content = await _api.workspaceFileContent(
        workspace.id,
        path: relativePath,
      );
      final loadedTab = _editorTabByKey(tabKey);
      if (!mounted ||
          loadedTab == null ||
          loadedTab.loadGeneration != loadGeneration ||
          _selectedWorkspace?.id != workspace.id ||
          loadedTab.file.path != file.path) {
        return;
      }
      if (loadedTab.hasUnsavedDraft) {
        setState(() {
          loadedTab.isLoading = false;
          _statusMessage = 'Local draft kept for ${file.name}';
          if (_activeEditorTabKey == loadedTab.key) {
            _syncSelectedFileFromEditorTab(loadedTab);
          }
          _cacheCurrentFileBrowserStateIfSelected(workspace);
        });
        return;
      }
      await _writeCachedFileContent(
        workspaceId: workspace.id,
        content: content,
        dirty: false,
      );
      setState(() {
        loadedTab.content = content;
        loadedTab.draftText = null;
        loadedTab.hasUnsavedDraft = false;
        loadedTab.isLoading = false;
        _statusMessage = 'Opened ${file.name}';
        if (_activeEditorTabKey == loadedTab.key) {
          _syncSelectedFileFromEditorTab(loadedTab);
        }
        _cacheCurrentFileBrowserStateIfSelected(workspace);
      });
    } catch (error) {
      final failedTab = _editorTabByKey(tabKey);
      if (!mounted ||
          failedTab == null ||
          failedTab.loadGeneration != loadGeneration ||
          _selectedWorkspace?.id != workspace.id ||
          failedTab.file.path != file.path) {
        return;
      }
      setState(() {
        failedTab.isLoading = false;
        _statusMessage = failedTab.content == null
            ? 'File open failed: $error'
            : 'Using cached ${file.name}; refresh failed.';
        if (_activeEditorTabKey == failedTab.key) {
          _syncSelectedFileFromEditorTab(failedTab);
        }
        _cacheCurrentFileBrowserStateIfSelected(workspace);
      });
    }
  }

  void _closeMobileEditor() {
    setState(() {
      _showMobileEditor = false;
      _statusMessage = 'Files';
    });
  }

  Future<void> _toggleDirectory(FileItem directory) async {
    final workspace = _selectedWorkspace;
    if (workspace == null || !directory.isDirectory) {
      return;
    }

    final alreadyExpanded = _expandedDirectories.contains(directory.path);
    if (alreadyExpanded) {
      setState(() {
        _expandedDirectories = {
          for (final path in _expandedDirectories)
            if (path != directory.path) path,
        };
        _cacheCurrentFileBrowserStateIfSelected(workspace);
      });
      return;
    }

    setState(() {
      _expandedDirectories = {..._expandedDirectories, directory.path};
      _directoryLoadErrors = {
        for (final entry in _directoryLoadErrors.entries)
          if (entry.key != directory.path) entry.key: entry.value,
      };
      _cacheCurrentFileBrowserStateIfSelected(workspace);
    });

    if (_directoryChildren.containsKey(directory.path) ||
        _loadingDirectoryPaths.contains(directory.path)) {
      return;
    }

    setState(() {
      _loadingDirectoryPaths = {..._loadingDirectoryPaths, directory.path};
      _cacheCurrentFileBrowserStateIfSelected(workspace);
    });

    final relativePath = _relativePath(directory.path, workspace.localPath);
    try {
      final listing = await _api.workspaceFiles(
        workspace.id,
        path: relativePath,
      );
      if (!mounted || _selectedWorkspace?.id != workspace.id) {
        return;
      }
      setState(() {
        _directoryChildren = {
          ..._directoryChildren,
          directory.path: listing.items,
        };
        _seedFileIndex(listing.items);
        _loadingDirectoryPaths = {
          for (final path in _loadingDirectoryPaths)
            if (path != directory.path) path,
        };
        _cacheCurrentFileBrowserStateIfSelected(workspace);
      });
    } catch (error) {
      if (!mounted || _selectedWorkspace?.id != workspace.id) {
        return;
      }
      setState(() {
        _loadingDirectoryPaths = {
          for (final path in _loadingDirectoryPaths)
            if (path != directory.path) path,
        };
        _directoryLoadErrors = {
          ..._directoryLoadErrors,
          directory.path: error.toString(),
        };
        _statusMessage = 'Directory load failed: $error';
        _cacheCurrentFileBrowserStateIfSelected(workspace);
      });
    }
  }

  void _cacheSelectedFileDraft(String content) {
    final tab = _activeEditorTab;
    if (tab == null) {
      return;
    }
    _cacheEditorTabDraft(tab, content);
  }

  void _cacheEditorTabDraft(_OpenEditorTab tab, String content) {
    final currentContent = tab.content;
    if (currentContent == null) {
      return;
    }
    final draftContent = FileContent(
      path: tab.relativePath,
      content: content,
      encoding: currentContent.encoding,
      size: content.length,
      isBinary: false,
    );
    final wasDirty = tab.hasUnsavedDraft;
    if (!wasDirty && mounted) {
      setState(() {
        tab.hasUnsavedDraft = true;
        if (_activeEditorTabKey == tab.key) {
          _selectedFileHasLocalDraft = true;
        }
      });
    } else {
      tab.hasUnsavedDraft = true;
      if (_activeEditorTabKey == tab.key) {
        _selectedFileHasLocalDraft = true;
      }
    }
    tab.draftText = content;
    _fileDraftSaveTimers[tab.key]?.cancel();
    _fileDraftSaveTimers[tab.key] = Timer(
      const Duration(milliseconds: 350),
      () {
        unawaited(
          _writeCachedFileContent(
            workspaceId: tab.workspaceId,
            content: draftContent,
            dirty: true,
          ),
        );
      },
    );
  }

  Future<void> _saveSelectedFile(String content) async {
    final tab = _activeEditorTab;
    if (tab == null) {
      return;
    }
    await _saveEditorTab(tab, content);
  }

  Future<void> _saveEditorTab(_OpenEditorTab tab, String content) async {
    final nextContent = FileContent(
      path: tab.relativePath,
      content: content,
      encoding: tab.content?.encoding ?? 'utf-8',
      size: content.length,
      isBinary: false,
    );
    _fileDraftSaveTimers[tab.key]?.cancel();
    await _writeCachedFileContent(
      workspaceId: tab.workspaceId,
      content: nextContent,
      dirty: true,
    );
    setState(() {
      tab.content = nextContent;
      tab.draftText = content;
      tab.hasUnsavedDraft = true;
      tab.isSaving = true;
      _statusMessage = 'Saving ${tab.file.name}...';
      if (_activeEditorTabKey == tab.key) {
        _syncSelectedFileFromEditorTab(tab);
      }
      _cacheFileBrowserStateForCurrentWorkspace();
    });
    try {
      final workspaceId = tab.workspaceId;
      await _api.saveWorkspaceFileContent(
        workspaceId,
        path: tab.relativePath,
        content: content,
      );
      final savedTab = _editorTabByKey(tab.key);
      if (!mounted || savedTab == null) {
        return;
      }
      setState(() {
        savedTab.content = nextContent;
        savedTab.draftText = null;
        savedTab.hasUnsavedDraft = false;
        savedTab.isSaving = false;
        _statusMessage = 'Saved ${savedTab.file.name}';
        if (_activeEditorTabKey == savedTab.key) {
          _syncSelectedFileFromEditorTab(savedTab);
        }
        _cacheFileBrowserStateForCurrentWorkspace();
      });
      await _writeCachedFileContent(
        workspaceId: workspaceId,
        content: nextContent,
        dirty: false,
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        tab.isSaving = false;
        tab.hasUnsavedDraft = true;
        _statusMessage = 'Save failed; local draft kept. $error';
        if (_activeEditorTabKey == tab.key) {
          _syncSelectedFileFromEditorTab(tab);
        }
        _cacheFileBrowserStateForCurrentWorkspace();
      });
    }
  }

  String _editorTabKey(String workspaceId, String relativePath) {
    return '$workspaceId::$relativePath';
  }

  _OpenEditorTab? get _activeEditorTab => _editorTabByKey(_activeEditorTabKey);

  _OpenEditorTab? _editorTabByKey(String? key) {
    if (key == null) {
      return null;
    }
    for (final tab in _openEditorTabs) {
      if (tab.key == key) {
        return tab;
      }
    }
    return null;
  }

  List<_OpenEditorTab> _editorTabsForWorkspace(Workspace? workspace) {
    if (workspace == null) {
      return const [];
    }
    return _openEditorTabs
        .where((tab) => tab.workspaceId == workspace.id)
        .toList(growable: false);
  }

  void _activateWorkbenchTab(String key) {
    setState(() {
      _activeWorkbenchTabKey = key;
      if (key == 'terminal') {
        return;
      }
      final tab = _editorTabByKey(key);
      if (tab == null) {
        _activeWorkbenchTabKey = 'terminal';
        return;
      }
      _activeEditorTabKey = tab.key;
      _syncSelectedFileFromEditorTab(tab);
      _cacheFileBrowserStateForCurrentWorkspace();
    });
  }

  void _closeEditorTab(_OpenEditorTab tab) {
    _fileDraftSaveTimers.remove(tab.key)?.cancel();
    setState(() {
      final index = _openEditorTabs.indexWhere((item) => item.key == tab.key);
      _openEditorTabs.removeWhere((item) => item.key == tab.key);
      if (_activeEditorTabKey == tab.key) {
        final workspaceTabs = _editorTabsForWorkspace(_selectedWorkspace);
        final nextIndex = workspaceTabs.isEmpty
            ? -1
            : index.clamp(0, workspaceTabs.length - 1).toInt();
        final nextTab = nextIndex == -1 ? null : workspaceTabs[nextIndex];
        _activeEditorTabKey = nextTab?.key;
        if (nextTab != null) {
          _activeWorkbenchTabKey = nextTab.key;
          _syncSelectedFileFromEditorTab(nextTab);
        } else {
          _activeWorkbenchTabKey = 'terminal';
          _syncSelectedFileFromEditorTab(null);
        }
      } else if (_activeWorkbenchTabKey == tab.key) {
        _activeWorkbenchTabKey = 'terminal';
      }
      _cacheFileBrowserStateForCurrentWorkspace();
    });
  }

  void _syncSelectedFileFromEditorTab(_OpenEditorTab? tab) {
    _selectedFile = tab?.file;
    _selectedFileContent = tab?.visibleContent;
    _selectedFileHasLocalDraft = tab?.hasUnsavedDraft ?? false;
    _isLoadingFileContent = tab?.isLoading ?? false;
    _isSavingFileContent = tab?.isSaving ?? false;
  }

  Future<CachedFileContent?> _readCachedFileContent({
    required String workspaceId,
    required String path,
  }) async {
    try {
      return await _fileCache.read(workspaceId: workspaceId, path: path);
    } catch (_) {
      return null;
    }
  }

  Future<void> _writeCachedFileContent({
    required String workspaceId,
    required FileContent content,
    required bool dirty,
  }) async {
    try {
      if (dirty) {
        await _fileCache.writeDraft(workspaceId: workspaceId, content: content);
      } else {
        await _fileCache.writeClean(workspaceId: workspaceId, content: content);
      }
    } catch (_) {
      // The editor should stay usable even if local persistence is unavailable.
    }
  }
}
