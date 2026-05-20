import 'package:act_frontend/src/app/app_colors.dart';
import 'package:act_frontend/src/models/coding_agent.dart';
import 'package:flutter/material.dart';

class MobileActionDock extends StatelessWidget {
  const MobileActionDock({
    required this.selectedIndex,
    required this.onSelected,
    this.defaultAgentProvider = 'codex',
    super.key,
  });

  final int selectedIndex;
  final String defaultAgentProvider;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.chrome(context),
        border: Border(top: BorderSide(color: AppColors.line(context))),
      ),
      child: NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: onSelected,
        backgroundColor: Colors.transparent,
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.folder_open),
            label: 'Files',
          ),
          const NavigationDestination(
            icon: Icon(Icons.terminal),
            label: 'Terminal',
          ),
          const NavigationDestination(
            icon: Icon(Icons.task_alt),
            label: 'Tasks',
          ),
          NavigationDestination(
            icon: Icon(CodingAgents.byId(defaultAgentProvider).icon),
            label: 'Agent',
          ),
        ],
      ),
    );
  }
}
