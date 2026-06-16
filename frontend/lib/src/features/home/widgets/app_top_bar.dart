import 'package:act_frontend/src/app/app_colors.dart';
import 'package:act_frontend/src/models/coding_agent.dart';
import 'package:act_frontend/src/models/user_profile.dart';
import 'package:act_frontend/src/models/workspace.dart';
import 'package:flutter/material.dart';

part 'app_top_bar/actions.dart';

class AppTopBar extends StatelessWidget {
  const AppTopBar({
    required this.workspace,
    required this.user,
    required this.onRefresh,
    required this.onLogout,
    required this.onChooseTheme,
    this.defaultAgentProvider = 'codex',
    this.onChooseAgentSettings,
    this.onOpenServerProcesses,
    this.onOpenWorkspaceChanges,
    this.activeProfileLabel = 'Hosted ACT',
    this.onManageAccounts,
    this.onSwitchProfile,
    this.isTerminalMode = false,
    this.terminalPaneCount = 0,
    this.focusedTerminalTitle,
    this.focusedTerminalWorkspaceName,
    this.terminalFocusMode = false,
    this.terminalControlsExpanded = true,
    this.isCreatingTerminal = false,
    this.onToggleTerminalFocusMode,
    this.onToggleTerminalControls,
    this.onCreateTerminal,
    this.onSaveTerminalLayout,
    this.searchQuery = '',
    this.onSearchChanged,
    this.mobileTitle,
    this.mobileIcon,
    this.mobileActions = const [],
    super.key,
  });

