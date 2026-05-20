import 'package:flutter/material.dart';

class CodingAgent {
  const CodingAgent({
    required this.id,
    required this.label,
    required this.shortLabel,
    required this.defaultModel,
    required this.defaultThinkingLevel,
    required this.icon,
  });

  final String id;
  final String label;
  final String shortLabel;
  final String defaultModel;
  final String defaultThinkingLevel;
  final IconData icon;
}

class CodingAgentModel {
  const CodingAgentModel({
    required this.slug,
    required this.displayName,
    this.defaultReasoningLevel,
    this.supportedReasoningLevels = const [],
    this.source = 'local',
  });

  factory CodingAgentModel.fromJson(Map<String, dynamic> json) {
    return CodingAgentModel(
      slug: json['slug']?.toString() ?? '',
      displayName: json['display_name']?.toString() ?? '',
      defaultReasoningLevel: json['default_reasoning_level']?.toString(),
      supportedReasoningLevels: (json['supported_reasoning_levels'] is List)
          ? (json['supported_reasoning_levels'] as List)
                .map((value) => value.toString())
                .where((value) => value.trim().isNotEmpty)
                .toList(growable: false)
          : const [],
      source: json['source']?.toString() ?? 'local',
    );
  }

  final String slug;
  final String displayName;
  final String? defaultReasoningLevel;
  final List<String> supportedReasoningLevels;
  final String source;
}

class CodingAgents {
  const CodingAgents._();

  static const latestCodexModel = 'gpt-5.5';

  static const codex = CodingAgent(
    id: 'codex',
    label: 'Codex',
    shortLabel: 'Codex',
    defaultModel: '',
    defaultThinkingLevel: '',
    icon: Icons.auto_awesome,
  );

  static const pi = CodingAgent(
    id: 'pi',
    label: 'Pi',
    shortLabel: 'Pi',
    defaultModel: latestCodexModel,
    defaultThinkingLevel: 'off',
    icon: Icons.hub_outlined,
  );

  static const all = [codex, pi];

  static String normalize(String? value) {
    final normalized = value?.trim().toLowerCase();
    return normalized == pi.id ? pi.id : codex.id;
  }

  static CodingAgent byId(String? value) {
    final normalized = normalize(value);
    return all.firstWhere((agent) => agent.id == normalized);
  }
}
