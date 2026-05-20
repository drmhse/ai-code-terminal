part of '../act_home_page.dart';

// ignore_for_file: invalid_use_of_protected_member

extension _ActHomeCodexChangePreviewActions on _ActHomePageState {
  void _previewCodexSessionChanges(CodexSessionSummary session) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.chrome(context),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
      ),
      builder: (context) => _CodexChangesPreviewSheet(
        session: session,
        changes: _api.codexSessionChanges(session.id),
      ),
    );
  }
}

class _CodexChangesPreviewSheet extends StatelessWidget {
  const _CodexChangesPreviewSheet({
    required this.session,
    required this.changes,
  });

  final CodexSessionSummary session;
  final Future<CodexSessionChanges> changes;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: FractionallySizedBox(
        heightFactor: 0.88,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: FutureBuilder<CodexSessionChanges>(
            future: changes,
            builder: (context, snapshot) {
              final data = snapshot.data;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.difference_outlined,
                        color: AppColors.accent(context),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Preview changes',
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                color: AppColors.primaryText(context),
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Close',
                        onPressed: () => Navigator.of(context).pop(),
                        icon: Icon(
                          Icons.close,
                          color: AppColors.secondaryText(context),
                        ),
                      ),
                    ],
                  ),
                  Text(
                    session.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: AppColors.mutedText(context)),
                  ),
                  const SizedBox(height: 12),
                  if (snapshot.connectionState != ConnectionState.done)
                    const Expanded(
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else if (snapshot.hasError)
                    Expanded(
                      child: _CodexChangesError(message: '${snapshot.error}'),
                    )
                  else if (data == null)
                    const Expanded(child: _CodexChangesEmpty())
                  else
                    Expanded(child: _CodexChangesContent(changes: data)),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _CodexChangesContent extends StatelessWidget {
  const _CodexChangesContent({required this.changes});

  final CodexSessionChanges changes;

  @override
  Widget build(BuildContext context) {
    final summary = changes.summary;
    final branch = changes.branch?.trim();
    return ListView(
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _CodexChangeChip(
              label: '${summary.changedFiles} files',
              color: AppColors.accent(context),
            ),
            if (summary.stagedFiles > 0)
              _CodexChangeChip(
                label: '${summary.stagedFiles} staged',
                color: AppColors.success(context),
              ),
            if (summary.unstagedFiles > 0)
              _CodexChangeChip(
                label: '${summary.unstagedFiles} unstaged',
                color: AppColors.accent(context),
              ),
            if (summary.untrackedFiles > 0)
              _CodexChangeChip(
                label: '${summary.untrackedFiles} untracked',
                color: AppColors.secondaryText(context),
              ),
            if (branch?.isNotEmpty == true)
              _CodexChangeChip(
                label: branch!,
                color: AppColors.secondaryText(context),
              ),
            if (changes.truncated)
              _CodexChangeChip(
                label: 'truncated',
                color: AppColors.warning(context),
              ),
          ],
        ),
        const SizedBox(height: 14),
        if (changes.files.isEmpty)
          const _CodexChangesEmpty()
        else
          ...changes.files.map((file) => _CodexChangedFileRow(file: file)),
        if (changes.diffStat.trim().isNotEmpty) ...[
          const SizedBox(height: 14),
          _CodexDiffBlock(title: 'Stat', text: changes.diffStat),
        ],
        const SizedBox(height: 14),
        _CodexDiffBlock(
          title: 'Diff',
          text: changes.diff.trim().isEmpty
              ? 'No tracked diff available. Untracked files are listed above.'
              : changes.diff,
        ),
      ],
    );
  }
}

class _CodexChangedFileRow extends StatelessWidget {
  const _CodexChangedFileRow({required this.file});

  final CodexChangedFile file;

  @override
  Widget build(BuildContext context) {
    final color = _codexChangeStatusColor(context, file.status);
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.line(context)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 22,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              _codexChangeStatusLetter(file.status),
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w800,
                fontSize: 11,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  file.path,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.primaryText(context),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (file.oldPath?.isNotEmpty == true)
                  Text(
                    file.oldPath!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.mutedText(context),
                      fontSize: 11,
                    ),
                  ),
              ],
            ),
          ),
          Text(
            file.status,
            style: TextStyle(color: AppColors.mutedText(context), fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _CodexChangeChip extends StatelessWidget {
  const _CodexChangeChip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        border: Border.all(color: color.withValues(alpha: 0.5)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w800,
          fontSize: 12,
        ),
      ),
    );
  }
}

class _CodexChangesError extends StatelessWidget {
  const _CodexChangesError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: TextStyle(color: AppColors.warning(context)),
      ),
    );
  }
}

class _CodexChangesEmpty extends StatelessWidget {
  const _CodexChangesEmpty();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        'No git changes',
        style: TextStyle(color: AppColors.mutedText(context)),
      ),
    );
  }
}

Color _codexChangeStatusColor(BuildContext context, String status) {
  switch (status) {
    case 'conflicted':
    case 'deleted':
      return AppColors.warning(context);
    case 'added':
    case 'staged':
      return AppColors.success(context);
    case 'untracked':
      return AppColors.secondaryText(context);
    default:
      return AppColors.accent(context);
  }
}

String _codexChangeStatusLetter(String status) {
  switch (status) {
    case 'conflicted':
      return '!';
    case 'deleted':
      return 'D';
    case 'renamed':
      return 'R';
    case 'added':
      return 'A';
    case 'untracked':
      return '?';
    default:
      return 'M';
  }
}
