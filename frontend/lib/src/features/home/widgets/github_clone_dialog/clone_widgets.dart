part of '../github_clone_dialog.dart';

class _CloneTopBar extends StatelessWidget {
  const _CloneTopBar({
    required this.connected,
    required this.controller,
    required this.enabled,
    required this.onSearchChanged,
    required this.onClose,
  });

  final bool connected;
  final TextEditingController controller;
  final bool enabled;
  final ValueChanged<String> onSearchChanged;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: AppColors.chrome(context),
        border: Border(bottom: BorderSide(color: AppColors.line(context))),
      ),
      child: Row(
        children: [
          const _GitHubMark(size: 28),
          const SizedBox(width: 10),
          Expanded(
            child: SizedBox(
              height: 42,
              child: TextField(
                controller: controller,
                autofocus: true,
                enabled: enabled,
                textInputAction: TextInputAction.search,
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  hintText: 'Search repositories',
                  contentPadding: EdgeInsets.symmetric(vertical: 10),
                ),
                onChanged: onSearchChanged,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Icon(
            connected ? Icons.verified_outlined : Icons.error_outline,
            color: connected
                ? AppColors.accent(context)
                : AppColors.warning(context),
          ),
          const SizedBox(width: 4),
          IconButton(
            tooltip: 'Close',
            onPressed: onClose,
            icon: const Icon(Icons.close),
          ),
        ],
      ),
    );
  }
}

class _GitHubMark extends StatelessWidget {
  const _GitHubMark({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: _GitHubMarkPainter(
        color: Theme.of(context).brightness == Brightness.dark
            ? AppColors.primaryText(context)
            : const Color(0xFF111820),
      ),
    );
  }
}

class _GitHubMarkPainter extends CustomPainter {
  const _GitHubMarkPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    final w = size.width;
    final h = size.height;
    final path = Path()
      ..moveTo(w * 0.50, h * 0.07)
      ..cubicTo(w * 0.27, h * 0.07, w * 0.09, h * 0.25, w * 0.09, h * 0.49)
      ..cubicTo(w * 0.09, h * 0.67, w * 0.20, h * 0.82, w * 0.36, h * 0.88)
      ..lineTo(w * 0.36, h * 0.75)
      ..cubicTo(w * 0.29, h * 0.77, w * 0.24, h * 0.74, w * 0.21, h * 0.68)
      ..cubicTo(w * 0.18, h * 0.63, w * 0.14, h * 0.60, w * 0.09, h * 0.60)
      ..cubicTo(w * 0.15, h * 0.56, w * 0.21, h * 0.59, w * 0.25, h * 0.66)
      ..cubicTo(w * 0.28, h * 0.70, w * 0.32, h * 0.71, w * 0.37, h * 0.69)
      ..cubicTo(w * 0.38, h * 0.65, w * 0.41, h * 0.62, w * 0.44, h * 0.61)
      ..cubicTo(w * 0.31, h * 0.59, w * 0.17, h * 0.54, w * 0.17, h * 0.34)
      ..cubicTo(w * 0.17, h * 0.27, w * 0.20, h * 0.22, w * 0.25, h * 0.18)
      ..cubicTo(w * 0.24, h * 0.14, w * 0.25, h * 0.09, w * 0.27, h * 0.04)
      ..cubicTo(w * 0.34, h * 0.05, w * 0.39, h * 0.09, w * 0.42, h * 0.11)
      ..cubicTo(w * 0.47, h * 0.10, w * 0.53, h * 0.10, w * 0.58, h * 0.11)
      ..cubicTo(w * 0.61, h * 0.09, w * 0.66, h * 0.05, w * 0.73, h * 0.04)
      ..cubicTo(w * 0.75, h * 0.09, w * 0.76, h * 0.14, w * 0.75, h * 0.18)
      ..cubicTo(w * 0.80, h * 0.22, w * 0.83, h * 0.27, w * 0.83, h * 0.34)
      ..cubicTo(w * 0.83, h * 0.54, w * 0.69, h * 0.59, w * 0.56, h * 0.61)
      ..cubicTo(w * 0.60, h * 0.64, w * 0.63, h * 0.69, w * 0.63, h * 0.76)
      ..lineTo(w * 0.63, h * 0.88)
      ..cubicTo(w * 0.79, h * 0.82, w * 0.91, h * 0.67, w * 0.91, h * 0.49)
      ..cubicTo(w * 0.91, h * 0.25, w * 0.73, h * 0.07, w * 0.50, h * 0.07)
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _GitHubMarkPainter oldDelegate) {
    return oldDelegate.color != color;
  }
}

class _RepositoryStatusLine extends StatelessWidget {
  const _RepositoryStatusLine({
    required this.isSearching,
    required this.error,
    required this.repositoryCount,
    required this.hasMore,
  });

