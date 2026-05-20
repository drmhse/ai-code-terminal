import 'package:act_frontend/src/app/app_colors.dart';
import 'package:act_frontend/src/models/file_item.dart';
import 'package:act_frontend/src/models/workspace.dart';
import 'package:act_frontend/src/models/workspace_collection.dart';
import 'package:flutter/material.dart';

part 'sidebar_panel/headers.dart';
part 'sidebar_panel/workspace_list.dart';
part 'sidebar_panel/file_list.dart';

class SidebarPanel extends StatelessWidget {
  const SidebarPanel({
    required this.workspaces,
    required this.files,
    required this.selectedWorkspace,
    required this.selectedFile,
    required this.isLoadingWorkspaces,
    required this.workspaceError,
    required this.onWorkspaceSelected,
    required this.onFileSelected,
    required this.onCreateWorkspace,
    required this.onCloneRepository,
    this.fileSearchQuery = '',
    this.collections = const [],
    this.selectedCollection,
    this.fileSearchResults = const [],
    this.isIndexingFiles = false,
    this.isPreparingClone = false,
    this.showWorkspaceHeader = true,
    this.onFileSearchChanged,
    this.onCollectionSelected,
    this.onManageCollections,
    this.directoryChildren = const {},
    this.expandedDirectories = const <String>{},
    this.loadingDirectoryPaths = const <String>{},
    this.directoryErrors = const {},
    this.fileListKey,
    this.onDirectoryToggled,
    super.key,
  });

  final List<Workspace> workspaces;
  final List<WorkspaceCollection> collections;
  final List<FileItem> files;
  final Workspace? selectedWorkspace;
  final WorkspaceCollection? selectedCollection;
  final FileItem? selectedFile;
  final bool isLoadingWorkspaces;
  final String? workspaceError;
  final String fileSearchQuery;
  final List<FileItem> fileSearchResults;
  final bool isIndexingFiles;
  final bool isPreparingClone;
  final bool showWorkspaceHeader;
  final Map<String, List<FileItem>> directoryChildren;
  final Set<String> expandedDirectories;
  final Set<String> loadingDirectoryPaths;
  final Map<String, String> directoryErrors;
  final Key? fileListKey;
  final ValueChanged<Workspace> onWorkspaceSelected;
  final ValueChanged<WorkspaceCollection>? onCollectionSelected;
  final ValueChanged<FileItem> onFileSelected;
  final ValueChanged<String>? onFileSearchChanged;
  final ValueChanged<FileItem>? onDirectoryToggled;
  final VoidCallback onCreateWorkspace;
  final VoidCallback onCloneRepository;
  final VoidCallback? onManageCollections;

  @override
  Widget build(BuildContext context) {
    final showWorkspaceOnboarding =
        workspaces.isEmpty && selectedWorkspace == null && !isLoadingWorkspaces;
    return Container(
      color: AppColors.panel(context),
      child: Column(
        children: [
          if (showWorkspaceHeader)
            _SectionHeader(
              title: 'Workspaces',
              icon: Icons.add,
              onPressed: isLoadingWorkspaces ? null : onCreateWorkspace,
              secondaryIcon: Icons.download_outlined,
              onSecondaryPressed: isLoadingWorkspaces || isPreparingClone
                  ? null
                  : onCloneRepository,
              secondaryBusy: isPreparingClone,
              tertiaryIcon: Icons.account_tree_outlined,
              onTertiaryPressed: isLoadingWorkspaces
                  ? null
                  : onManageCollections,
            ),
          if (isLoadingWorkspaces) const LinearProgressIndicator(minHeight: 2),
          if (showWorkspaceOnboarding)
            Expanded(
              child: _WorkspaceEmptyState(
                onCreateWorkspace: onCreateWorkspace,
                onCloneRepository: onCloneRepository,
                isPreparingClone: isPreparingClone,
              ),
            )
          else ...[
            Flexible(
              flex: 4,
              child: _WorkspaceList(
                workspaces: workspaces,
                collections: collections,
                selectedWorkspace: selectedWorkspace,
                selectedCollection: selectedCollection,
                isLoading: isLoadingWorkspaces,
                error: workspaceError,
                onSelected: onWorkspaceSelected,
                onCollectionSelected: onCollectionSelected,
                onCreateWorkspace: onCreateWorkspace,
                onCloneRepository: onCloneRepository,
                isPreparingClone: isPreparingClone,
              ),
            ),
            Divider(height: 1, color: AppColors.line(context)),
            _FilesHeader(
              query: fileSearchQuery,
              isIndexing: isIndexingFiles,
              onChanged: onFileSearchChanged,
            ),
            Flexible(
              flex: 6,
              child: _FileList(
                listKey: fileListKey,
                files: files,
                selectedFile: selectedFile,
                searchQuery: fileSearchQuery,
                searchResults: fileSearchResults,
                directoryChildren: directoryChildren,
                expandedDirectories: expandedDirectories,
                loadingDirectoryPaths: loadingDirectoryPaths,
                directoryErrors: directoryErrors,
                onSelected: onFileSelected,
                onDirectoryToggled: onDirectoryToggled ?? onFileSelected,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
