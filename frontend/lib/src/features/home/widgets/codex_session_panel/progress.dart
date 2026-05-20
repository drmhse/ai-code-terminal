part of '../codex_session_panel.dart';

class _AgentProgressTile extends StatefulWidget {
  const _AgentProgressTile({required this.events});

  final List<CodexSessionEvent> events;

  @override
  State<_AgentProgressTile> createState() => _AgentProgressTileState();
}

class _AgentProgressTileState extends State<_AgentProgressTile>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final label = _agentProgressLabel(widget.events);
    return Align(
      alignment: Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: AppColors.field(context),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: AppColors.accent(context).withValues(alpha: 0.34),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedBuilder(
                  animation: _controller,
                  builder: (context, _) => SizedBox(
                    width: 46,
                    height: 22,
                    child: _ProgressSignal(progress: _controller.value),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  label,
                  style: TextStyle(
                    color: AppColors.secondaryText(context),
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(width: 8),
                AnimatedBuilder(
                  animation: _controller,
                  builder: (context, _) =>
                      _ProgressStepRail(progress: _controller.value),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

String _agentProgressLabel(List<CodexSessionEvent> events) {
  const agent = 'Agent';
  for (final event in events.reversed) {
    final status = event.status?.toLowerCase() ?? '';
    final title = event.title?.toLowerCase() ?? '';
    final kind = event.kind.toLowerCase();
    final role = event.role?.toLowerCase() ?? '';
    if ((kind.startsWith('tool') || title.contains('tool')) &&
        (status.isEmpty ||
            status.contains('running') ||
            status.contains('in_progress'))) {
      return '$agent is using tools';
    }
    if (kind == 'message' &&
        role == 'assistant' &&
        (status.contains('streaming') || status.contains('running'))) {
      return '$agent is responding';
    }
    if (kind == 'reasoning' ||
        title.contains('thinking') ||
        title.contains('reasoning')) {
      return '$agent is thinking';
    }
    if (status.contains('starting') ||
        title.contains('agent start') ||
        title.contains('turn start') ||
        title.contains('message start') ||
        title.contains('rpc started')) {
      return '$agent is thinking';
    }
  }
  return '$agent is thinking';
}

class _ProgressSignal extends StatelessWidget {
  const _ProgressSignal({required this.progress});

  final double progress;

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        for (var i = 0; i < 3; i++)
          _ProgressPulseDot(phase: (progress + i / 3) % 1, left: 4.0 + i * 13),
      ],
    );
  }
}

class _ProgressPulseDot extends StatelessWidget {
  const _ProgressPulseDot({required this.phase, required this.left});

  final double phase;
  final double left;

  @override
  Widget build(BuildContext context) {
    final lift = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
    final size = 6.0 + lift * 5.0;
    return Positioned(
      left: left,
      top: 10 - lift * 7,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.accent(context).withValues(alpha: 0.42 + lift * 0.5),
          shape: BoxShape.circle,
        ),
        child: SizedBox(width: size, height: size),
      ),
    );
  }
}

class _ProgressStepRail extends StatelessWidget {
  const _ProgressStepRail({required this.progress});

  final double progress;

  @override
  Widget build(BuildContext context) {
    final active = (progress * 4).floor() % 4;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < 4; i++) ...[
          if (i > 0) const SizedBox(width: 3),
          DecoratedBox(
            decoration: BoxDecoration(
              color: i == active
                  ? AppColors.accent(context)
                  : AppColors.accent(context).withValues(alpha: 0.24),
              borderRadius: BorderRadius.circular(2),
            ),
            child: const SizedBox(width: 10, height: 3),
          ),
        ],
      ],
    );
  }
}