  final Workspace? workspace;
  final UserProfile? user;
  final VoidCallback onRefresh;
  final VoidCallback onLogout;
  final VoidCallback onChooseTheme;
  final VoidCallback? onOpenServerProcesses;
  final VoidCallback? onOpenWorkspaceChanges;
  final VoidCallback? onChooseAgentSettings;
  final String defaultAgentProvider;
  final String activeProfileLabel;
  final VoidCallback? onManageAccounts;
  final VoidCallback? onSwitchProfile;
  final bool isTerminalMode;
  final int terminalPaneCount;
  final String? focusedTerminalTitle;
  final String? focusedTerminalWorkspaceName;
  final bool terminalFocusMode;
  final bool terminalControlsExpanded;
  final bool isCreatingTerminal;
  final VoidCallback? onToggleTerminalFocusMode;
  final VoidCallback? onToggleTerminalControls;
  final VoidCallback? onCreateTerminal;
  final VoidCallback? onSaveTerminalLayout;
  final String searchQuery;
  final ValueChanged<String>? onSearchChanged;
  final String? mobileTitle;
  final IconData? mobileIcon;
  final List<AppTopBarAction> mobileActions;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 56,
      decoration: BoxDecoration(
        color: AppColors.chrome(context),
        border: Border(bottom: BorderSide(color: AppColors.line(context))),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          final compact = width < 640;
          final routeTitle = mobileTitle?.trim();
          final compactRouteTitle = routeTitle == null || routeTitle.isEmpty
              ? 'ACT'
              : routeTitle;
          final defaultAgent = CodingAgents.byId(defaultAgentProvider);

          return Row(
            children: [
              Icon(
                compact && !isTerminalMode
                    ? mobileIcon ?? Icons.terminal
                    : defaultAgent.icon,
                color: AppColors.accent(context),
                size: 22,
              ),
              const SizedBox(width: 8),
              if (compact && isTerminalMode)
                Expanded(
                  child: _MobileTerminalTitle(
                    workspaceName: workspace?.name ?? 'Terminal',
                    focusedTerminalTitle: focusedTerminalTitle,
                    focusedTerminalWorkspaceName: focusedTerminalWorkspaceName,
                    paneCount: terminalPaneCount,
                  ),
                )
              else if (compact)
                Expanded(
                  child: Text(
                    compactRouteTitle,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 17,
                    ),
                  ),
                )
              else
                Text(
                  'ACT',
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 17,
                  ),
                ),
              if (!compact) ...[
                const SizedBox(width: 14),
                const _Divider(),
                const SizedBox(width: 14),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 180),
                  child: _WorkspaceCrumb(workspace: workspace),
                ),
                const SizedBox(width: 12),
                _TopSearchField(
                  compact: width < 860,
                  query: searchQuery,
                  onChanged: onSearchChanged,
                ),
              ],
              if (!compact) const Spacer(),
              if (compact && isTerminalMode) ...[
                IconButton(
                  tooltip: terminalFocusMode
                      ? 'Show all terminals'
                      : 'Immersive terminal',
                  onPressed: terminalPaneCount > 1
                      ? onToggleTerminalFocusMode
                      : null,
                  icon: Icon(
                    terminalFocusMode ? Icons.grid_view : Icons.open_in_full,
                  ),
                ),
                IconButton(
                  tooltip: terminalControlsExpanded
                      ? 'Hide terminal input'
                      : 'Show terminal input',
                  onPressed: onToggleTerminalControls,
                  icon: Icon(
                    terminalControlsExpanded
                        ? Icons.keyboard_hide
                        : Icons.keyboard,
                  ),
                ),
                IconButton.filled(
                  tooltip: isCreatingTerminal
                      ? 'Starting terminal'
                      : 'New pane',
                  onPressed: isCreatingTerminal ? null : onCreateTerminal,
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.accent(context),
                    foregroundColor: AppColors.onAccent(context),
                    disabledBackgroundColor: AppColors.line(context),
                    disabledForegroundColor: AppColors.mutedText(context),
                  ),
                  icon: isCreatingTerminal
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.add),
                ),
                PopupMenuButton<_TopBarMenuAction>(
                  tooltip: 'Terminal actions',
                  icon: const Icon(Icons.more_vert),
                  onSelected: (action) {
                    switch (action) {
                      case _TopBarMenuAction.refresh:
                        onRefresh();
                      case _TopBarMenuAction.saveLayout:
                        onSaveTerminalLayout?.call();
                      case _TopBarMenuAction.theme:
                        onChooseTheme();
                      case _TopBarMenuAction.agentSettings:
                        onChooseAgentSettings?.call();
                      case _TopBarMenuAction.serverProcesses:
                        onOpenServerProcesses?.call();
                      case _TopBarMenuAction.workspaceChanges:
                        onOpenWorkspaceChanges?.call();
                      case _TopBarMenuAction.manageAccounts:
                        onManageAccounts?.call();
                      case _TopBarMenuAction.switchProfile:
                        onSwitchProfile?.call();
                      case _TopBarMenuAction.logout:
                        onLogout();
                    }
                  },
                  itemBuilder: (context) => [
                    const PopupMenuItem(
                      value: _TopBarMenuAction.refresh,
                      child: _TerminalMenuItem(
                        icon: Icons.sync,
                        label: 'Refresh workspace',
                      ),
                    ),
                    PopupMenuItem(
                      value: _TopBarMenuAction.saveLayout,
                      enabled: onSaveTerminalLayout != null,
                      child: const _TerminalMenuItem(
                        icon: Icons.view_quilt_outlined,
                        label: 'Save pane layout',
                      ),
                    ),
                    PopupMenuItem(
                      value: _TopBarMenuAction.agentSettings,
                      enabled: onChooseAgentSettings != null,
                      child: const _TerminalMenuItem(
                        icon: Icons.smart_toy_outlined,
                        label: 'Agent settings',
                      ),
                    ),
                    PopupMenuItem(
                      value: _TopBarMenuAction.serverProcesses,
                      enabled: onOpenServerProcesses != null,
                      child: const _TerminalMenuItem(
                        icon: Icons.memory,
                        label: 'Server processes',
                      ),
                    ),
                    PopupMenuItem(
                      value: _TopBarMenuAction.workspaceChanges,
                      enabled: onOpenWorkspaceChanges != null,
                      child: const _TerminalMenuItem(
                        icon: Icons.difference_outlined,
                        label: 'Workspace changes',
                      ),
                    ),
                    const PopupMenuItem(
                      value: _TopBarMenuAction.theme,
                      child: _TerminalMenuItem(
                        icon: Icons.palette_outlined,
                        label: 'Theme',
                      ),
                    ),
                    PopupMenuItem(
                      value: _TopBarMenuAction.manageAccounts,
                      enabled: onManageAccounts != null,
                      child: const _TerminalMenuItem(
                        icon: Icons.link,
                        label: 'Connected accounts',
                      ),
                    ),
                    PopupMenuItem(
                      value: _TopBarMenuAction.switchProfile,
                      enabled: onSwitchProfile != null,
                      child: const _TerminalMenuItem(
                        icon: Icons.swap_horiz,
                        label: 'Switch ACT profile',
                      ),
                    ),
                    const PopupMenuDivider(),
                    const PopupMenuItem(
                      value: _TopBarMenuAction.logout,
                      child: _TerminalMenuItem(
                        icon: Icons.logout,
                        label: 'Sign out of ACT',
                      ),
                    ),
                  ],
                ),
              ] else ...[
                if (compact)
                  for (final action in mobileActions) ...[
                    const SizedBox(width: 2),
                    _TopBarActionButton(action: action),
                  ],
              ],
              if (!compact && !isTerminalMode) ...[
                const SizedBox(width: 4),
                CircleAvatar(
                  radius: 15,
                  backgroundColor: AppColors.accent(context),
                  child: Text(
                    _initial(user?.email),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
              if (compact && !isTerminalMode && onSwitchProfile != null) ...[
                const SizedBox(width: 2),
                IconButton(
                  tooltip: 'Switch ACT profile: $activeProfileLabel',
                  onPressed: onSwitchProfile,
                  icon: const Icon(Icons.swap_horiz),
                ),
              ],
              if (!(compact && isTerminalMode)) ...[
                const SizedBox(width: 4),
                PopupMenuButton<_TopBarMenuAction>(
                  tooltip: 'More actions',
                  icon: const Icon(Icons.more_vert),
                  onSelected: (action) {
                    switch (action) {
                      case _TopBarMenuAction.refresh:
                        onRefresh();
                      case _TopBarMenuAction.saveLayout:
                        onSaveTerminalLayout?.call();
                      case _TopBarMenuAction.theme:
                        onChooseTheme();
                      case _TopBarMenuAction.agentSettings:
                        onChooseAgentSettings?.call();
                      case _TopBarMenuAction.serverProcesses:
                        onOpenServerProcesses?.call();
                      case _TopBarMenuAction.workspaceChanges:
                        onOpenWorkspaceChanges?.call();
                      case _TopBarMenuAction.manageAccounts:
                        onManageAccounts?.call();
                      case _TopBarMenuAction.switchProfile:
                        onSwitchProfile?.call();
                      case _TopBarMenuAction.logout:
                        onLogout();
                    }
                  },
                  itemBuilder: (context) => [
                    PopupMenuItem(
                      value: _TopBarMenuAction.agentSettings,
                      enabled: onChooseAgentSettings != null,
                      child: const _TerminalMenuItem(
                        icon: Icons.smart_toy_outlined,
                        label: 'Agent settings',
                      ),
                    ),
                    PopupMenuItem(
                      value: _TopBarMenuAction.serverProcesses,
                      enabled: onOpenServerProcesses != null,
                      child: const _TerminalMenuItem(
                        icon: Icons.memory,
                        label: 'Server processes',
                      ),
                    ),
                    PopupMenuItem(
                      value: _TopBarMenuAction.workspaceChanges,
                      enabled: onOpenWorkspaceChanges != null,
                      child: const _TerminalMenuItem(
                        icon: Icons.difference_outlined,
                        label: 'Workspace changes',
                      ),
                    ),
                    const PopupMenuItem(
                      value: _TopBarMenuAction.theme,
                      child: _TerminalMenuItem(
                        icon: Icons.palette_outlined,
                        label: 'Theme',
                      ),
                    ),
                    const PopupMenuItem(
                      value: _TopBarMenuAction.refresh,
                      child: _TerminalMenuItem(
                        icon: Icons.sync,
                        label: 'Refresh workspace',
                      ),
                    ),
                    PopupMenuItem(
                      value: _TopBarMenuAction.manageAccounts,
                      enabled: onManageAccounts != null,
                      child: const _TerminalMenuItem(
                        icon: Icons.link,
                        label: 'Connected accounts',
                      ),
                    ),
                    PopupMenuItem(
                      value: _TopBarMenuAction.switchProfile,
                      enabled: onSwitchProfile != null,
                      child: const _TerminalMenuItem(
                        icon: Icons.swap_horiz,
                        label: 'Switch ACT profile',
                      ),
                    ),
                    const PopupMenuDivider(),
                    const PopupMenuItem(
                      value: _TopBarMenuAction.logout,
                      child: _TerminalMenuItem(
                        icon: Icons.logout,
                        label: 'Sign out of ACT',
                      ),
                    ),
                  ],
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  String _initial(String? email) {
    if (email == null || email.isEmpty) {
      return 'U';
    }
    return email[0].toUpperCase();
  }
}
