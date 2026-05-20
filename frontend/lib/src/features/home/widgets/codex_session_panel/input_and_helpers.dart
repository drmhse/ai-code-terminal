part of '../codex_session_panel.dart';

class _CodexPendingQueue extends StatelessWidget {
  const _CodexPendingQueue({required this.messages});

  final List<String> messages;

  @override
  Widget build(BuildContext context) {
    final count = messages.length;
    final label = count == 1 ? 'Queued for Agent' : '$count queued for Agent';
    final visibleMessages = messages.length > 3
        ? messages.sublist(messages.length - 3)
        : messages;
    return Container(
      key: const ValueKey('codex-pending-queue'),
      color: AppColors.chrome(context),
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 0),
      child: Align(
        alignment: Alignment.centerRight,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: AppColors.accent(context).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: AppColors.accent(context).withValues(alpha: 0.34),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.18),
                  blurRadius: 16,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 9),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.schedule_send_outlined,
                        size: 15,
                        color: AppColors.accent(context),
                      ),
                      const SizedBox(width: 7),
                      Expanded(
                        child: Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: AppColors.secondaryText(context),
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  for (final (index, message) in visibleMessages.indexed) ...[
                    if (index > 0) const SizedBox(height: 5),
                    Text(
                      message.trimRight(),
                      key: ValueKey('codex-pending-message-$index'),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.primaryText(context),
                        fontSize: 12,
                        height: 1.28,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CodexInputBar extends StatelessWidget {
  const _CodexInputBar({
    required this.session,
    required this.defaultAgentProvider,
    required this.controller,
    required this.focusNode,
    required this.events,
    required this.enabled,
    required this.canSendMessage,
    required this.canLaunch,
    required this.isBusy,
    required this.isSending,
    required this.canInterruptAndSend,
    required this.reloadPiNextPrompt,
    required this.onSend,
    required this.onInterruptAndSend,
    required this.onInterrupt,
    required this.onTapOutside,
  });

  final CodexSessionSummary? session;
  final String defaultAgentProvider;
  final TextEditingController controller;
  final FocusNode focusNode;
  final List<CodexSessionEvent> events;
  final bool enabled;
  final bool canSendMessage;
  final bool canLaunch;
  final bool isBusy;
  final bool isSending;
  final bool canInterruptAndSend;
  final bool reloadPiNextPrompt;
  final Future<void> Function() onSend;
  final Future<void> Function() onInterruptAndSend;
  final VoidCallback onInterrupt;
  final VoidCallback onTapOutside;

  @override
  Widget build(BuildContext context) {
    final agent = CodingAgents.byId(
      session?.agentProvider ?? defaultAgentProvider,
    );
    final usage = _latestSessionUsage(session, events);
    return SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (usage != null) _CodexUsageStrip(usage: usage),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.chrome(context),
              border: usage == null
                  ? Border(top: BorderSide(color: AppColors.line(context)))
                  : null,
            ),
            child: Row(
              children: [
                Tooltip(
                  message: 'Agent: ${agent.label}',
                  child: Icon(
                    agent.icon,
                    color: AppColors.accent(context),
                    size: 19,
                  ),
                ),
                const SizedBox(width: 6),
                IconButton(
                  tooltip: canInterruptAndSend
                      ? 'Interrupt and send'
                      : 'Interrupt',
                  onPressed: canInterruptAndSend
                      ? onInterruptAndSend
                      : isBusy
                      ? onInterrupt
                      : null,
                  icon: Icon(
                    canInterruptAndSend
                        ? Icons.published_with_changes
                        : Icons.cancel_outlined,
                    size: 18,
                  ),
                ),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (reloadPiNextPrompt) ...[
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Row(
                            children: [
                              Icon(
                                Icons.restart_alt,
                                size: 15,
                                color: AppColors.accent(context),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  'Pi will reload tools before the next prompt',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: AppColors.accent(context),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      TextField(
                        controller: controller,
                        focusNode: focusNode,
                        enabled: enabled && !isSending,
                        minLines: 1,
                        maxLines: 4,
                        keyboardType: TextInputType.multiline,
                        textInputAction: TextInputAction.newline,
                        onTapOutside: (_) => onTapOutside(),
                        decoration: InputDecoration(
                          hintText: canSendMessage
                              ? isBusy
                                    ? 'Queue a follow-up'
                                    : 'Ask ${agent.shortLabel} a follow-up'
                              : canLaunch
                              ? 'Start ${agent.shortLabel} with a prompt'
                              : isBusy
                              ? '${agent.shortLabel} is working'
                              : 'Select a workspace',
                          isDense: true,
                          filled: true,
                          fillColor: AppColors.field(context),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(
                              color: AppColors.line(context),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: canSendMessage
                      ? isBusy
                            ? 'Queue follow-up'
                            : 'Send to ${agent.shortLabel}'
                      : 'Start ${agent.shortLabel}',
                  onPressed: enabled && !isSending ? onSend : null,
                  icon: isSending
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(
                          canSendMessage
                              ? Icons.send
                              : Icons.rocket_launch_outlined,
                          size: 18,
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CodexUsageStrip extends StatelessWidget {
  const _CodexUsageStrip({required this.usage});

  final CodexSessionUsage usage;

  @override
  Widget build(BuildContext context) {
    final detail = _usageDetail(usage);
    return Tooltip(
      message: detail,
      child: Container(
        width: double.infinity,
        height: 28,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: AppColors.field(context),
          border: Border(
            top: BorderSide(color: AppColors.line(context)),
            bottom: BorderSide(color: AppColors.line(context)),
          ),
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final label = _usageStripLabel(usage, constraints.maxWidth);
            return Row(
              children: [
                Icon(
                  Icons.analytics_outlined,
                  size: 14,
                  color: AppColors.accent(context),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        label,
                        maxLines: 1,
                        style: TextStyle(
                          color: AppColors.secondaryText(context),
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          height: 1,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

String _usageStripLabel(CodexSessionUsage usage, double width) {
  final total = _formatTokenCount(usage.total.totalTokens);
  final last = usage.last?.totalTokens;
  final rate = usage.primaryRateLimitUsedPercent;
  final parts = <String>[
    if (last != null) '${_formatTokenCount(last)} turn',
    '$total session',
  ];
  if (width >= 360 && usage.total.cachedInputTokens > 0) {
    parts.add('${_formatTokenCount(usage.total.cachedInputTokens)} cached');
  }
  if (width >= 460) {
    parts.add('${_formatTokenCount(usage.total.outputTokens)} out');
  }
  if (width >= 520) {
    parts.add('${_formatTokenCount(usage.total.inputTokens)} in');
  }
  if (width >= 600 && usage.total.reasoningOutputTokens > 0) {
    parts.add('${_formatTokenCount(usage.total.reasoningOutputTokens)} reason');
  }
  if (rate != null) {
    parts.add('${rate.toStringAsFixed(0)}% limit');
  }
  final cost = usage.costUsd;
  if (width >= 680 && cost != null) {
    parts.add('\$${cost.toStringAsFixed(4)}');
  }
  return parts.join('  |  ');
}

String _usageDetail(CodexSessionUsage usage) {
  final last = usage.last?.totalTokens;
  final contextWindow = usage.modelContextWindow;
  final cost = usage.costUsd;
  final rateLimit = usage.primaryRateLimitUsedPercent;
  return [
    if (last != null) 'Current turn ${_formatTokenCount(last)} tokens',
    'Session total ${_formatTokenCount(usage.total.totalTokens)} tokens',
    'Input ${_formatTokenCount(usage.total.inputTokens)}',
    if (usage.total.cachedInputTokens > 0)
      'Cached ${_formatTokenCount(usage.total.cachedInputTokens)}',
    'Output ${_formatTokenCount(usage.total.outputTokens)}',
    if (usage.total.reasoningOutputTokens > 0)
      'Reasoning ${_formatTokenCount(usage.total.reasoningOutputTokens)}',
    if (contextWindow != null) 'Context ${_formatTokenCount(contextWindow)}',
    if (cost != null) 'Cost \$${cost.toStringAsFixed(4)}',
    if (rateLimit != null) 'Rate limit ${rateLimit.toStringAsFixed(0)}%',
  ].join('\n');
}

CodexSessionUsage? _latestSessionUsage(
  CodexSessionSummary? session,
  List<CodexSessionEvent> events,
) {
  for (final event in events.reversed) {
    final usage = event.usage;
    if (usage != null) {
      return usage;
    }
  }
  return session?.usage;
}

String _formatTokenCount(int value) {
  if (value >= 1000000) {
    return '${(value / 1000000).toStringAsFixed(value >= 10000000 ? 0 : 1)}M';
  }
  if (value >= 1000) {
    return '${(value / 1000).toStringAsFixed(value >= 10000 ? 0 : 1)}k';
  }
  return value.toString();
}

class _CodexNotice extends StatelessWidget {
  const _CodexNotice({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.warning(context).withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: AppColors.warning(context).withValues(alpha: 0.35),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Text(
          message,
          style: TextStyle(color: AppColors.secondaryText(context)),
        ),
      ),
    );
  }
}

class _CodexEmpty extends StatelessWidget {
  const _CodexEmpty({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(label, style: TextStyle(color: AppColors.mutedText(context))),
    );
  }
}

IconData _eventIcon(CodexSessionEvent event) {
  return switch (event.kind) {
    'message' when event.role == 'user' => Icons.person_outline,
    'message' => Icons.smart_toy_outlined,
    'tool_call' => Icons.build_outlined,
    'tool_output' || 'tool_status' => Icons.terminal,
    'reasoning' => Icons.psychology_outlined,
    'progress' => Icons.notes_outlined,
    'diagnostic' || 'error' => Icons.warning_amber_outlined,
    _ => Icons.circle_outlined,
  };
}
