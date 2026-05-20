part of '../auth_os_client.dart';

class AuthOsClient {
  const AuthOsClient({required this.client, required this.config});

  final http.Client client;
  final AuthOsConfig config;

  Future<void> launchProvider(AuthOsProvider provider) async {
    final loginUri = config.loginUri(provider, defaultAuthOsRedirectUri());
    final launched = await launchUrl(
      loginUri,
      mode: LaunchMode.externalApplication,
      webOnlyWindowName: '_self',
    );

    if (!launched) {
      throw const ActApiException('Could not open AuthOS sign-in page');
    }
  }

  Future<void> launchProviderLink(
    AuthOsProvider provider, {
    required String accessToken,
  }) async {
    final response = await client
        .post(
          config.linkUri(provider, defaultAuthOsRedirectUri()),
          headers: {'authorization': 'Bearer $accessToken'},
        )
        .timeout(const Duration(seconds: 20));

    final decoded = _decode(response);
    final authorizationUrl = decoded['authorization_url']?.toString();
    if (authorizationUrl == null || authorizationUrl.isEmpty) {
      throw const ActApiException('AuthOS did not return a link URL');
    }

    final launched = await launchUrl(
      Uri.parse(authorizationUrl),
      mode: LaunchMode.externalApplication,
      webOnlyWindowName: '_self',
    );

    if (!launched) {
      throw const ActApiException('Could not open AuthOS provider link page');
    }
  }

  Future<void> launchProviderTokenRequestLink(
    String reauthUrl, {
    required String accessToken,
  }) async {
    final requestState = _providerTokenRequestState(reauthUrl);
    if (requestState == null || requestState.isEmpty) {
      throw const ActApiException(
        'AuthOS returned an invalid GitHub authorization request',
      );
    }

    final response = await client
        .post(
          config.providerTokenRequestLinkUri(requestState),
          headers: _authHeaders(accessToken),
        )
        .timeout(const Duration(seconds: 20));

    final decoded = _decode(response);
    final authorizationUrl = decoded['authorization_url']?.toString();
    if (authorizationUrl == null || authorizationUrl.isEmpty) {
      throw const ActApiException(
        'AuthOS did not return a GitHub authorization URL',
      );
    }

    final launched = await launchUrl(
      Uri.parse(authorizationUrl),
      mode: LaunchMode.externalApplication,
      webOnlyWindowName: '_self',
    );

    if (!launched) {
      throw const ActApiException('Could not open GitHub authorization page');
    }
  }

  Future<bool> completeProviderTokenRequestWithExistingAccount(
    String reauthUrl, {
    required String accessToken,
  }) async {
    final requestState = _providerTokenRequestState(reauthUrl);
    if (requestState == null || requestState.isEmpty) {
      return false;
    }

    final requestResponse = await client
        .get(
          config.providerTokenRequestUri(requestState),
          headers: _authHeaders(accessToken),
        )
        .timeout(const Duration(seconds: 20));
    final request = _decode(requestResponse);
    final provider = request['provider']?.toString();
    final requestedScopes = _stringList(request['requested_scopes']);
    final accounts = request['accounts'];
    if (provider == null || requestedScopes.isEmpty || accounts is! List) {
      return false;
    }

    String? accountId;
    for (final accountJson in accounts.whereType<Map<String, dynamic>>()) {
      final account = AuthOsLinkedAccount.fromJson(accountJson);
      if (!account.active || account.provider != provider) {
        continue;
      }
      if (_missingScopes(account.scopes, requestedScopes).isEmpty) {
        accountId = account.id;
        break;
      }
    }
    if (accountId == null || accountId.isEmpty) {
      return false;
    }

    await client
        .post(
          config.providerTokenRequestCompleteUri(requestState),
          headers: {
            ..._authHeaders(accessToken),
            'content-type': 'application/json',
          },
          body: jsonEncode({'connected_account_id': accountId}),
        )
        .timeout(const Duration(seconds: 20))
        .then(_decode);

    return true;
  }

  Future<AuthOsLinkedAccounts> linkedAccounts({
    required String accessToken,
  }) async {
    final response = await client
        .get(config.linkedAccountsUri(), headers: _authHeaders(accessToken))
        .timeout(const Duration(seconds: 20));

    return AuthOsLinkedAccounts.fromJson(_decode(response));
  }

  Future<void> grantLinkedAccount({
    required String accountId,
    required List<String> scopes,
    required String accessToken,
  }) async {
    await client
        .post(
          config.linkedAccountGrantsUri(accountId),
          headers: {
            ..._authHeaders(accessToken),
            'content-type': 'application/json',
          },
          body: jsonEncode({'scopes': scopes}),
        )
        .timeout(const Duration(seconds: 20))
        .then(_decode);
  }

  Future<AuthOsDeviceCode> requestDeviceCode() async {
    final response = await client
        .post(
          config.deviceCodeUri(),
          headers: const {'content-type': 'application/json'},
          body: jsonEncode({
            'client_id': config.clientId,
            'org': config.orgSlug,
            'service': config.serviceSlug,
          }),
        )
        .timeout(const Duration(seconds: 20));

    return AuthOsDeviceCode.fromJson(_decode(response));
  }

