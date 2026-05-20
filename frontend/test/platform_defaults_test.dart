import 'package:act_frontend/src/core/platform_defaults.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('release mobile hosted profile replaces stale private API URLs', () {
    expect(
      shouldReplacePersistedApiBaseUrl(
        'http://192.168.1.10:3001',
        activeProfileId: 'hosted',
        releaseMobileBuild: true,
      ),
      isTrue,
    );
  });

  test('release mobile self-hosted profile keeps explicit HTTP IP URLs', () {
    expect(
      shouldReplacePersistedApiBaseUrl(
        'http://192.168.1.10:3001',
        activeProfileId: 'self-hosted:http://192.168.1.10:3001',
        releaseMobileBuild: true,
      ),
      isFalse,
    );
  });

  test('public hosted URL is not treated as a stale dev URL', () {
    expect(
      shouldReplacePersistedApiBaseUrl(
        'https://act.example.com',
        activeProfileId: 'hosted',
        releaseMobileBuild: true,
      ),
      isFalse,
    );
  });
}
