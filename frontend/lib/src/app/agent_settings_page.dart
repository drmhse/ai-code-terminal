import 'dart:async';

import 'package:act_frontend/src/app/agent_settings_controller.dart';
import 'package:act_frontend/src/app/app_colors.dart';
import 'package:act_frontend/src/models/coding_agent.dart';
import 'package:act_frontend/src/services/act_api.dart';
import 'package:flutter/material.dart';

class AgentSettingsPage extends StatefulWidget {
  const AgentSettingsPage({this.api, super.key});

  final ActApi? api;

  @override
  State<AgentSettingsPage> createState() => _AgentSettingsPageState();
}

class _AgentSettingsPageState extends State<AgentSettingsPage> {
  late String _agentProvider;
  late final TextEditingController _modelController;
  late final TextEditingController _thinkingController;
  List<CodingAgentModel> _models = const [];
  String? _modelsError;
  bool _isLoadingModels = false;
  bool _initialized = false;
  bool _requestedModels = false;

  @override
  void initState() {
    super.initState();
    _agentProvider = CodingAgents.codex.id;
    _modelController = TextEditingController();
    _thinkingController = TextEditingController();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) {
      return;
    }
    final controller = AgentSettingsScope.of(context);
    _agentProvider = controller.defaultAgentProvider;
    _modelController.text = controller.defaultProviderModel;
    _thinkingController.text = controller.defaultProviderThinkingLevel;
    _initialized = true;
    unawaited(_loadModels());
  }

  @override
  void dispose() {
    _modelController.dispose();
    _thinkingController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = AgentSettingsScope.of(context);
    final selectedAgent = CodingAgents.byId(_agentProvider);
    return Scaffold(
      backgroundColor: AppColors.page(context),
      appBar: AppBar(
        title: const Text('Agent Settings'),
        actions: [
          IconButton(
            tooltip: 'Close',
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.close),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _CurrentAgentBanner(agent: selectedAgent),
            const SizedBox(height: 14),
            for (final agent in CodingAgents.all) ...[
              _AgentChoiceTile(
                agent: agent,
                selected: agent.id == _agentProvider,
                onSelected: () => _selectAgent(agent),
              ),
              const SizedBox(height: 10),
            ],
            const SizedBox(height: 6),
            _ModelPicker(
              controller: _modelController,
              models: _models,
              isLoading: _isLoadingModels,
              errorText: _modelsError,
              onChanged: () => setState(() {}),
            ),
            const SizedBox(height: 12),
            _ThinkingLevelPicker(
              controller: _thinkingController,
              selectedAgent: selectedAgent,
              selectedModel: _selectedModel,
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: () async {
                await controller.saveDefaults(
                  agentProvider: _agentProvider,
                  providerModel: _modelController.text,
                  providerThinkingLevel: _selectedThinkingLevel,
                );
                if (context.mounted) {
                  Navigator.pop(context);
                }
              },
              icon: const Icon(Icons.check),
              label: const Text('Apply'),
            ),
          ],
        ),
      ),
    );
  }

  void _selectAgent(CodingAgent agent) {
    setState(() {
      _agentProvider = agent.id;
      if (_modelController.text.trim().isEmpty) {
        _modelController.text = agent.defaultModel;
      }
      if (_thinkingController.text.trim().isEmpty) {
        _thinkingController.text = agent.defaultThinkingLevel;
      }
    });
  }

  Future<void> _loadModels() async {
    final api = widget.api;
    if (api == null || _requestedModels) {
      return;
    }
    _requestedModels = true;
    setState(() {
      _isLoadingModels = true;
      _modelsError = null;
    });
    try {
      final models = await api.codingAgentModels();
      if (!mounted) {
        return;
      }
      setState(() {
        _models = models
            .where((model) => model.slug.trim().isNotEmpty)
            .toList(growable: false);
        _isLoadingModels = false;
      });
      if (_modelController.text.trim().isEmpty && _models.isNotEmpty) {
        _modelController.text = _models.first.slug;
      }
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _isLoadingModels = false;
        _modelsError = 'Model catalog unavailable';
      });
    }
  }

  CodingAgentModel? get _selectedModel {
    final slug = _modelController.text.trim();
    if (slug.isEmpty) {
      return null;
    }
    return _models.cast<CodingAgentModel?>().firstWhere(
      (model) => model?.slug == slug,
      orElse: () => null,
    );
  }

  String get _selectedThinkingLevel {
    return _ThinkingLevelPicker.normalizedValue(
      current: _thinkingController.text,
      selectedAgent: CodingAgents.byId(_agentProvider),
      selectedModel: _selectedModel,
    );
  }
}

class _ModelPicker extends StatelessWidget {
  const _ModelPicker({
    required this.controller,
    required this.models,
    required this.isLoading,
    required this.errorText,
    required this.onChanged,
  });

