part of '../app_top_bar.dart';

class AppTopBarAction {
  const AppTopBarAction({
    required this.tooltip,
    required this.icon,
    required this.onPressed,
    this.busy = false,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool busy;
}

class _TopBarActionButton extends StatelessWidget {
  const _TopBarActionButton({required this.action});

  final AppTopBarAction action;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: action.tooltip,
      onPressed: action.busy ? null : action.onPressed,
      icon: action.busy
          ? const SizedBox.square(
              dimension: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Icon(action.icon),
    );
  }
}

class _MobileTerminalTitle extends StatelessWidget {
  const _MobileTerminalTitle({
    required this.workspaceName,
    required this.focusedTerminalTitle,
    required this.focusedTerminalWorkspaceName,
    required this.paneCount,
  });

  final String workspaceName;
  final String? focusedTerminalTitle;
  final String? focusedTerminalWorkspaceName;
  final int paneCount;

  @override
  Widget build(BuildContext context) {
    final title = focusedTerminalTitle?.trim();
    final paneLabel = paneCount == 1 ? '1 active' : '$paneCount active';
    final workspaceLabel =
        focusedTerminalWorkspaceName?.trim().isNotEmpty == true
        ? focusedTerminalWorkspaceName!.trim()
        : workspaceName;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title?.isNotEmpty == true ? title! : workspaceName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
        ),
        const SizedBox(height: 1),
        Text(
          '$workspaceLabel - $paneLabel',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: AppColors.mutedText(context),
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

enum _TopBarMenuAction {
  refresh,
  saveLayout,
  agentSettings,
  serverProcesses,
  workspaceChanges,
  theme,
  manageAccounts,
  switchProfile,
  logout,
}

class _TerminalMenuItem extends StatelessWidget {
  const _TerminalMenuItem({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18),
        const SizedBox(width: 10),
        Expanded(child: Text(label, overflow: TextOverflow.ellipsis)),
      ],
    );
  }
}

class _WorkspaceCrumb extends StatelessWidget {
  const _WorkspaceCrumb({required this.workspace});

  final Workspace? workspace;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 34,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: AppColors.field(context),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppColors.line(context)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            workspace == null ? Icons.folder_outlined : Icons.folder_open,
            size: 17,
            color: AppColors.secondaryText(context),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              workspace?.name ?? 'No workspace',
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchHint extends StatelessWidget {
  const _SearchHint({required this.compact});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (compact) {
      return const SizedBox.shrink();
    }

    return Container(
      width: 280,
      height: 34,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: AppColors.field(context),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppColors.line(context)),
      ),
      child: Row(
        children: [
          Icon(Icons.search, size: 17, color: AppColors.mutedText(context)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Search files, commands...',
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: AppColors.mutedText(context)),
            ),
          ),
          Text('⌘K', style: TextStyle(color: AppColors.mutedText(context))),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) {
    return Container(width: 1, height: 24, color: AppColors.line(context));
  }
}
