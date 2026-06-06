import 'package:act_frontend/src/models/workspace.dart';
import 'package:act_frontend/src/services/connection_settings_store.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'clearToken removes persisted AuthOS tokens but keeps endpoints',
    () async {
      FlutterSecureStorage.setMockInitialValues({});

      final store = ConnectionSettingsStore();
      await store.save(
        apiBaseUrl: 'https://act.example.com',
        authOsBaseUrl: 'https://auth.example.com',
        authToken: 'access-token',
        refreshToken: 'refresh-token',
      );

      await store.clearToken();

      final settings = await store.load(
        fallbackApiBaseUrl: 'http://fallback-api',
        fallbackAuthOsBaseUrl: 'http://fallback-authos',
        fallbackAuthOsOrgSlug: 'example-org',
        fallbackAuthOsServiceSlug: 'act',
        fallbackAuthOsClientId: 'client-id',
        fallbackRequiredGitHubScopes: const ['repo'],
      );
      expect(settings.apiBaseUrl, 'https://act.example.com');
      expect(settings.authOsBaseUrl, 'https://auth.example.com');
      expect(settings.authToken, isEmpty);
      expect(settings.refreshToken, isEmpty);
    },
  );

  test('persists cached workspaces for offline startup', () async {
    FlutterSecureStorage.setMockInitialValues({});

    final store = ConnectionSettingsStore();
    await store.saveCachedWorkspaces(const [
      Workspace(
        id: 'workspace-1',
        name: 'ACT',
        localPath: '/workspaces/act',
        isActive: true,
        githubRepo: 'drmhse/ai-code-terminal',
        githubUrl: 'https://github.com/drmhse/ai-code-terminal',
      ),
    ]);

    final cached = await store.loadCachedWorkspaces();
    expect(cached, hasLength(1));
    expect(cached.single.name, 'ACT');
    expect(cached.single.githubRepo, 'drmhse/ai-code-terminal');
  });

  test('clears cached workspaces without touching endpoints', () async {
    FlutterSecureStorage.setMockInitialValues({});

    final store = ConnectionSettingsStore();
    await store.save(
      apiBaseUrl: 'https://act.example.com',
      authOsBaseUrl: 'https://auth.example.com',
      authToken: '',
    );
    await store.saveCachedWorkspaces(const [
      Workspace(
        id: 'workspace-1',
        name: 'ACT',
        localPath: '/workspaces/act',
        isActive: true,
        githubRepo: '',
        githubUrl: '',
      ),
    ]);

    await store.clearCachedWorkspaces();

    final settings = await store.load(
      fallbackApiBaseUrl: 'http://fallback-api',
      fallbackAuthOsBaseUrl: 'http://fallback-authos',
      fallbackAuthOsOrgSlug: 'example-org',
      fallbackAuthOsServiceSlug: 'act',
      fallbackAuthOsClientId: 'client-id',
      fallbackRequiredGitHubScopes: const ['repo'],
    );
    expect(settings.apiBaseUrl, 'https://act.example.com');
    expect(settings.authOsBaseUrl, 'https://auth.example.com');
    expect(await store.loadCachedWorkspaces(), isEmpty);
  });

  test('persists terminal controls expanded preference', () async {
    FlutterSecureStorage.setMockInitialValues({});

    final store = ConnectionSettingsStore();
    expect(await store.loadTerminalControlsExpanded(), isTrue);

    await store.saveTerminalControlsExpanded(false);
    expect(await store.loadTerminalControlsExpanded(), isFalse);

    await store.saveTerminalControlsExpanded(true);
    expect(await store.loadTerminalControlsExpanded(), isTrue);
  });

  test('persists release mobile state migration marker', () async {
    FlutterSecureStorage.setMockInitialValues({});

    final store = ConnectionSettingsStore();
    expect(await store.loadReleaseMobileStateVersion(), isEmpty);

    await store.saveReleaseMobileStateVersion('v1');
    expect(await store.loadReleaseMobileStateVersion(), 'v1');
  });

  test(
    'switchProfile persists self-hosted AuthOS config and clears session',
    () async {
      FlutterSecureStorage.setMockInitialValues({});

      final store = ConnectionSettingsStore();
      await store.save(
        apiBaseUrl: 'https://act.example.com',
        authOsBaseUrl: 'https://auth.example.com',
        authToken: 'access-token',
        refreshToken: 'refresh-token',
      );
      await store.saveCachedWorkspaces(const [
        Workspace(
          id: 'workspace-1',
          name: 'ACT',
          localPath: '/workspaces/act',
          isActive: true,
          githubRepo: '',
          githubUrl: '',
        ),
      ]);

      await store.switchProfile(
        const ConnectionProfile(
          id: 'self-hosted:https://act.example.com',
          label: 'Self-hosted ACT (act.example.com)',
          apiBaseUrl: 'https://act.example.com',
          authOsBaseUrl: 'https://auth.example.com',
          authOsOrgSlug: 'selfhost',
          authOsServiceSlug: 'act',
          authOsClientId: 'self-hosted-client',
          requiredGitHubScopes: ['repo', 'read:user'],
        ),
      );

      final settings = await store.load(
        fallbackApiBaseUrl: 'https://act.example.com',
        fallbackAuthOsBaseUrl: 'https://auth.example.com',
        fallbackAuthOsOrgSlug: 'example-org',
        fallbackAuthOsServiceSlug: 'act',
        fallbackAuthOsClientId: 'hosted-client',
        fallbackRequiredGitHubScopes: const ['repo'],
      );
      expect(settings.profileId, 'self-hosted:https://act.example.com');
      expect(settings.profileLabel, 'Self-hosted ACT (act.example.com)');
      expect(settings.apiBaseUrl, 'https://act.example.com');
      expect(settings.authOsBaseUrl, 'https://auth.example.com');
      expect(settings.authOsOrgSlug, 'selfhost');
      expect(settings.authOsServiceSlug, 'act');
      expect(settings.authOsClientId, 'self-hosted-client');
      expect(settings.requiredGitHubScopes, ['repo', 'read:user']);
      expect(settings.authToken, isEmpty);
      expect(settings.refreshToken, isEmpty);
      expect(await store.loadCachedWorkspaces(), isEmpty);
    },
  );

  test(
    'switchProfile can return to hosted ACT without persisting built-in profile',
    () async {
      FlutterSecureStorage.setMockInitialValues({});

      final store = ConnectionSettingsStore();
      const hosted = ConnectionProfile(
        id: 'hosted',
        label: 'Hosted ACT',
        apiBaseUrl: 'https://act.example.com',
        authOsBaseUrl: 'https://auth.example.com',
        authOsOrgSlug: 'example-org',
        authOsServiceSlug: 'act',
        authOsClientId: 'hosted-client',
        requiredGitHubScopes: ['repo'],
        builtIn: true,
      );
      await store.switchProfile(
        const ConnectionProfile(
          id: 'self-hosted:http://203.0.113.10',
          label: 'Self-hosted ACT (203.0.113.10)',
          apiBaseUrl: 'http://203.0.113.10',
          authOsBaseUrl: 'http://203.0.113.10:8080',
          authOsOrgSlug: 'act',
          authOsServiceSlug: 'act',
          authOsClientId: 'self-hosted-client',
          requiredGitHubScopes: ['repo', 'read:user'],
        ),
      );
      await store.switchProfile(hosted);

      final settings = await store.load(
        fallbackApiBaseUrl: hosted.apiBaseUrl,
        fallbackAuthOsBaseUrl: hosted.authOsBaseUrl,
        fallbackAuthOsOrgSlug: hosted.authOsOrgSlug,
        fallbackAuthOsServiceSlug: hosted.authOsServiceSlug,
        fallbackAuthOsClientId: hosted.authOsClientId,
        fallbackRequiredGitHubScopes: hosted.requiredGitHubScopes,
      );
      final profiles = await store.loadProfiles(fallbackProfile: hosted);

      expect(settings.profileId, 'hosted');
      expect(settings.apiBaseUrl, 'https://act.example.com');
      expect(settings.authOsBaseUrl, 'https://auth.example.com');
      expect(profiles.where((profile) => profile.id == 'hosted'), hasLength(1));
      expect(
        profiles.where((profile) => profile.id.startsWith('self-hosted:')),
        hasLength(1),
      );
    },
  );
}
