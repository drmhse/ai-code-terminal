import 'dart:async';

import 'package:act_frontend/src/app/app_colors.dart';
import 'package:act_frontend/src/models/codex_session.dart';
import 'package:act_frontend/src/models/coding_agent.dart';
import 'package:act_frontend/src/models/server_process.dart';
import 'package:act_frontend/src/models/terminal_session.dart';
import 'package:act_frontend/src/services/act_api.dart';
import 'package:flutter/material.dart';

class ServerProcessControlPage extends StatefulWidget {
  const ServerProcessControlPage({
    required this.api,
    required this.piReloadSessionIds,
    required this.onOpenAgentSession,
    required this.onReloadPiNextPrompt,
    super.key,
  });

  final ActApi api;
  final Set<String> piReloadSessionIds;
  final ValueChanged<String> onOpenAgentSession;
  final ValueChanged<String> onReloadPiNextPrompt;

  @override
  State<ServerProcessControlPage> createState() =>
      _ServerProcessControlPageState();
}

class _ServerProcessControlPageState extends State<ServerProcessControlPage> {
  List<CodexSessionSummary> _agentSessions = const [];
  List<TerminalSession> _terminalSessions = const [];
  List<ServerProcess> _processes = const [];
  bool _isLoading = true;
  String? _error;
  String? _busyActionId;
  bool _showHistory = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    final errors = <String>[];
    List<CodexSessionSummary> agentSessions = const [];
    List<TerminalSession> terminalSessions = const [];
    List<ServerProcess> processes = const [];
    try {
      agentSessions = await widget.api.codexSessions(limit: 80);
    } catch (error) {
      errors.add('Agent runtimes: $error');
    }
    try {
      terminalSessions = await widget.api.sessions();
    } catch (error) {
      errors.add('Terminal sessions: $error');
    }
    try {
      processes = await widget.api.serverProcesses();
    } catch (error) {
      errors.add('Managed processes: $error');
    }
    if (!mounted) {
      return;
    }
    setState(() {
      _agentSessions = agentSessions;
      _terminalSessions = terminalSessions;
      _processes = processes;
      _error = errors.isEmpty ? null : errors.join('\n');
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final activeAgentSessions = _agentSessions
        .where((session) => _runtimeNeedsControl(session))
        .toList(growable: false);
    final historicalPiSessions = _agentSessions
        .where(
          (session) =>
              session.agentProvider == CodingAgents.pi.id &&
              !_runtimeNeedsControl(session),
        )
        .toList(growable: false);
    final activeProcesses = _processes
        .where((process) => _processNeedsControl(process))
        .toList(growable: false);
    return Scaffold(
      backgroundColor: AppColors.page(context),
      appBar: AppBar(
        title: const Text('Backend Controls'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _isLoading ? null : _load,
            icon: _isLoading
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: 'Close',
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.close),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (_error != null) ...[
                _ProcessNotice(message: _error!),
                const SizedBox(height: 12),
              ],
              _ControlSummary(
                activeAgents: activeAgentSessions.length,
                terminalSessions: _terminalSessions.length,
                activeProcesses: activeProcesses.length,
              ),
              const SizedBox(height: 16),
              _SectionHeader(
                icon: Icons.smart_toy_outlined,
                title: 'Running agents',
                count: activeAgentSessions.length,
              ),
              const SizedBox(height: 8),
              if (activeAgentSessions.isEmpty)
                const _EmptyProcessList(label: 'No agents need attention')
              else
                for (final session in activeAgentSessions) ...[
                  _AgentRuntimeTile(
                    session: session,
                    reloadMarked: widget.piReloadSessionIds.contains(
                      session.id,
                    ),
                    busyActionId: _busyActionId,
                    onOpen: () {
                      widget.onOpenAgentSession(session.id);
                      Navigator.pop(context);
                    },
                    onInterrupt: session.isBusy
                        ? () => _interruptAgent(session)
                        : null,
                    onReloadPiNextPrompt:
                        session.agentProvider == CodingAgents.pi.id
                        ? () {
                            widget.onReloadPiNextPrompt(session.id);
                            setState(() {});
                          }
                        : null,
                  ),
                  const SizedBox(height: 10),
                ],
              if (historicalPiSessions.isNotEmpty) ...[
                const SizedBox(height: 2),
                TextButton.icon(
                  onPressed: () => setState(() => _showHistory = !_showHistory),
                  icon: Icon(
                    _showHistory ? Icons.expand_less : Icons.history,
                    size: 18,
                  ),
                  label: Text(
                    _showHistory
                        ? 'Hide completed Pi conversations'
                        : 'Show completed Pi conversations',
                  ),
                ),
                if (_showHistory) ...[
                  const SizedBox(height: 8),
                  for (final session in historicalPiSessions.take(8)) ...[
                    _AgentRuntimeTile(
                      session: session,
                      compact: true,
                      reloadMarked: widget.piReloadSessionIds.contains(
                        session.id,
                      ),
                      busyActionId: _busyActionId,
                      onOpen: () {
                        widget.onOpenAgentSession(session.id);
                        Navigator.pop(context);
                      },
                      onInterrupt: null,
                      onReloadPiNextPrompt: () {
                        widget.onReloadPiNextPrompt(session.id);
                        setState(() {});
                      },
                    ),
                    const SizedBox(height: 10),
                  ],
                ],
              ],
              const SizedBox(height: 8),
              _SectionHeader(
                icon: Icons.terminal,
                title: 'Terminal sessions',
                count: _terminalSessions.length,
              ),
              const SizedBox(height: 8),
              if (_terminalSessions.isEmpty)
                const _EmptyProcessList(label: 'No terminal sessions')
              else
                for (final session in _terminalSessions) ...[
                  _TerminalRuntimeTile(
                    session: session,
                    busyActionId: _busyActionId,
                    onTerminate: () => _terminateTerminal(session),
                  ),
                  const SizedBox(height: 10),
                ],
              const SizedBox(height: 8),
              _SectionHeader(
                icon: Icons.memory,
                title: 'Managed processes',
                count: activeProcesses.length,
              ),
              const SizedBox(height: 8),
              if (activeProcesses.isEmpty)
                const _EmptyProcessList(label: 'No managed processes running')
              else
                for (final process in activeProcesses) ...[
                  _ManagedProcessTile(
                    process: process,
                    busyActionId: _busyActionId,
                    onStop: () => _stopProcess(process),
                    onRestart: () => _restartProcess(process),
                  ),
                  const SizedBox(height: 10),
                ],
            ],
          ),
        ),
      ),
    );
  }

  bool _runtimeNeedsControl(CodexSessionSummary session) {
    final status = session.status.toLowerCase();
    return session.isBusy ||
        status.contains('running') ||
        status.contains('starting') ||
        status.contains('queued') ||
        status.contains('interrupting') ||
        status.contains('failed');
  }

  bool _processNeedsControl(ServerProcess process) {
    final status = process.status.toLowerCase();
    return status.contains('running') ||
        status.contains('starting') ||
        status.contains('restart') ||
        status.contains('failed') ||
        status.contains('crashed');
  }

  Future<void> _interruptAgent(CodexSessionSummary session) async {
    await _runAction('agent:${session.id}', () async {
      await widget.api.interruptCodexSession(session.id);
      await _load();
    });
  }

  Future<void> _terminateTerminal(TerminalSession session) async {
    await _runAction('terminal:${session.id}', () async {
      await widget.api.terminateSession(session.id);
      await _load();
    });
  }

  Future<void> _stopProcess(ServerProcess process) async {
    await _runAction('process-stop:${process.id}', () async {
      await widget.api.stopServerProcess(process.id);
      await _load();
    });
  }

  Future<void> _restartProcess(ServerProcess process) async {
    await _runAction('process-restart:${process.id}', () async {
      await widget.api.restartServerProcess(process.id);
      await _load();
    });
  }

  Future<void> _runAction(String actionId, Future<void> Function() run) async {
    setState(() {
      _busyActionId = actionId;
      _error = null;
    });
    try {
      await run();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = error.toString());
    } finally {
      if (mounted) {
        setState(() => _busyActionId = null);
      }
    }
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.icon,
    required this.title,
    required this.count,
  });

  final IconData icon;
  final String title;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.accent(context)),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            title.toUpperCase(),
            style: TextStyle(
              color: AppColors.mutedText(context),
              fontSize: 12,
              fontWeight: FontWeight.w900,
              letterSpacing: 0,
            ),
          ),
        ),
        Text(
          count.toString(),
          style: TextStyle(
            color: AppColors.mutedText(context),
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }
}

