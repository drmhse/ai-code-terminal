import 'dart:convert';

import 'package:act_frontend/src/models/workspace.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ConnectionSettings {
  const ConnectionSettings({
    required this.profileId,
    required this.profileLabel,
    required this.apiBaseUrl,
    required this.authOsBaseUrl,
    required this.authOsOrgSlug,
    required this.authOsServiceSlug,
    required this.authOsClientId,
    required this.requiredGitHubScopes,
    required this.authToken,
    required this.refreshToken,
  });

  final String profileId;
  final String profileLabel;
  final String apiBaseUrl;
  final String authOsBaseUrl;
  final String authOsOrgSlug;
  final String authOsServiceSlug;
  final String authOsClientId;
  final List<String> requiredGitHubScopes;
  final String authToken;
  final String refreshToken;
}

class AgentDefaults {
  const AgentDefaults({
    required this.agentProvider,
    required this.providerModel,
    required this.providerThinkingLevel,
  });

  final String agentProvider;
  final String providerModel;
  final String providerThinkingLevel;
}

class ConnectionProfile {
  const ConnectionProfile({
    required this.id,
    required this.label,
    required this.apiBaseUrl,
    required this.authOsBaseUrl,
    required this.authOsOrgSlug,
    required this.authOsServiceSlug,
    required this.authOsClientId,
    required this.requiredGitHubScopes,
    this.builtIn = false,
  });

  factory ConnectionProfile.fromJson(Map<String, dynamic> json) {
    return ConnectionProfile(
      id: json['id']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      apiBaseUrl: json['apiBaseUrl']?.toString() ?? '',
      authOsBaseUrl: json['authOsBaseUrl']?.toString() ?? '',
      authOsOrgSlug: json['authOsOrgSlug']?.toString() ?? '',
      authOsServiceSlug: json['authOsServiceSlug']?.toString() ?? '',
      authOsClientId: json['authOsClientId']?.toString() ?? '',
      requiredGitHubScopes: _stringList(json['requiredGitHubScopes']),
      builtIn: json['builtIn'] == true,
    );
  }

  final String id;
  final String label;
  final String apiBaseUrl;
  final String authOsBaseUrl;
  final String authOsOrgSlug;
  final String authOsServiceSlug;
  final String authOsClientId;
  final List<String> requiredGitHubScopes;
  final bool builtIn;

  Map<String, dynamic> toJson() => {
    'id': id,
    'label': label,
    'apiBaseUrl': apiBaseUrl,
    'authOsBaseUrl': authOsBaseUrl,
    'authOsOrgSlug': authOsOrgSlug,
    'authOsServiceSlug': authOsServiceSlug,
    'authOsClientId': authOsClientId,
    'requiredGitHubScopes': requiredGitHubScopes,
    'builtIn': builtIn,
  };
}

