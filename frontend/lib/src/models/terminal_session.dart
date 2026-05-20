class TerminalSession {
  const TerminalSession({
    required this.id,
    required this.sessionName,
    required this.status,
    this.workspaceId,
  });

  factory TerminalSession.fromJson(Map<String, dynamic> json) {
    return TerminalSession(
      id: json['id']?.toString() ?? '',
      sessionName: json['session_name']?.toString() ?? 'Terminal',
      status: json['status']?.toString() ?? 'unknown',
      workspaceId: json['workspace_id']?.toString(),
    );
  }

  final String id;
  final String sessionName;
  final String status;
  final String? workspaceId;
}