  final bool isSearching;
  final String? error;
  final int repositoryCount;
  final bool hasMore;

  @override
  Widget build(BuildContext context) {
    if (isSearching) {
      return Row(
        children: [
          const SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          const SizedBox(width: 8),
          Text(
            'Searching repositories...',
            style: TextStyle(color: AppColors.mutedText(context), fontSize: 12),
          ),
        ],
      );
    }
    return Text(
      error ??
          '$repositoryCount repositories'
              '${hasMore ? ' - more available' : ''}',
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        color: error == null
            ? AppColors.mutedText(context)
            : AppColors.warning(context),
        fontSize: 12,
        fontWeight: error == null ? FontWeight.w600 : FontWeight.w800,
      ),
    );
  }
}

class _CloneProgress extends StatelessWidget {
  const _CloneProgress({required this.repository});

  final GitHubRepository repository;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.accent(context).withValues(alpha: 0.12),
        border: Border.all(
          color: AppColors.accent(context).withValues(alpha: 0.32),
        ),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2.4),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Cloning ${repository.fullName}',
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RepositoryTile extends StatelessWidget {
  const _RepositoryTile({
    required this.repository,
    required this.disabled,
    required this.cloning,
    required this.onTap,
  });

  final GitHubRepository repository;
  final bool disabled;
  final bool cloning;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isCloned = repository.cloned;
    return Material(
      color: cloning || isCloned
          ? AppColors.accent(context).withValues(alpha: 0.10)
          : Colors.transparent,
      child: InkWell(
        onTap: disabled ? null : onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 1),
                child: Icon(
                  isCloned
                      ? Icons.check_circle_outline
                      : repository.private
                      ? Icons.lock_outline
                      : Icons.public,
                  color: isCloned
                      ? AppColors.accent(context)
                      : repository.private
                      ? AppColors.warning(context)
                      : AppColors.accent(context),
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(child: _RepositorySummary(repository: repository)),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Icon(
                  cloning
                      ? Icons.sync
                      : isCloned
                      ? Icons.folder_open_outlined
                      : Icons.chevron_right,
                  color: cloning
                      ? AppColors.accent(context)
                      : AppColors.mutedText(context),
                  size: 20,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RepositorySummary extends StatelessWidget {
  const _RepositorySummary({required this.repository});

  final GitHubRepository repository;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          repository.fullName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            Expanded(
              child: Text(
                repository.description?.isNotEmpty == true
                    ? repository.description!
                    : _repoSubtitle(repository),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: AppColors.mutedText(context),
                  fontSize: 12,
                ),
              ),
            ),
            const SizedBox(width: 8),
            if (repository.cloned) ...[
              const _ClonedMeta(),
              const SizedBox(width: 6),
            ],
            _PermissionMeta(repository: repository),
            const SizedBox(width: 6),
            _RepoMeta(repository: repository),
          ],
        ),
      ],
    );
  }
}

class _ClonedMeta extends StatelessWidget {
  const _ClonedMeta();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.success(context).withValues(alpha: 0.10),
        border: Border.all(
          color: AppColors.success(context).withValues(alpha: 0.26),
        ),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        child: Text(
          'Cloned',
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: AppColors.success(context),
            fontSize: 10,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

class _PermissionMeta extends StatelessWidget {
  const _PermissionMeta({required this.repository});

  final GitHubRepository repository;

  @override
  Widget build(BuildContext context) {
    final color = repository.canWrite
        ? AppColors.success(context)
        : repository.canRead
        ? AppColors.accent(context)
        : AppColors.warning(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        border: Border.all(color: color.withValues(alpha: 0.24)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        child: Text(
          repository.permissionLabel,
          overflow: TextOverflow.ellipsis,
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

class _RepoMeta extends StatelessWidget {
  const _RepoMeta({required this.repository});

  final GitHubRepository repository;

  @override
  Widget build(BuildContext context) {
    final label = repository.language?.isNotEmpty == true
        ? repository.language!
        : repository.defaultBranch;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.accent(context).withValues(alpha: 0.10),
        border: Border.all(
          color: AppColors.accent(context).withValues(alpha: 0.20),
        ),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        child: Text(
          label,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: AppColors.accent(context),
            fontSize: 10,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

String _repoSubtitle(GitHubRepository repository) {
  final parts = [
    if (repository.cloned)
      repository.clonedWorkspaceName?.isNotEmpty == true
          ? 'Cloned as ${repository.clonedWorkspaceName}'
          : 'Already cloned',
    if (repository.language != null && repository.language!.isNotEmpty)
      repository.language!,
    repository.private ? 'Private' : 'Public',
    repository.defaultBranch,
  ];
  return parts.join(' / ');
}

String _cacheKey(String query, int page) =>
    '${query.trim().toLowerCase()}::$page';