class _ControlSummary extends StatelessWidget {
  const _ControlSummary({
    required this.activeAgents,
    required this.terminalSessions,
    required this.activeProcesses,
  });

  final int activeAgents;
  final int terminalSessions;
  final int activeProcesses;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.panel(context),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.line(context)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: _SummaryMetric(
                label: 'Agents',
                value: activeAgents,
                icon: Icons.smart_toy_outlined,
              ),
            ),
            Expanded(
              child: _SummaryMetric(
                label: 'Terminals',
                value: terminalSessions,
                icon: Icons.terminal,
              ),
            ),
            Expanded(
              child: _SummaryMetric(
                label: 'Processes',
                value: activeProcesses,
                icon: Icons.memory,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryMetric extends StatelessWidget {
  const _SummaryMetric({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final int value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: AppColors.accent(context), size: 20),
        const SizedBox(height: 6),
        Text(
          value.toString(),
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: AppColors.mutedText(context),
            fontSize: 11,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }
}

class _AgentRuntimeTile extends StatelessWidget {
  const _AgentRuntimeTile({
    required this.session,
    required this.reloadMarked,
    required this.busyActionId,
    required this.onOpen,
    required this.onInterrupt,
    required this.onReloadPiNextPrompt,
    this.compact = false,
  });

  final CodexSessionSummary session;
  final bool reloadMarked;
  final String? busyActionId;
  final VoidCallback onOpen;
  final VoidCallback? onInterrupt;
  final VoidCallback? onReloadPiNextPrompt;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final agent = CodingAgents.byId(session.agentProvider);
    final busy = busyActionId == 'agent:${session.id}';
    return _ProcessCard(
      icon: agent.icon,
      title: session.title,
      subtitle: [
        agent.label,
        session.status,
        if (session.cwd?.trim().isNotEmpty == true) session.cwd!,
      ].join(' - '),
      status: session.status,
      compact: compact,
      actions: [
        IconButton(
          tooltip: 'Open conversation',
          onPressed: onOpen,
          icon: const Icon(Icons.open_in_new),
        ),
        if (onReloadPiNextPrompt != null)
          IconButton.filled(
            tooltip: reloadMarked
                ? 'Pi will reload on the next prompt'
                : 'Reload Pi tools on next prompt',
            onPressed: onReloadPiNextPrompt,
            icon: Icon(reloadMarked ? Icons.check : Icons.restart_alt),
          ),
        if (session.isBusy || onInterrupt != null)
          IconButton(
            tooltip: session.isBusy ? 'Interrupt agent' : 'Agent is idle',
            onPressed: busy ? null : onInterrupt,
            icon: busy
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.stop_circle_outlined),
          ),
      ],
    );
  }
}

class _TerminalRuntimeTile extends StatelessWidget {
  const _TerminalRuntimeTile({
    required this.session,
    required this.busyActionId,
    required this.onTerminate,
  });

  final TerminalSession session;
  final String? busyActionId;
  final VoidCallback onTerminate;

  @override
  Widget build(BuildContext context) {
    final busy = busyActionId == 'terminal:${session.id}';
    return _ProcessCard(
      icon: Icons.terminal,
      title: session.sessionName,
      subtitle: [
        session.status,
        if (session.workspaceId?.trim().isNotEmpty == true)
          'workspace ${session.workspaceId}',
      ].join(' - '),
      status: session.status,
      compact: true,
      actions: [
        IconButton(
          tooltip: 'Terminate terminal',
          onPressed: busy ? null : onTerminate,
          icon: busy
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.delete_outline),
        ),
      ],
    );
  }
}

