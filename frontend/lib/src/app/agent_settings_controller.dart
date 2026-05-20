import 'package:act_frontend/src/models/coding_agent.dart';
import 'package:act_frontend/src/services/connection_settings_store.dart';
import 'package:flutter/material.dart';

class AgentSettingsController extends ChangeNotifier {
  AgentSettingsController(this._store);

  final ConnectionSettingsStore _store;

  String _defaultAgentProvider = CodingAgents.codex.id;
  String _defaultProviderModel = CodingAgents.codex.defaultModel;
  String _defaultProviderThinkingLevel =
      CodingAgents.codex.defaultThinkingLevel;

  String get defaultAgentProvider => _defaultAgentProvider;
  String get defaultProviderModel => _defaultProviderModel;
  String get defaultProviderThinkingLevel => _defaultProviderThinkingLevel;
  CodingAgent get defaultAgent => CodingAgents.byId(_defaultAgentProvider);

  Future<void> load() async {
    final settings = await _store.loadAgentDefaults();
    _defaultAgentProvider = CodingAgents.normalize(settings.agentProvider);
    _defaultProviderModel = settings.providerModel.trim();
    _defaultProviderThinkingLevel = settings.providerThinkingLevel.trim();
    notifyListeners();
  }

  Future<void> saveDefaults({
    required String agentProvider,
    required String providerModel,
    required String providerThinkingLevel,
  }) async {
    final agent = CodingAgents.byId(agentProvider);
    final nextModel = providerModel.trim();
    final nextThinking = providerThinkingLevel.trim();
    final changed =
        _defaultAgentProvider != agent.id ||
        _defaultProviderModel != nextModel ||
        _defaultProviderThinkingLevel != nextThinking;
    _defaultAgentProvider = agent.id;
    _defaultProviderModel = nextModel;
    _defaultProviderThinkingLevel = nextThinking;
    if (changed) {
      notifyListeners();
    }
    await _store.saveAgentDefaults(
      agentProvider: agent.id,
      providerModel: nextModel,
      providerThinkingLevel: nextThinking,
    );
  }
}

class AgentSettingsScope extends InheritedNotifier<AgentSettingsController> {
  const AgentSettingsScope({
    required AgentSettingsController controller,
    required super.child,
    super.key,
  }) : super(notifier: controller);

  static AgentSettingsController of(BuildContext context) {
    final scope = context
        .dependOnInheritedWidgetOfExactType<AgentSettingsScope>();
    assert(scope?.notifier != null, 'AgentSettingsScope not found in context');
    return scope!.notifier!;
  }
}
