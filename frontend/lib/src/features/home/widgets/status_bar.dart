import 'package:act_frontend/src/app/app_colors.dart';
import 'package:act_frontend/src/models/health_status.dart';
import 'package:act_frontend/src/models/system_stats.dart';
import 'package:act_frontend/src/models/workspace.dart';
import 'package:flutter/material.dart';

class StatusBar extends StatelessWidget {
  const StatusBar({
    required this.health,
    required this.stats,
    required this.workspace,
    required this.isAuthenticated,
    super.key,
  });

  final HealthStatus? health;
  final SystemStats? stats;
  final Workspace? workspace;
  final bool isAuthenticated;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 640;

        return Container(
          height: 32,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: AppColors.chrome(context),
            border: Border(top: BorderSide(color: AppColors.line(context))),
          ),
          child: Row(
            children: [
              _StatusPill(
                label: isAuthenticated ? 'Connected' : 'Local only',
                color: isAuthenticated
                    ? AppColors.success(context)
                    : AppColors.warning(context),
              ),
              const SizedBox(width: 10),
              _StatusItem(
                icon: Icons.terminal,
                value: '${stats?.activeSessions ?? 0}',
              ),
              if (!compact) ...[
                _StatusItem(
                  icon: Icons.memory,
                  value: '${stats?.memoryPercentage.toStringAsFixed(0) ?? 0}%',
                ),
                _StatusItem(
                  icon: Icons.bolt,
                  value: '${stats?.cpuUsage.toStringAsFixed(0) ?? 0}%',
                ),
                _StatusItem(
                  icon: Icons.storage,
                  value: '${stats?.diskPercentage.toStringAsFixed(0) ?? 0}%',
                ),
              ],
              const Spacer(),
              if (workspace != null && !compact)
                Flexible(
                  child: Text(
                    workspace!.localPath,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.mutedText(context),
                      fontSize: 12,
                    ),
                  ),
                ),
              const SizedBox(width: 10),
              if (!compact)
                Text(
                  health?.version == null ? 'v-' : 'v${health!.version}',
                  style: TextStyle(
                    color: AppColors.mutedText(context),
                    fontSize: 12,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
}

class _StatusItem extends StatelessWidget {
  const _StatusItem({required this.icon, required this.value});

  final IconData icon;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 10),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.mutedText(context)),
          const SizedBox(width: 4),
          Text(value, style: const TextStyle(fontSize: 12)),
        ],
      ),
    );
  }
}
