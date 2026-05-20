part of '../act_home_page.dart';
// ignore_for_file: invalid_use_of_protected_member

extension _ActHomeFileActions on _ActHomePageState {
  Future<void> _selectFile(FileItem file) async {
    _fileDraftSaveTimer?.cancel();
    if (file.isDirectory) {
      await _toggleDirectory(file);
      return;
    }

    final workspace = _selectedWorkspace;
    if (workspace == null) {
      return;
    }
    final relativePath = _relativePath(file.path, workspace.localPath);
    setState(() {
      _selectedFile = file;
      _selectedFileContent = null;
      _selectedFileHasLocalDraft = false;
      _showMobileEditor = MediaQuery.sizeOf(context).width < 760;
      if (MediaQuery.sizeOf(context).width >= 1100) {
        _desktopSidePanelIndex = 2;
      }
      _isLoadingFileContent = true;
      _mobileIndex = MediaQuery.sizeOf(context).width < 760 ? 0 : _mobileIndex;
      _statusMessage = 'Opening ${file.name}...';
      _cacheCurrentFileBrowserStateIfSelected(workspace);
    });
    final cached = await _readCachedFileContent(
      workspaceId: workspace.id,
      path: relativePath,
    );
    if (mounted &&
        _selectedWorkspace?.id == workspace.id &&
        _selectedFile?.path == file.path &&
        cached != null) {
      setState(() {
        _selectedFileContent = cached.content;
        _selectedFileHasLocalDraft = cached.dirty;
        _statusMessage = cached.dirty
            ? 'Showing local draft for ${file.name}'
            : 'Showing cached ${file.name}';
        _cacheCurrentFileBrowserStateIfSelected(workspace);
      });
    }

    try {
      final content = await _api.workspaceFileContent(
        workspace.id,
        path: relativePath,
      );
      if (!mounted ||
          _selectedWorkspace?.id != workspace.id ||
          _selectedFile?.path != file.path) {
        return;
      }
      if (_selectedFileHasLocalDraft) {
        setState(() {
          _isLoadingFileContent = false;
          _statusMessage = 'Local draft kept for ${file.name}';
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
        _selectedFileContent = content;
        _selectedFileHasLocalDraft = false;
        _isLoadingFileContent = false;
        _statusMessage = 'Opened ${file.name}';
        _cacheCurrentFileBrowserStateIfSelected(workspace);
      });
    } catch (error) {
      if (!mounted ||
          _selectedWorkspace?.id != workspace.id ||
          _selectedFile?.path != file.path) {
        return;
      }
      setState(() {
        _isLoadingFileContent = false;
        _statusMessage = _selectedFileContent == null
            ? 'File open failed: $error'
            : 'Using cached ${file.name}; refresh failed.';
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
    final workspace = _selectedWorkspace;
    final file = _selectedFile;
    final currentContent = _selectedFileContent;
    if (workspace == null || file == null || currentContent == null) {
      return;
    }
    final relativePath = _relativePath(file.path, workspace.localPath);
    final draftContent = FileContent(
      path: relativePath,
      content: content,
      encoding: currentContent.encoding,
      size: content.length,
      isBinary: false,
    );
    setState(() {
      _selectedFileHasLocalDraft = true;
      _cacheCurrentFileBrowserStateIfSelected(workspace);
    });
    _fileDraftSaveTimer?.cancel();
    _fileDraftSaveTimer = Timer(const Duration(milliseconds: 350), () {
      unawaited(
        _writeCachedFileContent(
          workspaceId: workspace.id,
          content: draftContent,
          dirty: true,
        ),
      );
    });
  }

  Future<void> _saveSelectedFile(String content) async {
    final workspace = _selectedWorkspace;
    final file = _selectedFile;
    if (workspace == null || file == null) {
      return;
    }
    final relativePath = _relativePath(file.path, workspace.localPath);
    final nextContent = FileContent(
      path: relativePath,
      content: content,
      encoding: _selectedFileContent?.encoding ?? 'utf-8',
      size: content.length,
      isBinary: false,
    );
    _fileDraftSaveTimer?.cancel();
    await _writeCachedFileContent(
      workspaceId: workspace.id,
      content: nextContent,
      dirty: true,
    );
    setState(() {
      _selectedFileContent = nextContent;
      _selectedFileHasLocalDraft = true;
      _isSavingFileContent = true;
      _statusMessage = 'Saving ${file.name}...';
      _cacheCurrentFileBrowserStateIfSelected(workspace);
    });
    try {
      await _api.saveWorkspaceFileContent(
        workspace.id,
        path: relativePath,
        content: content,
      );
      if (!mounted ||
          _selectedWorkspace?.id != workspace.id ||
          _selectedFile?.path != file.path) {
        return;
      }
      setState(() {
        _selectedFileContent = nextContent;
        _selectedFileHasLocalDraft = false;
        _isSavingFileContent = false;
        _statusMessage = 'Saved ${file.name}';
        _cacheCurrentFileBrowserStateIfSelected(workspace);
      });
      await _writeCachedFileContent(
        workspaceId: workspace.id,
        content: nextContent,
        dirty: false,
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _isSavingFileContent = false;
        _selectedFileHasLocalDraft = true;
        _statusMessage = 'Save failed; local draft kept. $error';
        _cacheCurrentFileBrowserStateIfSelected(workspace);
      });
    }
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
