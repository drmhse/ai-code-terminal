import 'package:act_frontend/src/services/auth_os_client.dart';
import 'package:act_frontend/src/services/auth_os_config.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  const config = AuthOsConfig(
    baseUrl: 'https://auth.example.com/',
    orgSlug: 'example-org',
    serviceSlug: 'act',
    clientId: 'client-id',
  );

  test('builds AuthOS Google login URL like Flux', () {
    final uri = config.loginUri(
      AuthOsProvider.google,
      'https://app.example.com/auth/callback',
    );

    expect(uri.path, '/auth/google');
    expect(uri.queryParameters['org'], 'example-org');
    expect(uri.queryParameters['service'], 'act');
    expect(
      uri.queryParameters['redirect_uri'],
      'https://app.example.com/auth/callback',
    );
    expect(uri.queryParameters.containsKey('state'), isFalse);
  });

  test('does not override AuthOS provider scopes from login URLs', () {
    final githubUri = config.loginUri(
      AuthOsProvider.github,
      'https://app.example.com/auth/callback',
    );
    final googleUri = config.loginUri(
      AuthOsProvider.google,
      'https://app.example.com/auth/callback',
    );

    expect(githubUri.queryParameters.containsKey('scope'), isFalse);
    expect(googleUri.queryParameters.containsKey('scope'), isFalse);
  });

  test('builds AuthOS provider link URL with callback redirect', () {
    final uri = config.linkUri(AuthOsProvider.github, 'act://auth/callback');

    expect(uri.path, '/api/user/linked-accounts/github/link');
    expect(uri.queryParameters['redirect_uri'], 'act://auth/callback');
  });

  test('builds AuthOS provider token request link URL', () {
    final uri = config.providerTokenRequestLinkUri('state 123');

    expect(
      uri.toString(),
      'https://auth.example.com/api/user/provider-token-requests/state%20123/link',
    );
  });

  test(
    'completes provider token request when existing account has scopes',
    () async {
      final requests = <http.Request>[];
      final client = AuthOsClient(
        client: MockClient((request) async {
          requests.add(request);
          if (request.method == 'GET') {
            return http.Response('''
            {
              "state": "state_123",
              "provider": "github",
              "requested_scopes": ["repo", "read:user"],
              "service_id": "svc_1",
              "service_name": "ACT",
              "expires_at": "2026-05-10T00:00:00Z",
              "accounts": [
                {
                  "id": "acct_1",
                  "provider": "github",
                  "provider_user_id": "gh-user",
                  "scopes": ["repo", "read:user", "user:email"],
                  "status": "active",
                  "grants": []
                }
              ]
            }
          ''', 200);
          }
          return http.Response('{"redirect_url":"act://auth/callback"}', 200);
        }),
        config: config,
      );

      final completed = await client
          .completeProviderTokenRequestWithExistingAccount(
            'https://auth.example.com/connect/provider-token/state_123',
            accessToken: 'jwt',
          );

      expect(completed, isTrue);
      expect(requests.first.method, 'GET');
      expect(
        requests.first.url.path,
        '/api/user/provider-token-requests/state_123',
      );
      expect(requests.last.method, 'POST');
      expect(
        requests.last.url.path,
        '/api/user/provider-token-requests/state_123/complete',
      );
      expect(requests.last.body, contains('acct_1'));
    },
  );

  test('loads linked accounts and grants existing provider account', () async {
    final requests = <http.Request>[];
    final client = AuthOsClient(
      client: MockClient((request) async {
        requests.add(request);
        if (request.method == 'GET') {
          return http.Response('''
            {
              "accounts": [
                {
                  "id": "acct_1",
                  "provider": "github",
                  "provider_user_id": "gh-user",
                  "email": "user@example.com",
                  "scopes": ["repo", "read:user"],
                  "status": "active",
                  "grants": []
                }
              ],
              "available_providers": [
                {
                  "provider": "github",
                  "display_name": "GitHub",
                  "scopes": ["repo"],
                  "connect_supported": true
                }
              ]
            }
            ''', 200);
        }
        return http.Response('{"id":"grant_1","service_id":"svc_1"}', 200);
      }),
      config: config,
    );

    final accounts = await client.linkedAccounts(accessToken: 'jwt');
    expect(accounts.accountsFor(AuthOsProvider.github), hasLength(1));
    expect(accounts.accounts.first.email, 'user@example.com');

    await client.grantLinkedAccount(
      accountId: 'acct_1',
      scopes: const ['repo', 'read:user'],
      accessToken: 'jwt',
    );

    expect(requests.first.url.path, '/api/user/linked-accounts');
    expect(requests.first.headers['authorization'], 'Bearer jwt');
    expect(requests.last.url.path, '/api/user/linked-accounts/acct_1/grants');
    expect(requests.last.body, contains('read:user'));
  });

  test('parses AuthOS callback access tokens from hash or query params', () {
    final client = AuthOsClient(
      client: MockClient((_) async {
        return http.Response('{}', 200);
      }),
      config: config,
    );

    expect(
      client
          .tokensFromCallback(
            Uri.parse(
              'https://app.example.com/auth/callback#access_token=hash-token&refresh_token=refresh-token',
            ),
          )
          ?.accessToken,
      'hash-token',
    );
    expect(
      client
          .tokensFromCallback(
            Uri.parse(
              'https://app.example.com/auth/callback?access_token=query-token',
            ),
          )
          ?.accessToken,
      'query-token',
    );
    expect(
      client
          .tokensFromCallback(
            Uri.parse(
              'https://app.example.com/#/auth/callback?access_token=hash-route-token',
            ),
          )
          ?.accessToken,
      'hash-route-token',
    );
    expect(
      client
          .tokensFromCallback(
            Uri.parse(
              'https://app.example.com/auth/callback#/auth/callback?access_token=nested-hash-token',
            ),
          )
          ?.accessToken,
      'nested-hash-token',
    );
    expect(
      client
          .tokensFromCallback(
            Uri.parse(
              'act://auth/callback#access_token=native-token&refresh_token=native-refresh',
            ),
          )
          ?.accessToken,
      'native-token',
    );
  });

  test('detects callback URLs without token payloads', () {
    final client = AuthOsClient(
      client: MockClient((_) async {
        return http.Response('{}', 200);
      }),
      config: config,
    );

    expect(
      client.isCallbackUri(Uri.parse('https://app.example.com/auth/callback')),
      isTrue,
    );
    expect(client.isCallbackUri(Uri.parse('act://auth/callback')), isTrue);
    expect(
      client.isCallbackUri(Uri.parse('https://app.example.com/')),
      isFalse,
    );
  });

  test('parses AuthOS provider link callbacks without replacing tokens', () {
    final client = AuthOsClient(
      client: MockClient((_) async {
        return http.Response('{}', 200);
      }),
      config: config,
    );

    final success = client.linkResultFromCallback(
      Uri.parse(
        'act://auth/callback?status=success&provider=github&action=link',
      ),
    );

    expect(success?.success, isTrue);
    expect(success?.provider, 'github');
    expect(
      client.tokensFromCallback(
        Uri.parse(
          'act://auth/callback?status=success&provider=github&action=link',
        ),
      ),
      isNull,
    );

    final failure = client.linkResultFromCallback(
      Uri.parse(
        'act://auth/callback?status=error&provider=github&action=link&error=denied',
      ),
    );

    expect(failure?.success, isFalse);
    expect(failure?.error, 'denied');
  });

  test('parses AuthOS provider grant callbacks as link success', () {
    final client = AuthOsClient(
      client: MockClient((_) async {
        return http.Response('{}', 200);
      }),
      config: config,
    );

    final success = client.linkResultFromCallback(
      Uri.parse(
        'act://auth/callback?provider_grant=success&provider=github&state=client-state',
      ),
    );

    expect(success?.success, isTrue);
    expect(success?.provider, 'github');
  });

  test('parses provider grant callbacks without provider metadata', () {
    final client = AuthOsClient(
      client: MockClient((_) async {
        return http.Response('{}', 200);
      }),
      config: config,
    );

    final success = client.linkResultFromCallback(
      Uri.parse(
        'act://auth/callback?provider_grant=success&state=client-state',
      ),
    );

    expect(success?.success, isTrue);
    expect(success?.provider, isNull);
    expect(success?.error, isNull);
  });
}
