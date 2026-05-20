import 'package:flutter/foundation.dart';

enum AuthOsProvider {
  github('github', 'GitHub'),
  google('google', 'Google');

  const AuthOsProvider(this.slug, this.label);

  final String slug;
  final String label;
}

class AuthOsConfig {
  const AuthOsConfig({
    required this.baseUrl,
    required this.orgSlug,
    required this.serviceSlug,
    required this.clientId,
  });

  final String baseUrl;
  final String orgSlug;
  final String serviceSlug;
  final String clientId;

  String get normalizedBaseUrl {
    final trimmed = baseUrl.trim();
    return trimmed.endsWith('/')
        ? trimmed.substring(0, trimmed.length - 1)
        : trimmed;
  }

  Uri loginUri(AuthOsProvider provider, String redirectUri) {
    final queryParameters = {
      'org': orgSlug,
      'service': serviceSlug,
      'redirect_uri': redirectUri,
    };
    return Uri.parse(
      '$normalizedBaseUrl/auth/${provider.slug}',
    ).replace(queryParameters: queryParameters);
  }

  Uri linkUri(AuthOsProvider provider, String redirectUri) {
    return Uri.parse(
      '$normalizedBaseUrl/api/user/linked-accounts/${provider.slug}/link',
    ).replace(queryParameters: {'redirect_uri': redirectUri});
  }

  Uri linkedAccountsUri() {
    return Uri.parse('$normalizedBaseUrl/api/user/linked-accounts');
  }

  Uri linkedAccountGrantsUri(String accountId) {
    return Uri.parse(
      '$normalizedBaseUrl/api/user/linked-accounts/'
      '${Uri.encodeComponent(accountId)}/grants',
    );
  }

  Uri providerTokenRequestLinkUri(String requestState) {
    return Uri.parse(
      '$normalizedBaseUrl/api/user/provider-token-requests/'
      '${Uri.encodeComponent(requestState)}/link',
    );
  }

  Uri providerTokenRequestUri(String requestState) {
    return Uri.parse(
      '$normalizedBaseUrl/api/user/provider-token-requests/'
      '${Uri.encodeComponent(requestState)}',
    );
  }

  Uri providerTokenRequestCompleteUri(String requestState) {
    return Uri.parse(
      '$normalizedBaseUrl/api/user/provider-token-requests/'
      '${Uri.encodeComponent(requestState)}/complete',
    );
  }

  Uri deviceCodeUri() => Uri.parse('$normalizedBaseUrl/auth/device/code');

  Uri tokenUri() => Uri.parse('$normalizedBaseUrl/auth/token');

  Uri refreshUri() => Uri.parse('$normalizedBaseUrl/api/auth/refresh');
}

const authOsClientId = String.fromEnvironment(
  'AUTHOS_CLIENT_ID',
  defaultValue: 'replace-with-client-id',
);

const authOsOrgSlug = String.fromEnvironment(
  'AUTHOS_ORG_SLUG',
  defaultValue: 'example-org',
);

const authOsServiceSlug = String.fromEnvironment(
  'AUTHOS_SERVICE_SLUG',
  defaultValue: 'act',
);

const authOsNativeRedirectUri = String.fromEnvironment(
  'AUTHOS_NATIVE_REDIRECT_URI',
  defaultValue: 'act://auth/callback',
);

String defaultAuthOsBaseUrl() {
  final configuredBaseUrl = configuredAuthOsBaseUrl();
  return configuredBaseUrl.isEmpty
      ? 'https://auth.example.com'
      : configuredBaseUrl;
}

String configuredAuthOsBaseUrl() {
  return const String.fromEnvironment('AUTHOS_BASE_URL');
}

bool hasConfiguredAuthOsBaseUrlOverride() {
  return configuredAuthOsBaseUrl().isNotEmpty;
}

String defaultAuthOsRedirectUri() {
  if (kIsWeb) {
    return '${Uri.base.origin}/auth/callback';
  }
  return authOsNativeRedirectUri;
}
