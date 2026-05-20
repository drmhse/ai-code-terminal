import 'package:act_frontend/src/core/json_readers.dart';

class SystemStats {
  const SystemStats({
    required this.cpuUsage,
    required this.memoryUsage,
    required this.memoryTotal,
    required this.memoryPercentage,
    required this.diskUsage,
    required this.diskTotal,
    required this.diskPercentage,
    required this.activeSessions,
    required this.activeProcesses,
    required this.uptimeSeconds,
    required this.systemHealth,
  });

  factory SystemStats.fromJson(Map<String, dynamic> json) {
    return SystemStats(
      cpuUsage: readDouble(json['cpu_usage']),
      memoryUsage: readInt(json['memory_usage']),
      memoryTotal: readInt(json['memory_total']),
      memoryPercentage: readDouble(json['memory_percentage']),
      diskUsage: readInt(json['disk_usage']),
      diskTotal: readInt(json['disk_total']),
      diskPercentage: readDouble(json['disk_percentage']),
      activeSessions: readInt(json['active_sessions']),
      activeProcesses: readInt(json['active_processes']),
      uptimeSeconds: readInt(json['uptime_seconds']),
      systemHealth: json['system_health']?.toString() ?? 'Unknown',
    );
  }

  final double cpuUsage;
  final int memoryUsage;
  final int memoryTotal;
  final double memoryPercentage;
  final int diskUsage;
  final int diskTotal;
  final double diskPercentage;
  final int activeSessions;
  final int activeProcesses;
  final int uptimeSeconds;
  final String systemHealth;
}
