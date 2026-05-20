part of '../sidebar_panel.dart';

class _FileList extends StatefulWidget {
  const _FileList({
    required this.listKey,
    required this.files,
    required this.selectedFile,
    required this.searchQuery,
    required this.searchResults,
    required this.directoryChildren,
    required this.expandedDirectories,
    required this.loadingDirectoryPaths,
    required this.directoryErrors,
    required this.onSelected,
    required this.onDirectoryToggled,
  });

  final Key? listKey;
  final List<FileItem> files;
  final FileItem? selectedFile;
  final String searchQuery;
  final List<FileItem> searchResults;
  final Map<String, List<FileItem>> directoryChildren;
  final Set<String> expandedDirectories;
  final Set<String> loadingDirectoryPaths;
  final Map<String, String> directoryErrors;
  final ValueChanged<FileItem> onSelected;
  final ValueChanged<FileItem> onDirectoryToggled;

  @override
  State<_FileList> createState() => _FileListState();
}

class _FileListState extends State<_FileList> {
  List<_FileTreeRow> _rows = const [];
  List<FileItem>? _lastFiles;
  List<FileItem>? _lastSearchResults;
  Map<String, List<FileItem>>? _lastDirectoryChildren;
  Set<String>? _lastExpandedDirectories;
  String? _lastSearchQuery;
  bool? _lastSearching;

  @override
  Widget build(BuildContext context) {
    final searching = widget.searchQuery.trim().isNotEmpty;
    if (!searching && widget.files.isEmpty) {
      return const _SidebarEmpty(label: 'No files loaded');
    }

    final rows = _visibleRows(searching);
    if (searching && rows.isEmpty) {
      return const _SidebarEmpty(label: 'No matching files');
    }
    return ListView.builder(
      key: widget.listKey,
      addAutomaticKeepAlives: false,
      itemCount: rows.length,
      itemBuilder: (context, index) {
        final row = rows[index];
        final file = row.file;
        return KeyedSubtree(
          key: ValueKey('file-row-${file.path}'),
          child: _FileTreeTile(
            file: file,
            depth: row.depth,
            expanded:
                !searching && widget.expandedDirectories.contains(file.path),
            loading: widget.loadingDirectoryPaths.contains(file.path),
            error: widget.directoryErrors[file.path],
            selected: file.path == widget.selectedFile?.path,
            subtitle: _metadataLabel(
              file,
              searching
                  ? _compactPath(file.path)
                  : file.isDirectory
                  ? 'Folder'
                  : _formatSize(file.size),
            ),
            onTap: () => file.isDirectory
                ? widget.onDirectoryToggled(file)
                : widget.onSelected(file),
          ),
        );
      },
    );
  }

  List<_FileTreeRow> _visibleRows(bool searching) {
    if (_lastSearching == searching &&
        _lastSearchQuery == widget.searchQuery &&
        _lastFiles == widget.files &&
        _lastSearchResults == widget.searchResults &&
        _lastDirectoryChildren == widget.directoryChildren &&
        _lastExpandedDirectories == widget.expandedDirectories) {
      return _rows;
    }

    final rows = searching
        ? widget.searchResults
              .map((file) => _FileTreeRow(file: file, depth: 0))
              .toList(growable: false)
        : _flattenVisibleRows(widget.files);
    _lastSearching = searching;
    _lastSearchQuery = widget.searchQuery;
    _lastFiles = widget.files;
    _lastSearchResults = widget.searchResults;
    _lastDirectoryChildren = widget.directoryChildren;
    _lastExpandedDirectories = widget.expandedDirectories;
    _rows = rows;
    return rows;
  }

  List<_FileTreeRow> _flattenVisibleRows(List<FileItem> source) {
    final rows = <_FileTreeRow>[];
    final stack = <_FileTreeRow>[
      for (final file in source.reversed) _FileTreeRow(file: file, depth: 0),
    ];
    while (stack.isNotEmpty) {
      final row = stack.removeLast();
      final file = row.file;
      rows.add(row);
      if (!file.isDirectory ||
          !widget.expandedDirectories.contains(file.path)) {
        continue;
      }
      final children =
          widget.directoryChildren[file.path] ?? const <FileItem>[];
      for (final child in children.reversed) {
        stack.add(_FileTreeRow(file: child, depth: row.depth + 1));
      }
    }
    return rows;
  }

  String _formatSize(int? size) {
    if (size == null) {
      return 'File';
    }
    if (size < 1024) {
      return '$size B';
    }
    return '${(size / 1024).toStringAsFixed(1)} KB';
  }

  String _compactPath(String path) {
    final parts = path.split('/').where((part) => part.isNotEmpty).toList();
    if (parts.length <= 2) {
      return path;
    }
    return '.../${parts.skip(parts.length - 2).join('/')}';
  }

  String _metadataLabel(FileItem file, String fallback) {
    final status = _gitStatusLabel(file.gitStatus);
    if (status == null) {
      return fallback;
    }
    return '$status / $fallback';
  }
}

