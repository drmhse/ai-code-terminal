class ServerProcess {
  const ServerProcess({
    required this.id,
    required this.name,
    required this.command,
    required this.workingDirectory,
    required this.status,
    this.pid,
    this.args,
    this.workspaceId,
    this.sessionId,
    this.updatedAt,
  });

  factory ServerProcess.fromJson(Map<String, dynamic> json) {
    return ServerProcess(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Process',
      command: json['command']?.toString() ?? '',
      workingDirectory: json['working_directory']?.toString() ?? '',
      status: json['status']?.toString() ?? 'unknown',
      pid: json['pid'] is num ? (json['pid'] as num).toInt() : null,
      args: (json['args'] as List?)?.map((value) => value.toString()).toList(),
      workspaceId: json['workspace_id']?.toString(),
      sessionId: json['session_id']?.toString(),
      updatedAt: DateTime.tryParse(json['updated_at']?.toString() ?? ''),
    );
  }

  final String id;
  final String name;
  final int? pid;
  final String command;
  final List<String>? args;
  final String workingDirectory;
  final String status;
  final String? workspaceId;
  final String? sessionId;
  final DateTime? updatedAt;
}
