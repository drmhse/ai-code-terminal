part of '../act_home_page.dart';

class _CreateTaskDraft {
  const _CreateTaskDraft({
    required this.title,
    required this.description,
    required this.workspaceIds,
    required this.collectionIds,
    required this.finalReportInstructions,
    required this.executionMode,
    required this.approvalMode,
    required this.evidencePreference,
    required this.agentProvider,
    required this.providerModel,
    required this.providerThinkingLevel,
    required this.attachments,
  });

  final String title;
  final String description;
  final List<String> workspaceIds;
  final List<String> collectionIds;
  final String finalReportInstructions;
  final String executionMode;
  final String approvalMode;
  final String evidencePreference;
  final String agentProvider;
  final String providerModel;
  final String providerThinkingLevel;
  final List<_TaskAttachmentDraft> attachments;
}

class _TaskAttachmentDraft {
  const _TaskAttachmentDraft({
    required this.name,
    required this.contentType,
    required this.bytes,
  });

  final String name;
  final String contentType;
  final List<int> bytes;

  int get byteSize => bytes.length;
}
