import 'dart:async';

import 'package:act_frontend/src/app/app_colors.dart';
import 'package:act_frontend/src/models/workspace_git_changes.dart';
import 'package:act_frontend/src/services/act_api.dart';
import 'package:flutter/material.dart';

class WorkspaceChangesPage extends StatefulWidget {
  const WorkspaceChangesPage({required this.api, super.key});

  final ActApi api;

  @override
  State<WorkspaceChangesPage> createState() => _WorkspaceChangesPageState();
}

class _WorkspaceChangesPageState extends State<WorkspaceChangesPage> {
  late Future<_WorkspaceChangesSnapshot> _future;
  bool _onlyAttention = true;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_WorkspaceChangesSnapshot> _load() async {
    final results = await Future.wait([
      widget.api.workspaceGitChanges(),
      widget.api.githubCliStatus(),
    ]);
    return _WorkspaceChangesSnapshot(
      workspaces: results[0] as List<WorkspaceGitChangesOverview>,
      cliStatus: results[1] as GitHubCliStatus,
    );
  }

  void _refresh() {
    setState(() => _future = _load());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Workspace changes'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: FutureBuilder<_WorkspaceChangesSnapshot>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _ErrorState(
              message: snapshot.error.toString(),
              onRetry: _refresh,
            );
          }
          final data = snapshot.requireData;
          final visible = _onlyAttention
              ? data.workspaces
                    .where((workspace) => workspace.needsAttention)
                    .toList()
              : data.workspaces;
          return Column(
            children: [
              _GitHubCliBanner(status: data.cliStatus),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: Row(
                  children: [
                    SegmentedButton<bool>(
                      segments: const [
                        ButtonSegment(
                          value: true,
                          icon: Icon(Icons.priority_high),
                          label: Text('Attention'),
                        ),
                        ButtonSegment(
                          value: false,
                          icon: Icon(Icons.inventory_2_outlined),
                          label: Text('All'),
                        ),
                      ],
                      selected: {_onlyAttention},
                      onSelectionChanged: (value) {
                        setState(() => _onlyAttention = value.first);
                      },
                    ),
                    const Spacer(),
                    Text(
                      '${visible.length}/${data.workspaces.length}',
                      style: TextStyle(
                        color: AppColors.secondaryText(context),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: visible.isEmpty
                    ? const _EmptyState()
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        itemCount: visible.length,
                        separatorBuilder: (_, _) =>
                            Divider(height: 1, color: AppColors.line(context)),
                        itemBuilder: (context, index) {
                          return _WorkspaceGitTile(workspace: visible[index]);
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _WorkspaceChangesSnapshot {
  const _WorkspaceChangesSnapshot({
    required this.workspaces,
    required this.cliStatus,
  });

  final List<WorkspaceGitChangesOverview> workspaces;
  final GitHubCliStatus cliStatus;
}

class _GitHubCliBanner extends StatelessWidget {
  const _GitHubCliBanner({required this.status});

  final GitHubCliStatus status;

  @override
  Widget build(BuildContext context) {
    final ok = status.installed && status.authenticated;
    final icon = !status.installed
        ? Icons.download_outlined
        : ok
        ? Icons.verified_outlined
        : Icons.key_off_outlined;
    final title = !status.installed
        ? 'GitHub CLI unavailable'
        : ok
        ? 'GitHub CLI ready'
        : 'GitHub CLI needs GitHub access';
    final detail = ok
        ? [
            if (status.username?.isNotEmpty == true) status.username!,
            if (status.version?.isNotEmpty == true) status.version!,
          ].join(' - ')
        : status.message ?? 'Reconnect GitHub or install gh on the ACT host.';
    return Container(
      width: double.infinity,
      color: ok
          ? AppColors.success(context).withValues(alpha: 0.10)
          : AppColors.warning(context).withValues(alpha: 0.12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Icon(
            icon,
            color: ok ? AppColors.success(context) : AppColors.warning(context),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 2),
                Text(
                  detail,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: AppColors.secondaryText(context)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WorkspaceGitTile extends StatelessWidget {
  const _WorkspaceGitTile({required this.workspace});

  final WorkspaceGitChangesOverview workspace;

  @override
  Widget build(BuildContext context) {
    final color = workspace.error != null
        ? AppColors.error(context)
        : workspace.needsAttention
        ? AppColors.warning(context)
        : AppColors.success(context);
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 0, vertical: 8),
      leading: Icon(_statusIcon(workspace), color: color),
      title: Text(
        workspace.name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w900),
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 4),
          Text(
            workspace.localPath,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: AppColors.mutedText(context)),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              _Pill(
                icon: Icons.account_tree,
                label: workspace.branch ?? 'detached',
              ),
              if (workspace.localChangeCount > 0)
                _Pill(
                  icon: Icons.edit_note,
                  label: '${workspace.localChangeCount} local',
                ),
              if (workspace.ahead > 0)
                _Pill(icon: Icons.upload, label: '${workspace.ahead} ahead'),
              if (workspace.behind > 0)
                _Pill(
                  icon: Icons.download,
                  label: '${workspace.behind} behind',
                ),
              if (!workspace.isGitRepository)
                const _Pill(icon: Icons.folder_off_outlined, label: 'not git'),
            ],
          ),
          if (workspace.error?.isNotEmpty == true) ...[
            const SizedBox(height: 8),
            Text(
              workspace.error!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: AppColors.error(context)),
            ),
          ],
        ],
      ),
    );
  }

  IconData _statusIcon(WorkspaceGitChangesOverview workspace) {
    if (workspace.error != null) {
      return Icons.error_outline;
    }
    if (workspace.hasUncommittedChanges && workspace.hasUnpushedChanges) {
      return Icons.sync_problem;
    }
    if (workspace.hasUncommittedChanges) {
      return Icons.edit;
    }
    if (workspace.hasUnpushedChanges) {
      return Icons.publish;
    }
    return Icons.check_circle_outline;
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.field(context),
        border: Border.all(color: AppColors.line(context)),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.secondaryText(context)),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        'No workspaces need attention',
        style: TextStyle(color: AppColors.secondaryText(context)),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, color: AppColors.error(context)),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