class ConnectionSettingsStore {
  ConnectionSettingsStore({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _apiBaseUrlKey = 'act.apiBaseUrl';
  static const _authOsBaseUrlKey = 'act.authOsBaseUrl';
  static const _authOsOrgSlugKey = 'act.authOsOrgSlug';
  static const _authOsServiceSlugKey = 'act.authOsServiceSlug';
  static const _authOsClientIdKey = 'act.authOsClientId';
  static const _requiredGitHubScopesKey = 'act.requiredGitHubScopes';
  static const _activeProfileIdKey = 'act.activeProfileId';
  static const _profilesKey = 'act.connectionProfiles';
  static const _authTokenKey = 'act.authToken';
  static const _refreshTokenKey = 'act.refreshToken';
  static const _workspaceCacheKey = 'act.cachedWorkspaces';
  static const _terminalControlsExpandedKey = 'act.terminalControlsExpanded';
  static const _releaseMobileStateVersionKey = 'act.releaseMobileStateVersion';
  static const _themeIdKey = 'act.themeId';
  static const _defaultAgentProviderKey = 'act.defaultAgentProvider';
  static const _defaultProviderModelKey = 'act.defaultProviderModel';
  static const _defaultProviderThinkingLevelKey =
      'act.defaultProviderThinkingLevel';

  Future<ConnectionSettings> load({
    required String fallbackApiBaseUrl,
    required String fallbackAuthOsBaseUrl,
    required String fallbackAuthOsOrgSlug,
    required String fallbackAuthOsServiceSlug,
    required String fallbackAuthOsClientId,
    required List<String> fallbackRequiredGitHubScopes,
  }) async {
    final fallbackProfile = ConnectionProfile(
      id: 'hosted',
      label: 'Hosted ACT',
      apiBaseUrl: fallbackApiBaseUrl,
      authOsBaseUrl: fallbackAuthOsBaseUrl,
      authOsOrgSlug: fallbackAuthOsOrgSlug,
      authOsServiceSlug: fallbackAuthOsServiceSlug,
      authOsClientId: fallbackAuthOsClientId,
      requiredGitHubScopes: fallbackRequiredGitHubScopes,
      builtIn: true,
    );
    final activeProfileId =
        await _storage.read(key: _activeProfileIdKey) ?? fallbackProfile.id;
    final profiles = await loadProfiles(fallbackProfile: fallbackProfile);
    final activeProfile = profiles
        .where((profile) => profile.id == activeProfileId)
        .cast<ConnectionProfile?>()
        .firstWhere((profile) => profile != null, orElse: () => null);
    final apiBaseUrl = await _storage.read(key: _apiBaseUrlKey);
    final authOsBaseUrl = await _storage.read(key: _authOsBaseUrlKey);
    final authOsOrgSlug = await _storage.read(key: _authOsOrgSlugKey);
    final authOsServiceSlug = await _storage.read(key: _authOsServiceSlugKey);
    final authOsClientId = await _storage.read(key: _authOsClientIdKey);
    final requiredGitHubScopes = await _storage.read(
      key: _requiredGitHubScopesKey,
    );
    final authToken = await _storage.read(key: _authTokenKey);
    final refreshToken = await _storage.read(key: _refreshTokenKey);
    final profile = activeProfile ?? fallbackProfile;
    return ConnectionSettings(
      profileId: profile.id,
      profileLabel: profile.label,
      apiBaseUrl: apiBaseUrl ?? profile.apiBaseUrl,
      authOsBaseUrl: authOsBaseUrl ?? profile.authOsBaseUrl,
      authOsOrgSlug: authOsOrgSlug ?? profile.authOsOrgSlug,
      authOsServiceSlug: authOsServiceSlug ?? profile.authOsServiceSlug,
      authOsClientId: authOsClientId ?? profile.authOsClientId,
      requiredGitHubScopes:
          _decodeStringList(requiredGitHubScopes) ??
          profile.requiredGitHubScopes,
      authToken: authToken ?? '',
      refreshToken: refreshToken ?? '',
    );
  }

  Future<void> save({
    required String apiBaseUrl,
    required String authOsBaseUrl,
    required String authToken,
    String? profileId,
    String? profileLabel,
    String? authOsOrgSlug,
    String? authOsServiceSlug,
    String? authOsClientId,
    List<String>? requiredGitHubScopes,
    String? refreshToken,
  }) async {
    if (profileId != null) {
      await _storage.write(key: _activeProfileIdKey, value: profileId);
    }
    await _storage.write(key: _apiBaseUrlKey, value: apiBaseUrl);
    await _storage.write(key: _authOsBaseUrlKey, value: authOsBaseUrl);
    if (authOsOrgSlug != null) {
      await _storage.write(key: _authOsOrgSlugKey, value: authOsOrgSlug);
    }
    if (authOsServiceSlug != null) {
      await _storage.write(
        key: _authOsServiceSlugKey,
        value: authOsServiceSlug,
      );
    }
    if (authOsClientId != null) {
      await _storage.write(key: _authOsClientIdKey, value: authOsClientId);
    }
    if (requiredGitHubScopes != null) {
      await _storage.write(
        key: _requiredGitHubScopesKey,
        value: jsonEncode(requiredGitHubScopes),
      );
    }
    if (profileLabel != null) {
      await _storage.write(key: 'act.profileLabel', value: profileLabel);
    }
    await _storage.write(key: _authTokenKey, value: authToken);
    if (refreshToken != null) {
      await _storage.write(key: _refreshTokenKey, value: refreshToken);
    }
  }

  Future<void> clearToken() async {
    await _storage.delete(key: _authTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }

  Future<AgentDefaults> loadAgentDefaults() async {
    final agentProvider = await _storage.read(key: _defaultAgentProviderKey);
    final providerModel = await _storage.read(key: _defaultProviderModelKey);
    final providerThinkingLevel = await _storage.read(
      key: _defaultProviderThinkingLevelKey,
    );
    return AgentDefaults(
      agentProvider: agentProvider ?? 'codex',
      providerModel: providerModel ?? '',
      providerThinkingLevel: providerThinkingLevel ?? '',
    );
  }

  Future<void> saveAgentDefaults({
    required String agentProvider,
    required String providerModel,
    required String providerThinkingLevel,
  }) async {
    await _storage.write(key: _defaultAgentProviderKey, value: agentProvider);
    await _storage.write(key: _defaultProviderModelKey, value: providerModel);
    await _storage.write(
      key: _defaultProviderThinkingLevelKey,
      value: providerThinkingLevel,
    );
  }

  Future<List<ConnectionProfile>> loadProfiles({
    required ConnectionProfile fallbackProfile,
  }) async {
    final raw = await _storage.read(key: _profilesKey);
    final profiles = <ConnectionProfile>[fallbackProfile];
    if (raw == null || raw.isEmpty) {
      return profiles;
    }
    try {
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        for (final item in decoded.whereType<Map<String, dynamic>>()) {
          final profile = ConnectionProfile.fromJson(item);
          if (profile.id.isNotEmpty &&
              !profiles.any((existing) => existing.id == profile.id)) {
            profiles.add(profile);
          }
        }
      }
    } catch (_) {
      return profiles;
    }
    return profiles;
  }

  Future<void> saveProfile(ConnectionProfile profile) async {
    final profiles = <ConnectionProfile>[];
    final raw = await _storage.read(key: _profilesKey);
    if (raw != null && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          profiles.addAll(
            decoded
                .whereType<Map<String, dynamic>>()
                .map(ConnectionProfile.fromJson)
                .where((profile) => profile.id.isNotEmpty),
          );
        }
      } catch (_) {
        profiles.clear();
      }
    }
    final merged = [
      for (final existing in profiles)
        if (existing.id != profile.id) existing,
      profile,
    ];
    await _storage.write(
      key: _profilesKey,
      value: jsonEncode(
        merged.where((candidate) => !candidate.builtIn).map((profile) {
          return profile.toJson();
        }).toList(),
      ),
    );
  }

