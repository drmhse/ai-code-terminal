// ignore_for_file: invalid_use_of_protected_member

part of '../task_panel.dart';

extension _TaskDetailScroll on _TaskDetailViewState {
  Widget _buildDetailScroll({
    required NativeTaskRun? latestRun,
    required bool canEdit,
  }) {
    final builders = <WidgetBuilder>[
      (_) => _TaskStatusHeader(task: widget.task),
      if (latestRun?.codexSessionId?.isNotEmpty == true)
        (_) => OutlinedButton.icon(
          onPressed: () =>
              widget.onOpenCodexSession(latestRun!.codexSessionId!),
          icon: const Icon(Icons.forum_outlined, size: 18),
          label: const Text('Open chat'),
        ),
      (_) => TextField(
        controller: _titleController,
        decoration: InputDecoration(labelText: 'Title', errorText: _titleError),
        readOnly: !canEdit,
        onChanged: (_) {
          if (_titleError != null) {
            setState(() => _titleError = null);
          }
        },
      ),
      (_) => TextField(
        controller: _descriptionController,
        minLines: 4,
        maxLines: 8,
        decoration: const InputDecoration(
          labelText: 'Issue description',
          alignLabelWithHint: true,
        ),
        readOnly: !canEdit,
      ),
      (_) => TextField(
        controller: _reportController,
        minLines: 3,
        maxLines: 6,
        decoration: const InputDecoration(
          labelText: 'Final report instructions',
          alignLabelWithHint: true,
        ),
        readOnly: !canEdit,
      ),
      (_) => _TaskWorkspaceSelector(
        availableCollections: widget.availableCollections,
        availableWorkspaces: widget.availableWorkspaces,
        taskWorkspaces: widget.task.workspaces,
        selectedWorkspaceIds: _workspaceIds,
        selectedCollectionIds: _collectionIds,
        errorText: _workspaceError,
        enabled: canEdit,
        onChanged: _setWorkspaceSelected,
        onCollectionChanged: _setCollectionSelected,
      ),
      (_) => _TaskEditDropdown(
        label: 'Agent',
        value: _agentProvider,
        options: const [
          _TaskEditOption('Codex', 'codex', Icons.auto_awesome),
          _TaskEditOption('Pi', 'pi', Icons.hub_outlined),
        ],
        onChanged: canEdit
            ? (value) => setState(() => _agentProvider = value)
            : null,
      ),
      (_) => _TaskEditDropdown(
        label: 'Execution mode',
        value: _executionMode,
        options: const [
          _TaskEditOption('Plan only', 'plan', Icons.fact_check),
          _TaskEditOption('Research report', 'research', Icons.manage_search),
          _TaskEditOption('Implement', 'implement', Icons.build),
          _TaskEditOption(
            'Implement and PR',
            'implement_and_pr',
            Icons.call_merge,
          ),
        ],
        onChanged: canEdit
            ? (value) => setState(() {
                _executionMode = value;
                if (value == 'plan' || value == 'research') {
                  _approvalMode = 'ask_before_edits';
                }
              })
            : null,
      ),
      (_) => _TaskEditDropdown(
        label: 'Approval mode',
        value: _approvalMode,
        options: const [
          _TaskEditOption('Ask before edits', 'ask_before_edits', Icons.rule),
          _TaskEditOption('Auto edit', 'auto_edit', Icons.edit),
          _TaskEditOption(
            'Auto edit and create PR',
            'auto_edit_and_create_pr',
            Icons.playlist_add_check,
          ),
        ],
        onChanged: canEdit
            ? (value) => setState(() => _approvalMode = value)
            : null,
      ),
      (_) => _TaskEditDropdown(
        label: 'Evidence',
        value: _evidencePreference,
        options: const [
          _TaskEditOption('Tests only', 'tests_only', Icons.science),
          _TaskEditOption(
            'Tests plus screenshots',
            'tests_plus_screenshots',
            Icons.screenshot_monitor,
          ),
          _TaskEditOption('Full evidence', 'full_evidence', Icons.inventory_2),
        ],
        onChanged: canEdit
            ? (value) => setState(() => _evidencePreference = value)
            : null,
      ),
      if (widget.task.attachments.isNotEmpty)
        (_) => _TaskDetailSection(
          title: 'Attachments',
          icon: Icons.attach_file,
          children: [
            for (final attachment in widget.task.attachments)
              _DetailRow(
                label: attachment.originalFilename,
                value: _formatBytes(attachment.byteSize),
              ),
          ],
        ),
      (_) => _TaskDetailSection(
        title: 'Runs',
        icon: Icons.history,
        children: [
          if (latestRun == null)
            const Text('No runs yet')
          else ...[
            _DetailRow(label: 'Latest', value: latestRun.status),
            _DetailRow(
              label: 'Agent',
              value: CodingAgents.byId(latestRun.agentProvider).label,
            ),
            if (latestRun.codexSessionId?.isNotEmpty == true)
              _DetailRow(label: 'Chat', value: latestRun.codexSessionId!),
            _DetailRow(label: 'Mode', value: latestRun.executionMode),
            _DetailRow(
              label: 'Artifacts',
              value: '${latestRun.artifacts.length}',
            ),
            _DetailRow(
              label: 'PRs',
              value: latestRun.pullRequests.isEmpty
                  ? 'None'
                  : '${latestRun.pullRequests.length}',
            ),
          ],
        ],
      ),
      if (latestRun != null) ..._latestRunBuilders(latestRun),
    ];
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 16),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      itemCount: builders.length,
      itemBuilder: (context, index) {
        final child = builders[index](context);
        return RepaintBoundary(
          child: Padding(
            padding: EdgeInsets.only(top: index == 0 ? 0 : 12),
            child: child,
          ),
        );
      },
    );
  }

  List<WidgetBuilder> _latestRunBuilders(NativeTaskRun latestRun) {
    return [
      (_) => _TaskDetailSection(
        title: 'Report',
        icon: Icons.article_outlined,
        children: [
          if (latestRun.finalReport?.trim().isNotEmpty == true)
            _TaskMarkdown(data: latestRun.finalReport!)
          else
            const Text('No final report has been promoted yet.'),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (_taskCanFinalize(widget.task, latestRun))
                OutlinedButton.icon(
                  onPressed: _isFinalizing ? null : () => _finalize(latestRun),
                  icon: _isFinalizing
                      ? const SizedBox.square(
                          dimension: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.sync, size: 16),
                  label: Text(
                    widget.task.status == 'needs_attention'
                        ? 'Retry finalize'
                        : 'Finalize',
                  ),
                ),
              if (_taskCanCreatePullRequests(latestRun))
                OutlinedButton.icon(
                  onPressed: _isCreatingPrs
                      ? null
                      : () => _createPullRequests(latestRun),
                  icon: _isCreatingPrs
                      ? const SizedBox.square(
                          dimension: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.call_merge, size: 16),
                  label: const Text('Create PR'),
                ),
            ],
          ),
        ],
      ),
      (_) => _TaskDetailSection(
        title: 'Evidence',
        icon: Icons.fact_check_outlined,
        children: [
          _DetailRow(
            label: 'Requested',
            value: widget.task.evidencePreference.replaceAll('_', ' '),
          ),
          _DetailRow(
            label: 'Provided',
            value: latestRun.artifacts.isEmpty
                ? 'No indexed artifacts'
                : '${latestRun.artifacts.length} artifacts indexed',
          ),
          if (latestRun.artifacts.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                'Run finalization must index evidence before preview is available.',
              ),
            ),
        ],
      ),
      if (latestRun.artifacts.isNotEmpty)
        (_) => const _TaskDetailSectionHeader(
          title: 'Artifacts',
          icon: Icons.inventory_2_outlined,
        ),
      for (final artifact in latestRun.artifacts)
        (_) => _ArtifactTile(
          key: ValueKey('task-artifact-${artifact.id}'),
          task: widget.task,
          run: latestRun,
          artifact: artifact,
          onLoadArtifact: widget.onLoadArtifact,
        ),
      if (latestRun.pullRequests.isNotEmpty)
        (_) => const _TaskDetailSectionHeader(
          title: 'Pull Requests',
          icon: Icons.call_merge,
        ),
      for (final pr in latestRun.pullRequests)
        (_) => _PullRequestTile(key: ValueKey('task-pr-${pr.id}'), pr: pr),
    ];
  }
}

class _TaskDetailSectionHeader extends StatelessWidget {
  const _TaskDetailSectionHeader({required this.title, required this.icon});

  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.line(context)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.accent(context), size: 18),
          const SizedBox(width: 8),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}
