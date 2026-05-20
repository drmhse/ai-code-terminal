import 'dart:io';

import 'package:act_frontend/src/models/file_content.dart';
import 'package:act_frontend/src/services/file_content_cache.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('persists clean and dirty file content per workspace path', () async {
    final root = await Directory.systemTemp.createTemp('act-file-cache-test-');
    addTearDown(() => root.delete(recursive: true));
    final cache = FileContentCache(rootDirectory: root);

    const cleanContent = FileContent(
      path: 'README.md',
      content: '# ACT\n',
      encoding: 'utf-8',
      size: 6,
      isBinary: false,
    );
    await cache.writeClean(workspaceId: 'workspace-1', content: cleanContent);

    final clean = await cache.read(
      workspaceId: 'workspace-1',
      path: 'README.md',
    );

    expect(clean, isNotNull);
    expect(clean!.dirty, isFalse);
    expect(clean.content.content, '# ACT\n');

    const draftContent = FileContent(
      path: 'README.md',
      content: '# ACT\n\nlocal draft\n',
      encoding: 'utf-8',
      size: 19,
      isBinary: false,
    );
    await cache.writeDraft(workspaceId: 'workspace-1', content: draftContent);

    final draft = await cache.read(
      workspaceId: 'workspace-1',
      path: 'README.md',
    );
    final otherWorkspace = await cache.read(
      workspaceId: 'workspace-2',
      path: 'README.md',
    );

    expect(draft, isNotNull);
    expect(draft!.dirty, isTrue);
    expect(draft.content.content, '# ACT\n\nlocal draft\n');
    expect(otherWorkspace, isNull);
  });

  test('ignores corrupt cache entries', () async {
    final root = await Directory.systemTemp.createTemp('act-file-cache-test-');
    addTearDown(() => root.delete(recursive: true));
    final cache = FileContentCache(rootDirectory: root);

    await cache.writeClean(
      workspaceId: 'workspace-1',
      content: const FileContent(
        path: 'README.md',
        content: 'clean',
        encoding: 'utf-8',
        size: 5,
        isBinary: false,
      ),
    );
    final cacheFile = await root
        .list()
        .where((entity) => entity is File)
        .cast<File>()
        .single;
    await cacheFile.writeAsString('not-json');

    final cached = await cache.read(
      workspaceId: 'workspace-1',
      path: 'README.md',
    );

    expect(cached, isNull);
  });
}
