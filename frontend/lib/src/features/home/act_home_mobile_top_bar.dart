part of 'act_home_page.dart';

extension _ActHomeMobileTopBar on _ActHomePageState {
  String get _mobileTopBarTitle {
    return switch (_mobileIndex.clamp(0, 3)) {
      0 => 'Workspace',
      2 => 'ACT Tasks',
      3 => 'Agent',
      _ => 'ACT',
    };
  }

  IconData get _mobileTopBarIcon {
    return switch (_mobileIndex.clamp(0, 3)) {
      0 => Icons.folder_open,
      2 => Icons.task_alt,
      3 => CodingAgents.byId(_selectedAgentProvider).icon,
      _ => Icons.terminal,
    };
  }

  List<AppTopBarAction> get _mobileTopBarActions {
    return switch (_mobileIndex.clamp(0, 3)) {
      0 => [
        AppTopBarAction(
          tooltip: _isPreparingGitHubClone
              ? 'Opening GitHub'
              : 'Clone from GitHub',
          icon: Icons.download_outlined,
          busy: _isPreparingGitHubClone,
          onPressed: _isRefreshingWorkspaces || _isPreparingGitHubClone
              ? null
              : _showCloneRepositoryDialog,
        ),
        AppTopBarAction(
          tooltip: 'Manage collections',
          icon: Icons.account_tree_outlined,
          onPressed: _isRefreshingWorkspaces ? null : _showCollectionManager,
        ),
        AppTopBarAction(
          tooltip: 'Create workspace',
          icon: Icons.add,
          onPressed: _isRefreshingWorkspaces
              ? null
              : _showCreateWorkspaceDialog,
        ),
      ],
      2 => [
        AppTopBarAction(
          tooltip: 'Refresh tasks',
          icon: Icons.refresh,
          onPressed: _isLoadingTasks
              ? null
              : () => _refreshTasksForWorkspace(_selectedWorkspace),
        ),
        AppTopBarAction(
          tooltip: 'New task',
          icon: Icons.add_task,
          onPressed: _showCreateTaskDialog,
        ),
      ],
      3 => [
        AppTopBarAction(
          tooltip: 'New chat',
          icon: Icons.add_comment_outlined,
          onPressed: _startNewCodexChat,
        ),
        AppTopBarAction(
          tooltip: 'Manage collections',
          icon: Icons.account_tree_outlined,
          onPressed: _hasToken ? _showCollectionManager : null,
        ),
        AppTopBarAction(
          tooltip: 'Filter conversations',
          icon:
              _codexWorkspaceFilterId == null &&
                  _codexCollectionFilterId == null
              ? Icons.filter_list_off
              : Icons.filter_list,
          onPressed: _showCodexConversationFilter,
        ),
      ],
      _ => const <AppTopBarAction>[],
    };
  }

  Future<void> _showCodexConversationFilter() async {
    await showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      backgroundColor: AppColors.panel(context),
      builder: (context) {
        return CodexWorkspaceFilterSheet(
          workspaces: _workspaces,
          collections: _collections,
          selectedWorkspaceId: _codexWorkspaceFilterId,
          selectedCollectionId: _codexCollectionFilterId,
          onWorkspaceSelected: (workspaceId) {
            Navigator.pop(context);
            _setCodexWorkspaceFilter(workspaceId);
          },
          onCollectionSelected: (collectionId) {
            Navigator.pop(context);
            _setCodexCollectionFilter(collectionId);
          },
          onAllSelected: () {
            Navigator.pop(context);
            _setCodexWorkspaceFilter(null);
          },
        );
      },
    );
  }
}
