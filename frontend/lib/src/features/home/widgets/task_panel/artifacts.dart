part of '../task_panel.dart';
// ignore_for_file: invalid_use_of_protected_member

class _ArtifactTile extends StatefulWidget {
  const _ArtifactTile({
    required this.task,
    required this.run,
    required this.artifact,
    required this.onLoadArtifact,
    super.key,
  });

  final NativeTask task;
  final NativeTaskRun run;
  final NativeTaskArtifact artifact;
  final TaskArtifactLoadCallback onLoadArtifact;

  @override
  State<_ArtifactTile> createState() => _ArtifactTileState();
}

class _ArtifactTileState extends State<_ArtifactTile> {
  NativeTaskArtifactContent? _content;
  bool _loading = false;
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final artifact = widget.artifact;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.field(context),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.line(context)),
      ),
      child: ExpansionTile(
        initiallyExpanded: _expanded,
        onExpansionChanged: (expanded) {
          setState(() => _expanded = expanded);
          if (expanded && _content == null && !_loading) {
            _load();
          }
        },
        leading: Icon(_artifactIcon(artifact.previewKind), size: 18),
        title: Text(
          artifact.name,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
        ),
        subtitle: Text(
          [
            artifact.previewKind,
            _formatArtifactBytes(artifact.byteSize),
            if (artifact.sourcePath?.isNotEmpty == true) artifact.sourcePath!,
          ].join(' / '),
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: AppColors.mutedText(context), fontSize: 11),
        ),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: _artifactPreview(context),
          ),
        ],
      ),
    );
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final content = await widget.onLoadArtifact(
        widget.task,
        widget.run,
        widget.artifact,
      );
      if (mounted) {
        setState(() => _content = content);
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Widget _artifactPreview(BuildContext context) {
    if (_loading) {
      return const LinearProgressIndicator(minHeight: 2);
    }
    final content = _content;
    if (content == null) {
      return Text(
        'Expand to preview.',
        style: TextStyle(color: AppColors.mutedText(context), fontSize: 12),
      );
    }
    final previewKind = content.artifact.previewKind;
    if (previewKind == 'markdown' && content.text != null) {
      return _TaskMarkdown(data: content.text!);
    }
    if (previewKind == 'svg' && content.text != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: SvgPicture.string(content.text!, fit: BoxFit.contain),
      );
    }
    if (previewKind == 'image' && content.base64 != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.memory(base64Decode(content.base64!), fit: BoxFit.contain),
      );
    }
    if (previewKind == 'pdf' && content.base64 != null) {
      return SizedBox(
        height: 420,
        child: SfPdfViewer.memory(base64Decode(content.base64!)),
      );
    }
    if (previewKind == 'video' && content.base64 != null) {
      return _ArtifactVideoPreview(content: content);
    }
    if (content.text != null) {
      return SelectableText(
        content.text!.trimRight(),
        style: TextStyle(
          color: AppColors.primaryText(context),
          fontFamily: 'monospace',
          fontSize: 12,
          height: 1.32,
        ),
      );
    }
    return Text(
      content.rawUrl == null
          ? 'Binary preview is not available.'
          : 'Binary preview is not available. Use the raw artifact endpoint to inspect this file.',
      style: TextStyle(color: AppColors.mutedText(context), fontSize: 12),
    );
  }
}

class _ArtifactVideoPreview extends StatefulWidget {
  const _ArtifactVideoPreview({required this.content});

  final NativeTaskArtifactContent content;

  @override
  State<_ArtifactVideoPreview> createState() => _ArtifactVideoPreviewState();
}

class _ArtifactVideoPreviewState extends State<_ArtifactVideoPreview> {
  VideoPlayerController? _controller;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _initialize() async {
    try {
      final bytes = base64Decode(widget.content.base64!);
      final uri = Uri.dataFromBytes(
        bytes,
        mimeType: widget.content.artifact.contentType ?? 'video/mp4',
      );
      final controller = VideoPlayerController.networkUrl(uri);
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() => _controller = controller);
    } catch (error) {
      if (mounted) {
        setState(() => _error = error);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final error = _error;
    if (error != null) {
      return Text(
        'Video preview is unavailable: $error',
        style: TextStyle(color: AppColors.mutedText(context), fontSize: 12),
      );
    }
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) {
      return const LinearProgressIndicator(minHeight: 2);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AspectRatio(
          aspectRatio: controller.value.aspectRatio == 0
              ? 16 / 9
              : controller.value.aspectRatio,
          child: VideoPlayer(controller),
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerLeft,
          child: OutlinedButton.icon(
            onPressed: () {
              setState(() {
                controller.value.isPlaying
                    ? controller.pause()
                    : controller.play();
              });
            },
            icon: Icon(
              controller.value.isPlaying ? Icons.pause : Icons.play_arrow,
              size: 16,
            ),
            label: Text(controller.value.isPlaying ? 'Pause' : 'Play'),
          ),
        ),
      ],
    );
  }
}

class _PullRequestTile extends StatelessWidget {
  const _PullRequestTile({required this.pr, super.key});

  final NativeTaskPullRequest pr;

  @override
  Widget build(BuildContext context) {
    final hasUrl = pr.url.trim().isNotEmpty;
    final action = pr.action.isEmpty ? pr.state : pr.action;
    final warning =
        const {'created', 'updated', 'unchanged'}.contains(action) &&
        pr.error?.toLowerCase().startsWith('warning:') == true;
    final failed = action == 'failed' || pr.state == 'failed';
    return ListTile(
      dense: true,
      contentPadding: EdgeInsets.zero,
      leading: Icon(
        failed
            ? Icons.error_outline
            : warning
            ? Icons.warning_amber_outlined
            : Icons.call_merge,
        color: warning
            ? AppColors.warning(context)
            : failed
            ? AppColors.warning(context)
            : AppColors.success(context),
      ),
      title: Text(
        pr.repository.isEmpty ? 'Pull request' : pr.repository,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Text(
        pr.error?.isNotEmpty == true
            ? pr.error!
            : [pr.branch, action].whereType<String>().join(' / '),
        overflow: TextOverflow.ellipsis,
      ),
      trailing: hasUrl
          ? IconButton(
              tooltip: 'Open PR',
              icon: const Icon(Icons.open_in_new, size: 17),
              onPressed: () {
                final uri = Uri.tryParse(pr.url);
                if (uri != null) {
                  launchUrl(uri, mode: LaunchMode.externalApplication);
                }
              },
            )
          : null,
    );
  }
}

IconData _artifactIcon(String previewKind) {
  return switch (previewKind) {
    'markdown' => Icons.article_outlined,
    'image' || 'svg' => Icons.image_outlined,
    'html' => Icons.web_asset_outlined,
    'log' || 'text' => Icons.subject,
    _ => Icons.insert_drive_file_outlined,
  };
}

String _formatArtifactBytes(int bytes) {
  if (bytes >= 1024 * 1024) {
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
  if (bytes >= 1024) {
    return '${(bytes / 1024).toStringAsFixed(1)} KB';
  }
  return '$bytes B';
}