  Future<AuthOsTokens?> pollDeviceToken(String deviceCode) async {
    final response = await client
        .post(
          config.tokenUri(),
          headers: const {'content-type': 'application/json'},
          body: jsonEncode({
            'grant_type': 'urn:ietf:params:oauth:grant-type:device_code',
            'client_id': config.clientId,
            'device_code': deviceCode,
          }),
        )
        .timeout(const Duration(seconds: 20));

    if (response.statusCode == 401) {
      return null;
    }

    return _tokensFromJson(_decode(response));
  }

  Future<AuthOsTokens> refreshToken(String refreshToken) async {
    final response = await client
        .post(
          config.refreshUri(),
          headers: const {'content-type': 'application/json'},
          body: jsonEncode({'refresh_token': refreshToken}),
        )
        .timeout(const Duration(seconds: 20));

    return _tokensFromJson(_decode(response));
  }

  AuthOsTokens? tokensFromCallback(Uri uri) {
    final hashParams = _callbackParams(uri);
    final accessToken =
        hashParams['access_token'] ?? uri.queryParameters['access_token'];
    if (accessToken == null || accessToken.isEmpty) {
      return null;
    }
    return AuthOsTokens(
      accessToken: accessToken,
      refreshToken:
          hashParams['refresh_token'] ?? uri.queryParameters['refresh_token'],
    );
  }

  AuthOsLinkResult? linkResultFromCallback(Uri uri) {
    final params = _callbackParams(uri);
    final isLinkCallback = params['action'] == 'link';
    final isProviderGrantCallback = params['provider_grant'] != null;
    if (!isLinkCallback && !isProviderGrantCallback) {
      return null;
    }

    final error = params['error_description'] ?? params['error'];
    final grantStatus = params['provider_grant'];
    return AuthOsLinkResult(
      provider: params['provider'],
      success:
          (params['status'] ?? grantStatus ?? 'success') == 'success' &&
          error == null,
      error: error,
    );
  }

  String? callbackError(Uri uri) {
    final hashParams = _callbackParams(uri);
    return hashParams['error_description'] ??
        uri.queryParameters['error_description'] ??
        hashParams['error'] ??
        uri.queryParameters['error'];
  }

  bool isCallbackUri(Uri uri) {
    return uri.path == '/auth/callback' ||
        (uri.scheme == 'act' &&
            uri.host == 'auth' &&
            uri.path == '/callback') ||
        uri.fragment.startsWith('/auth/callback') ||
        uri.fragment.startsWith('/#/auth/callback');
  }

  Map<String, String> _paramsFromFragment(String fragment) {
    var payload = fragment.trim();
    if (payload.isEmpty) {
      return const {};
    }

    if (payload.startsWith('#')) {
      payload = payload.substring(1);
    }

    final queryIndex = payload.indexOf('?');
    if (queryIndex >= 0) {
      payload = payload.substring(queryIndex + 1);
    } else {
      payload = payload.replaceFirst(RegExp(r'^/+'), '');
      if (payload.startsWith('#')) {
        payload = payload.substring(1);
      }
    }

    if (payload.isEmpty || !payload.contains('=')) {
      return const {};
    }

    return Uri.splitQueryString(payload);
  }

  Map<String, String> _callbackParams(Uri uri) {
    return {...uri.queryParameters, ..._paramsFromFragment(uri.fragment)};
  }

  AuthOsTokens _tokensFromJson(Map<String, dynamic> json) {
    return AuthOsTokens(
      accessToken: json['access_token'].toString(),
      refreshToken: json['refresh_token']?.toString(),
    );
  }

  Map<String, String> _authHeaders(String accessToken) {
    return {'authorization': 'Bearer $accessToken'};
  }

  String? _providerTokenRequestState(String reauthUrl) {
    final uri = Uri.tryParse(reauthUrl);
    if (uri == null) {
      return null;
    }
    final segments = uri.pathSegments;
    final markerIndex = segments.indexOf('provider-token');
    if (markerIndex >= 0 && markerIndex + 1 < segments.length) {
      return segments[markerIndex + 1];
    }
    final requestIndex = segments.indexOf('provider-token-requests');
    if (requestIndex >= 0 && requestIndex + 1 < segments.length) {
      return segments[requestIndex + 1];
    }
    return segments.isEmpty ? null : segments.last;
  }

  List<String> _missingScopes(List<String> available, List<String> required) {
    final granted = available
        .map((scope) => scope.trim().toLowerCase())
        .toSet();
    return required
        .where((scope) => !granted.contains(scope.trim().toLowerCase()))
        .toList(growable: false);
  }

  Map<String, dynamic> _decode(http.Response response) {
    final Object? decoded;
    try {
      decoded = jsonDecode(response.body);
    } on FormatException {
      throw const ActApiException('AuthOS returned a non-JSON response');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map && decoded['error'] != null
          ? decoded['error'].toString()
          : response.reasonPhrase ?? 'HTTP ${response.statusCode}';
      throw ActApiException(message, statusCode: response.statusCode);
    }

    if (decoded is! Map<String, dynamic>) {
      throw const ActApiException('AuthOS returned an unexpected response');
    }
    return decoded;
  }
}

List<String> _stringList(Object? value) {
  if (value is List) {
    return value.map((item) => item.toString()).toList(growable: false);
  }
  if (value is String && value.trim().isNotEmpty) {
    return value
        .split(RegExp(r'[\s,]+'))
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList(growable: false);
  }
  return const [];
}
