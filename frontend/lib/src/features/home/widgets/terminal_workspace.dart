import 'dart:async';

import 'package:act_frontend/src/app/app_colors.dart';
import 'package:act_frontend/src/models/terminal_session.dart';
import 'package:act_frontend/src/models/workspace.dart';
import 'package:act_frontend/src/services/terminal_socket_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:xterm/xterm.dart';

part 'terminal_workspace/multiplexer.dart';
part 'terminal_workspace/terminal_pane.dart';
part 'terminal_workspace/mobile_controls.dart';
part 'terminal_workspace/command_composer.dart';

class TerminalWorkspace extends StatelessWidget {
  const TerminalWorkspace({
    required this.workspace,
    this.workspaces = const [],
    required this.sessions,
    required this.buffers,
    required this.onCreateSession,
    required this.onTerminateSession,
    required this.onSessionUnavailable,
    required this.onSaveLayout,
    required this.controlsExpanded,
    required this.onControlsExpandedChanged,
    this.focusMode = false,
    this.isCreatingSession = false,
    this.socketClient,
    this.onActiveSessionChanged,
    this.focusedSessionId,
    super.key,
  });

  final Workspace? workspace;
  final List<Workspace> workspaces;
  final List<TerminalSession> sessions;
  final Map<String, String> buffers;
  final VoidCallback onCreateSession;
  final ValueChanged<TerminalSession> onTerminateSession;
  final ValueChanged<TerminalSession> onSessionUnavailable;
  final VoidCallback onSaveLayout;
  final bool controlsExpanded;
  final ValueChanged<bool> onControlsExpandedChanged;
  final bool focusMode;
  final bool isCreatingSession;
  final TerminalSocketClient? socketClient;
  final ValueChanged<TerminalSession?>? onActiveSessionChanged;
  final String? focusedSessionId;

  @override
  Widget build(BuildContext context) {
    final mobile = MediaQuery.sizeOf(context).width < 760;
    final workspaceById = {for (final item in workspaces) item.id: item};
    final workspaceSessions = workspace == null
        ? const <TerminalSession>[]
        : sessions
              .where((session) => session.workspaceId == workspace!.id)
              .toList(growable: false);
    final visibleSessions = mobile ? sessions : workspaceSessions;

    return Container(
      color: AppColors.field(context),
      child: Column(
        children: [
          if (!mobile)
            _TerminalHeader(
              workspace: workspace,
              sessions: workspaceSessions,
              onCreateSession: onCreateSession,
              onSaveLayout: onSaveLayout,
              isCreatingSession: isCreatingSession,
            ),
          Expanded(
            child: visibleSessions.isEmpty
                ? _TerminalPrompt(
                    onCreateSession: onCreateSession,
                    canCreate: workspace != null,
                    isCreatingSession: isCreatingSession,
                  )
                : _TerminalMultiplexer(
                    selectedWorkspace: workspace,
                    workspaceById: workspaceById,
                    sessions: visibleSessions,
                    buffers: buffers,
                    socketClient: socketClient,
                    onCreateSession: onCreateSession,
                    onTerminateSession: onTerminateSession,
                    onSessionUnavailable: onSessionUnavailable,
                    controlsExpanded: controlsExpanded,
                    onControlsExpandedChanged: onControlsExpandedChanged,
                    focusMode: focusMode,
                    onActiveSessionChanged: onActiveSessionChanged,
                    focusedSessionId: focusedSessionId,
                  ),
          ),
        ],
      ),
    );
  }
}

class _TerminalHeader extends StatelessWidget {
  const _TerminalHeader({
    required this.workspace,
    required this.sessions,
    required this.onCreateSession,
    required this.onSaveLayout,
    required this.isCreatingSession,
  });

  final Workspace? workspace;
  final List<TerminalSession> sessions;
  final VoidCallback onCreateSession;
  final VoidCallback onSaveLayout;
  final bool isCreatingSession;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 360;
        return Container(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: AppColors.chrome(context),
            border: Border(bottom: BorderSide(color: AppColors.line(context))),
          ),
          child: Row(
            children: [
              Icon(Icons.terminal, size: 18, color: AppColors.accent(context)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  workspace == null ? 'Terminal' : workspace!.name,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              if (!compact)
                Text(
                  '${sessions.length} panes',
                  style: TextStyle(
                    color: AppColors.mutedText(context),
                    fontSize: 12,
                  ),
                ),
              const SizedBox(width: 8),
              IconButton.filled(
                tooltip: isCreatingSession
                    ? 'Starting terminal'
                    : 'New terminal',
                onPressed: workspace == null || isCreatingSession
                    ? null
                    : onCreateSession,
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.accent(context),
                  foregroundColor: AppColors.onAccent(context),
                  disabledBackgroundColor: AppColors.line(context),
                  disabledForegroundColor: AppColors.mutedText(context),
                ),
                icon: isCreatingSession
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.add, size: 16),
              ),
              IconButton(
                tooltip: 'Save layout',
                onPressed: sessions.isEmpty ? null : onSaveLayout,
                icon: const Icon(Icons.save_outlined, size: 16),
              ),
            ],
          ),
        );
      },
    );
  }
}