  Future<void> switchProfile(ConnectionProfile profile) async {
    await saveProfile(profile);
    await _storage.write(key: _activeProfileIdKey, value: profile.id);
    await _storage.write(key: _apiBaseUrlKey, value: profile.apiBaseUrl);
    await _storage.write(key: _authOsBaseUrlKey, value: profile.authOsBaseUrl);
    await _storage.write(key: _authOsOrgSlugKey, value: profile.authOsOrgSlug);
    await _storage.write(
      key: _authOsServiceSlugKey,
      value: profile.authOsServiceSlug,
    );
    await _storage.write(
      key: _authOsClientIdKey,
      value: profile.authOsClientId,
    );
    await _storage.write(
      key: _requiredGitHubScopesKey,
      value: jsonEncode(profile.requiredGitHubScopes),
    );
    await clearToken();
    await clearCachedWorkspaces();
  }

  Future<void> clearCachedWorkspaces() async {
    await _storage.delete(key: _workspaceCacheKey);
  }

  Future<String> loadReleaseMobileStateVersion() async {
    return await _storage.read(key: _releaseMobileStateVersionKey) ?? '';
  }

  Future<void> saveReleaseMobileStateVersion(String version) async {
    await _storage.write(key: _releaseMobileStateVersionKey, value: version);
  }

  Future<List<Workspace>> loadCachedWorkspaces() async {
    final raw = await _storage.read(key: _workspaceCacheKey);
    if (raw == null || raw.isEmpty) {
      return const [];
    }
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) {
        return const [];
      }
      return decoded
          .whereType<Map<String, dynamic>>()
          .map(Workspace.fromJson)
          .toList(growable: false);
    } catch (_) {
      return const [];
    }
  }

  Future<void> saveCachedWorkspaces(List<Workspace> workspaces) async {
    await _storage.write(
      key: _workspaceCacheKey,
      value: jsonEncode(
        workspaces.map((workspace) => workspace.toJson()).toList(),
      ),
    );
  }

  Future<bool> loadTerminalControlsExpanded({bool fallback = true}) async {
    final raw = await _storage.read(key: _terminalControlsExpandedKey);
    if (raw == null) {
      return fallback;
    }
    return raw == 'true';
  }

  Future<void> saveTerminalControlsExpanded(bool expanded) async {
    await _storage.write(
      key: _terminalControlsExpandedKey,
      value: expanded.toString(),
    );
  }

  Future<String> loadThemeId() async {
    return await _storage.read(key: _themeIdKey) ?? 'emerald';
  }

  Future<void> saveThemeId(String themeId) async {
    await _storage.write(key: _themeIdKey, value: themeId);
  }
}

List<String> _stringList(Object? value) {
  if (value is List) {
    return value
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList(growable: false);
  }
  return const [];
}

List<String>? _decodeStringList(String? value) {
  if (value == null || value.isEmpty) {
    return null;
  }
  try {
    return _stringList(jsonDecode(value));
  } catch (_) {
    return null;
  }
}