class _FileTreeRow {
  const _FileTreeRow({required this.file, required this.depth});

  final FileItem file;
  final int depth;
}

class _FileTreeTile extends StatelessWidget {
  const _FileTreeTile({
    required this.file,
    required this.depth,
    required this.expanded,
    required this.loading,
    required this.selected,
    required this.subtitle,
    required this.onTap,
    this.error,
  });

  final FileItem file;
  final int depth;
  final bool expanded;
  final bool loading;
  final bool selected;
  final String subtitle;
  final String? error;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final iconColor = selected
        ? AppColors.accent(context)
        : AppColors.mutedText(context);
    final metadata = error == null
        ? loading
              ? 'Loading...'
              : subtitle
        : 'Load failed';
    return Material(
      color: selected
          ? AppColors.accent(context).withValues(alpha: 0.14)
          : Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: EdgeInsets.fromLTRB(8 + depth * 14, 5, 8, 5),
          child: Row(
            children: [
              SizedBox(
                width: 20,
                child: file.isDirectory
                    ? Icon(
                        expanded
                            ? Icons.keyboard_arrow_down
                            : Icons.keyboard_arrow_right,
                        size: 18,
                        color: iconColor,
                      )
                    : const SizedBox.shrink(),
              ),
              Icon(
                file.isDirectory
                    ? expanded
                          ? Icons.folder_open
                          : Icons.folder
                    : Icons.description_outlined,
                size: 17,
                color: iconColor,
              ),
              const SizedBox(width: 7),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      file.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: selected
                            ? AppColors.primaryText(context)
                            : AppColors.secondaryText(context),
                        fontSize: 13,
                        fontWeight: selected
                            ? FontWeight.w700
                            : FontWeight.w500,
                      ),
                    ),
                    Text(
                      metadata,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: error == null
                            ? AppColors.mutedText(context)
                            : AppColors.warning(context),
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ),
              if (loading)
                const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else if (error != null)
                Icon(
                  Icons.error_outline,
                  size: 14,
                  color: AppColors.warning(context),
                )
              else if (file.gitStatus?.isNotEmpty == true)
                _GitStatusBadge(file: file),
            ],
          ),
        ),
      ),
    );
  }
}

class _GitStatusBadge extends StatelessWidget {
  const _GitStatusBadge({required this.file});

  final FileItem file;

  @override
  Widget build(BuildContext context) {
    final status = file.gitStatus;
    if (status == null || status.isEmpty) {
      return const SizedBox.shrink();
    }
    final color = _gitStatusColor(context, status);
    return Tooltip(
      message: _gitStatusLabel(status) ?? status,
      child: Container(
        width: 18,
        height: 18,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          border: Border.all(color: color.withValues(alpha: 0.62)),
          borderRadius: BorderRadius.circular(5),
        ),
        child: Text(
          _gitStatusLetter(status),
          style: TextStyle(
            color: color,
            fontSize: 10,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

String? _gitStatusLabel(String? status) {
  switch (status) {
    case 'conflicted':
      return 'Conflicted';
    case 'deleted':
      return 'Deleted';
    case 'untracked':
      return 'Untracked';
    case 'renamed':
      return 'Renamed';
    case 'staged':
      return 'Staged';
    case 'mixed':
      return 'Mixed';
    case 'modified':
      return 'Modified';
    default:
      return null;
  }
}

String _gitStatusLetter(String status) {
  switch (status) {
    case 'conflicted':
      return '!';
    case 'deleted':
      return 'D';
    case 'untracked':
      return '?';
    case 'renamed':
      return 'R';
    case 'staged':
      return 'S';
    case 'mixed':
      return '*';
    default:
      return 'M';
  }
}

Color _gitStatusColor(BuildContext context, String status) {
  switch (status) {
    case 'conflicted':
    case 'deleted':
      return AppColors.warning(context);
    case 'untracked':
      return AppColors.secondaryText(context);
    case 'staged':
      return AppColors.success(context);
    default:
      return AppColors.accent(context);
  }
}

class _SidebarTile extends StatelessWidget {
  const _SidebarTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected
          ? AppColors.accent(context).withValues(alpha: 0.14)
          : Colors.transparent,
      child: ListTile(
        dense: true,
        leading: Icon(
          icon,
          size: 18,
          color: selected
              ? AppColors.accent(context)
              : AppColors.mutedText(context),
        ),
        title: Text(title, overflow: TextOverflow.ellipsis),
        subtitle: Text(subtitle, overflow: TextOverflow.ellipsis),
        shape: const Border(
          left: BorderSide(color: Colors.transparent, width: 3),
        ),
        onTap: onTap,
      ),
    );
  }
}

class _SidebarEmpty extends StatelessWidget {
  const _SidebarEmpty({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(label, style: TextStyle(color: AppColors.mutedText(context))),
    );
  }
}
