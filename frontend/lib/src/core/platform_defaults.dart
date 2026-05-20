import 'package:flutter/foundation.dart';

const _productionApiBaseUrl = 'https://act.example.com';
const actMockMode = bool.fromEnvironment('ACT_MOCK_MODE');

String defaultApiBaseUrl() {
  if (actMockMode) {
    return 'https://mock.act.local';
  }

  final configuredBaseUrl = configuredApiBaseUrl();
  if (configuredBaseUrl.isNotEmpty) {
    return configuredBaseUrl;
  }

  if (kIsWeb) {
    final localDevHost =
        Uri.base.host == 'localhost' || Uri.base.host == '127.0.0.1';
    final servedByBackend = Uri.base.port == 3001 || Uri.base.port == 3002;
    if (localDevHost && !servedByBackend) {
      return 'http://localhost:3001';
    }
    return Uri.base.origin;
  }

  if (kReleaseMode) {
    return _productionApiBaseUrl;
  }

  if (defaultTargetPlatform == TargetPlatform.android) {
    return 'http://10.0.2.2:3001';
  }

  return 'http://localhost:3001';
}

String configuredApiBaseUrl() {
  return const String.fromEnvironment('ACT_API_BASE_URL');
}

bool hasConfiguredApiBaseUrlOverride() {
  return configuredApiBaseUrl().isNotEmpty;
}

bool shouldReplacePersistedApiBaseUrl(
  String persistedBaseUrl, {
  String activeProfileId = 'hosted',
  bool? releaseMobileBuild,
}) {
  if (activeProfileId != 'hosted') {
    return false;
  }
  if (!(releaseMobileBuild ?? isReleaseMobileBuild())) {
    return false;
  }

  final uri = Uri.tryParse(persistedBaseUrl);
  final host = uri?.host.toLowerCase();
  return host == 'localhost' ||
      host == '127.0.0.1' ||
      host == '0.0.0.0' ||
      host == '10.0.2.2' ||
      host == '::1' ||
      host?.startsWith('10.') == true ||
      host?.startsWith('192.168.') == true ||
      _is172PrivateAddress(host);
}

bool isReleaseMobileBuild() {
  return !kIsWeb &&
      kReleaseMode &&
      (defaultTargetPlatform == TargetPlatform.iOS ||
          defaultTargetPlatform == TargetPlatform.android);
}

bool _is172PrivateAddress(String? host) {
  if (host == null) {
    return false;
  }
  final parts = host.split('.');
  if (parts.length != 4 || parts.first != '172') {
    return false;
  }
  final second = int.tryParse(parts[1]);
  return second != null && second >= 16 && second <= 31;
}
