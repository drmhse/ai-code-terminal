part of '../codex_session_panel.dart';

class _PendingCodexMessage {
  const _PendingCodexMessage({required this.text});

  final String text;
}

class _CodexThreadSwitcher extends StatelessWidget {
  const _CodexThreadSwitcher({
    required this.session,
    required this.sessionCount,
    required this.workspace,
    required this.collection,
    required this.filterWorkspace,
    required this.filterCollection,
    required this.showingAllWorkspaces,
    required this.defaultAgentProvider,
    required this.isLoading,
    required this.showActions,
    required this.onNewChat,
    required this.onPreviewChanges,
    required this.onCreatePullRequests,
    required this.onFilter,
    this.onManageCollections,
    required this.onPressed,
  });

  final CodexSessionSummary? session;
  final int sessionCount;
  final Workspace? workspace;
  final WorkspaceCollection? collection;
  final Workspace? filterWorkspace;
  final WorkspaceCollection? filterCollection;
  final bool showingAllWorkspaces;
  final String defaultAgentProvider;
  final bool isLoading;
  final bool showActions;
  final VoidCallback onNewChat;
  final VoidCallback? onPreviewChanges;
  final VoidCallback? onCreatePullRequests;
  final VoidCallback onFilter;
  final VoidCallback? onManageCollections;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final session = this.session;
    final workspace = this.workspace;
    final collection = this.collection;
    final primaryWorkspace = collection?.primaryWorkspace;
    final status = session == null ? 'Draft' : _sessionStatusLabel(session);
    final countLabel = sessionCount == 1
        ? '1 conversation'
        : '$sessionCount conversations';
    final draftScope = collection == null
        ? workspace == null
              ? 'No workspace selected'
              : 'Workspace: ${workspace.name}'
        : 'Collection: ${collection.name}'
              '${primaryWorkspace == null ? '' : ' -> ${primaryWorkspace.name}'}';
    final filterScope = showingAllWorkspaces
        ? 'All conversations'
        : 'Filter: ${filterCollection?.name ?? filterWorkspace?.name ?? 'custom'}';
    final tagLabel = session == null
        ? null
        : _sessionWorkspaceTagsLabel(session);
    final scopeLabel = session == null ? draftScope : tagLabel ?? filterScope;
    final agent = CodingAgents.byId(
      session?.agentProvider ?? defaultAgentProvider,
    );
    return Material(
      color: AppColors.chrome(context),
      child: InkWell(
        onTap: onPressed,
        child: Container(
          height: 58,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(
            children: [
              Icon(
                Icons.forum_outlined,
                size: 20,
                color: session == null
                    ? AppColors.mutedText(context)
                    : _sessionStatusColor(context, session),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      session?.title ??
                          (collection == null
                              ? 'Start a workspace chat'
                              : 'Start a collection chat'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.primaryText(context),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${agent.label} - $scopeLabel - $status - $countLabel',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.mutedText(context),
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _AgentBadge(agent: agent),
              if (onCreatePullRequests != null)
                IconButton(
                  tooltip: 'Create or update PR',
                  onPressed: onCreatePullRequests,
                  icon: Icon(
                    Icons.call_merge,
                    size: 18,
                    color: AppColors.accent(context),
                  ),
                ),
              if (showActions && isLoading)
                const SizedBox.square(
                  dimension: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else if (showActions)
                IconButton(
                  tooltip: 'New chat',
                  onPressed: onNewChat,
                  icon: Icon(
                    Icons.add_comment_outlined,
                    size: 18,
                    color: AppColors.secondaryText(context),
                  ),
                ),
              if (showActions)
                IconButton(
                  tooltip: 'Preview changes',
                  onPressed: onPreviewChanges,
                  icon: Icon(
                    Icons.difference_outlined,
                    size: 18,
                    color: onPreviewChanges == null
                        ? AppColors.mutedText(context)
                        : AppColors.secondaryText(context),
                  ),
                ),
              if (showActions)
                IconButton(
                  tooltip: 'Manage collections',
                  onPressed: onManageCollections,
                  icon: Icon(
                    Icons.account_tree_outlined,
                    size: 18,
                    color: collection == null
                        ? AppColors.secondaryText(context)
                        : AppColors.accent(context),
                  ),
                ),
              if (showActions)
                IconButton(
                  tooltip: 'Filter conversations',
                  onPressed: onFilter,
                  icon: Icon(
                    showingAllWorkspaces
                        ? Icons.filter_list_off
                        : Icons.filter_list,
                    size: 18,
                    color: AppColors.secondaryText(context),
                  ),
                ),
              Icon(
                showActions ? Icons.expand_more : Icons.view_list_outlined,
                color: onPressed == null
                    ? AppColors.mutedText(context)
                    : AppColors.secondaryText(context),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AgentBadge extends StatelessWidget {
  const _AgentBadge({required this.agent});

  final CodingAgent agent;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Agent: ${agent.label}',
      child: Container(
        height: 28,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        decoration: BoxDecoration(
          color: AppColors.accent(context).withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.line(context)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(agent.icon, size: 15, color: AppColors.accent(context)),
            const SizedBox(width: 5),
            Text(
              agent.shortLabel,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
            ),
          ],
        ),
      ),
    );
  }
}

class _CodexSessionSheet extends StatelessWidget {
  const _CodexSessionSheet({
    required this.sessions,
    required this.selectedSessionId,
    required this.onNewChat,
    required this.onSelected,
    required this.onOpenLinkedTerminal,
    this.onPreviewChanges,
  });

  final List<CodexSessionSummary> sessions;
  final String? selectedSessionId;
  final VoidCallback onNewChat;
  final ValueChanged<CodexSessionSummary> onSelected;
  final ValueChanged<CodexSessionSummary> onOpenLinkedTerminal;
  final ValueChanged<CodexSessionSummary>? onPreviewChanges;

  @override
  Widget build(BuildContext context) {
    return FractionallySizedBox(
      heightFactor: 0.72,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 10, 8),
            child: Row(
              children: [
                Icon(Icons.forum_outlined, color: AppColors.accent(context)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Agent conversations',
                    style: TextStyle(
                      color: AppColors.primaryText(context),
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'New chat',
                  onPressed: onNewChat,
                  icon: const Icon(Icons.add_comment_outlined),
                ),
                IconButton(
                  tooltip: 'Close',
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: AppColors.line(context)),
          Expanded(
            child: ListView.separated(
              itemCount: sessions.length,
              separatorBuilder: (_, _) =>
                  Divider(height: 1, color: AppColors.line(context)),
              itemBuilder: (context, index) {
                final session = sessions[index];
                final selected = session.id == selectedSessionId;
                return ListTile(
                  selected: selected,
                  selectedTileColor: AppColors.accent(
                    context,
                  ).withValues(alpha: 0.12),
                  leading: Icon(
                    Icons.circle,
                    size: 10,
                    color: _sessionStatusColor(context, session),
                  ),
                  title: Text(
                    session.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: Text(
                    '${CodingAgents.byId(session.agentProvider).label} - ${_sessionStatusLabel(session)} - ${_sessionWorkspaceTagsLabel(session) ?? _shortPath(session.cwd ?? session.rolloutPath)}'
                    '${session.updatedAt == null ? '' : ' - ${_timeLabel(session.updatedAt)}'}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing:
                      session.terminalSessionId == null &&
                          onPreviewChanges == null
                      ? null
                      : Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (onPreviewChanges != null)
                              IconButton(
                                tooltip: 'Preview changes',
                                onPressed: () => onPreviewChanges!(session),
                                icon: const Icon(Icons.difference_outlined),
                              ),
                            if (session.terminalSessionId != null)
                              IconButton(
                                tooltip: 'Open linked terminal',
                                onPressed: () => onOpenLinkedTerminal(session),
                                icon: const Icon(Icons.terminal),
                              ),
                          ],
                        ),
                  onTap: () => onSelected(session),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class CodexWorkspaceFilterSheet extends StatelessWidget {
  const CodexWorkspaceFilterSheet({
    required this.workspaces,
    required this.collections,
    required this.selectedWorkspaceId,
    required this.selectedCollectionId,
    required this.onAllSelected,
    required this.onWorkspaceSelected,
    required this.onCollectionSelected,
    super.key,
  });

  final List<Workspace> workspaces;
  final List<WorkspaceCollection> collections;
  final String? selectedWorkspaceId;
  final String? selectedCollectionId;
  final VoidCallback onAllSelected;
  final ValueChanged<String?> onWorkspaceSelected;
  final ValueChanged<String?> onCollectionSelected;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 10, 8),
            child: Row(
              children: [
                Icon(Icons.filter_list, color: AppColors.accent(context)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Conversation filter',
                    style: TextStyle(
                      color: AppColors.primaryText(context),
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Close',
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: AppColors.line(context)),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              children: [
                ListTile(
                  selected:
                      selectedWorkspaceId == null &&
                      selectedCollectionId == null,
                  leading: const Icon(Icons.all_inbox),
                  title: const Text('All conversations'),
                  onTap: onAllSelected,
                ),
                if (collections.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                    child: Text(
                      'COLLECTIONS',
                      style: TextStyle(
                        color: AppColors.mutedText(context),
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                for (final collection in collections)
                  ListTile(
                    selected: collection.id == selectedCollectionId,
                    leading: const Icon(Icons.account_tree_outlined),
                    title: Text(
                      collection.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      '${collection.members.length} projects',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    onTap: () => onCollectionSelected(collection.id),
                  ),
                if (workspaces.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                    child: Text(
                      'PROJECTS',
                      style: TextStyle(
                        color: AppColors.mutedText(context),
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                for (final workspace in workspaces)
                  ListTile(
                    selected: workspace.id == selectedWorkspaceId,
                    leading: const Icon(Icons.folder_outlined),
                    title: Text(
                      workspace.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      workspace.githubRepo.isNotEmpty
                          ? workspace.githubRepo
                          : workspace.localPath,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    onTap: () => onWorkspaceSelected(workspace.id),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