  final TextEditingController controller;
  final List<CodingAgentModel> models;
  final bool isLoading;
  final String? errorText;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final current = controller.text.trim();
    final values = <CodingAgentModel>[
      ...models,
      if (current.isNotEmpty && !models.any((model) => model.slug == current))
        CodingAgentModel(slug: current, displayName: current, source: 'custom'),
    ];
    if (values.isEmpty) {
      return TextField(
        controller: controller,
        decoration: InputDecoration(
          labelText: 'Default model',
          helperText: isLoading
              ? 'Loading available models'
              : 'Custom model id',
          errorText: errorText,
        ),
        textInputAction: TextInputAction.next,
      );
    }
    return DropdownButtonFormField<String>(
      initialValue: current.isEmpty ? values.first.slug : current,
      decoration: InputDecoration(
        labelText: 'Default model',
        helperText: isLoading
            ? 'Loading available models'
            : 'From Codex model catalog',
        errorText: errorText,
      ),
      items: [
        for (final model in values)
          DropdownMenuItem<String>(
            value: model.slug,
            child: Text(_modelLabel(model), overflow: TextOverflow.ellipsis),
          ),
      ],
      onChanged: (value) {
        if (value != null) {
          controller.text = value;
          onChanged();
        }
      },
    );
  }

  String _modelLabel(CodingAgentModel model) {
    final name = model.displayName.trim().isEmpty
        ? model.slug
        : model.displayName;
    return name == model.slug ? model.slug : '$name (${model.slug})';
  }
}

class _ThinkingLevelPicker extends StatelessWidget {
  const _ThinkingLevelPicker({
    required this.controller,
    required this.selectedAgent,
    required this.selectedModel,
  });

  static const _fallbackLevels = ['off', 'low', 'medium', 'high', 'xhigh'];

  final TextEditingController controller;
  final CodingAgent selectedAgent;
  final CodingAgentModel? selectedModel;

  @override
  Widget build(BuildContext context) {
    final values = _values();
    final current = normalizedValue(
      current: controller.text,
      selectedAgent: selectedAgent,
      selectedModel: selectedModel,
    );
    if (controller.text.trim() != current) {
      controller.text = current;
    }
    return DropdownButtonFormField<String>(
      initialValue: current,
      decoration: const InputDecoration(labelText: 'Thinking level'),
      items: [
        for (final value in values)
          DropdownMenuItem<String>(
            value: value,
            child: Text(_label(value), overflow: TextOverflow.ellipsis),
          ),
      ],
      onChanged: (value) {
        if (value != null) {
          controller.text = value;
        }
      },
    );
  }

  static String normalizedValue({
    required String current,
    required CodingAgent selectedAgent,
    required CodingAgentModel? selectedModel,
  }) {
    final values = _valuesFor(selectedAgent, selectedModel);
    final trimmed = current.trim().toLowerCase();
    if (trimmed.isNotEmpty && values.contains(trimmed)) {
      return trimmed;
    }
    final modelDefault = selectedModel?.defaultReasoningLevel
        ?.trim()
        .toLowerCase();
    if (modelDefault != null &&
        modelDefault.isNotEmpty &&
        values.contains(modelDefault)) {
      return modelDefault;
    }
    final agentDefault = selectedAgent.defaultThinkingLevel
        .trim()
        .toLowerCase();
    if (agentDefault.isNotEmpty && values.contains(agentDefault)) {
      return agentDefault;
    }
    return values.first;
  }

  List<String> _values() => _valuesFor(selectedAgent, selectedModel);

  static List<String> _valuesFor(
    CodingAgent selectedAgent,
    CodingAgentModel? selectedModel,
  ) {
    final values = <String>{
      ..._fallbackLevels,
      ...selectedModel?.supportedReasoningLevels.map(
            (level) => level.trim().toLowerCase(),
          ) ??
          const Iterable<String>.empty(),
      if (selectedModel?.defaultReasoningLevel?.trim().isNotEmpty == true)
        selectedModel!.defaultReasoningLevel!.trim().toLowerCase(),
      if (selectedAgent.defaultThinkingLevel.trim().isNotEmpty)
        selectedAgent.defaultThinkingLevel.trim().toLowerCase(),
    }..removeWhere((value) => value.isEmpty);
    return [
      for (final level in _fallbackLevels)
        if (values.remove(level)) level,
      ...values.toList()..sort(),
    ];
  }

  String _label(String value) {
    return switch (value) {
      'off' => 'Off',
      'xhigh' => 'Extra high',
      _ => '${value[0].toUpperCase()}${value.substring(1)}',
    };
  }
}

class _CurrentAgentBanner extends StatelessWidget {
  const _CurrentAgentBanner({required this.agent});

  final CodingAgent agent;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.chrome(context),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.line(context)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(agent.icon, color: AppColors.accent(context), size: 28),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                agent.label,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 20,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AgentChoiceTile extends StatelessWidget {
  const _AgentChoiceTile({
    required this.agent,
    required this.selected,
    required this.onSelected,
  });

  final CodingAgent agent;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.chrome(context),
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onSelected,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: selected
                  ? AppColors.accent(context)
                  : AppColors.line(context),
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              Icon(agent.icon, color: AppColors.accent(context)),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  agent.label,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
              Icon(
                selected
                    ? Icons.radio_button_checked
                    : Icons.radio_button_unchecked,
                color: selected
                    ? AppColors.accent(context)
                    : AppColors.mutedText(context),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
