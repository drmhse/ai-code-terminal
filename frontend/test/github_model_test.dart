import 'package:act_frontend/src/models/github.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('GitHubRepository parses normalized permissions', () {
    final readRepository = GitHubRepository.fromJson({
      'id': 1,
      'name': 'docs',
      'full_name': 'acme/docs',
      'clone_url': 'https://github.com/acme/docs.git',
      'private': true,
      'default_branch': 'main',
      'permissions': {'pull': true, 'push': false, 'admin': false},
    });
    expect(readRepository.viewerPermission, 'read');
    expect(readRepository.canRead, isTrue);
    expect(readRepository.canWrite, isFalse);

    final writeRepository = GitHubRepository.fromJson({
      'id': 2,
      'name': 'app',
      'full_name': 'acme/app',
      'clone_url': 'https://github.com/acme/app.git',
      'private': true,
      'default_branch': 'main',
      'permissions': {'pull': true, 'push': true, 'admin': false},
    });
    expect(writeRepository.viewerPermission, 'write');
    expect(writeRepository.canWrite, isTrue);
    expect(writeRepository.permissionLabel, 'Write');
  });
}