class _ManagedProcessTile extends StatelessWidget {
  const _ManagedProcessTile({
    required this.process,
    required this.busyActionId,
    required this.onStop,
    required this.onRestart,
  });

  final ServerProcess process;
  final String? busyActionId;
  final VoidCallback onStop;
  final VoidCallback onRestart;

  @override
  Widget build(BuildContext context) {
    final stopping = busyActionId == 'process-stop:${process.id}';
    final restarting = busyActionId == 'process-restart:${process.id}';
    return _ProcessCard(
      icon: Icons.memory,
      title: process.name,
      subtitle: [
        process.command,
        if (process.pid != null) 'pid ${process.pid}',
        process.workingDirectory,
      ].join(' - '),
      status: process.status,
      compact: true,
      actions: [
        IconButton(
          tooltip: 'Restart process',
          onPressed: stopping || restarting ? null : onRestart,
          icon: restarting
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.restart_alt),
        ),
        IconButton(
          tooltip: 'Stop process',
          onPressed: stopping || restarting ? null : onStop,
          icon: stopping
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.stop_circle_outlined),
        ),
      ],
    );
  }
}

class _ProcessCard extends StatelessWidget {
  const _ProcessCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.status,
    required this.actions,
    this.compact = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String status;
  final List<Widget> actions;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.panel(context),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.line(context)),
      ),
      child: Padding(
        padding: EdgeInsets.all(compact ? 10 : 12),
        child: Row(
          children: [
            Icon(
              icon,
              color: AppColors.accent(context),
              size: compact ? 20 : 24,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (!compact) ...[
                        _StatusPill(status: status),
                        const SizedBox(width: 8),
                      ],
                      Expanded(
                        child: Text(
                          title.trim().isEmpty ? 'Untitled' : title.trim(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: compact ? 14 : 15,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: AppColors.secondaryText(context)),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Wrap(
              spacing: 2,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: actions,
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final normalized = status.toLowerCase();
    final color =
        normalized.contains('running') || normalized.contains('active')
        ? AppColors.accent(context)
        : normalized.contains('failed') || normalized.contains('error')
        ? AppColors.error(context)
        : AppColors.mutedText(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        status,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _ProcessNotice extends StatelessWidget {
  const _ProcessNotice({required this.message});

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

class _EmptyProcessList extends StatelessWidget {
  const _EmptyProcessList({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.panel(context),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.line(context)),
      ),
      child: Text(label, style: TextStyle(color: AppColors.mutedText(context))),
    );
  }
}
