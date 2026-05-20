part of '../act_home_page.dart';

String _agentLabel(String provider) => CodingAgents.byId(provider).label;

String? _codexExtensionUiRequestId(CodexSessionEvent event) {
  final command = event.command;
  if (command == null || !command.startsWith('extension_ui:')) {
    return null;
  }
  final parts = command.split(':');
  return parts.length >= 3 && parts[2].isNotEmpty ? parts[2] : null;
}
