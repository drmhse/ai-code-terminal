import 'dart:convert';
import 'dart:io';

import 'package:act_frontend/src/models/file_content.dart';
import 'package:act_frontend/src/services/file_content_cache_types.dart';
import 'package:path_provider/path_provider.dart';

class FileContentCache {
  FileContentCache({Directory? rootDirectory}) : _rootDirectory = rootDirectory;

  final Directory? _rootDirectory;

  Future<CachedFileContent?> read({
    required String workspaceId,
    required String path,
  }) async {
    final file = await _cacheFile(workspaceId: workspaceId, path: path);
    if (!await file.exists()) {
      return null;
    }

    try {
      final raw = await file.readAsString();
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) {
        return null;
      }
      final contentJson = decoded['content'];
      if (contentJson is! Map<String, dynamic>) {
        return null;
      }
      return CachedFileContent(
        content: FileContent.fromJson(contentJson),
        cachedAt:
            DateTime.tryParse(
              decoded['cached_at']?.toString() ?? '',
            )?.toUtc() ??
            DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
        dirty: decoded['dirty'] == true,
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> writeClean({
    required String workspaceId,
    required FileContent content,
  }) async {
    await _write(workspaceId: workspaceId, content: content, dirty: false);
  }

  Future<void> writeDraft({
    required String workspaceId,
    required FileContent content,
  }) async {
    await _write(workspaceId: workspaceId, content: content, dirty: true);
  }

  Future<void> _write({
    required String workspaceId,
    required FileContent content,
    required bool dirty,
  }) async {
    final file = await _cacheFile(workspaceId: workspaceId, path: content.path);
    await file.parent.create(recursive: true);
    final payload = jsonEncode({
      'workspace_id': workspaceId,
      'cached_at': DateTime.now().toUtc().toIso8601String(),
      'dirty': dirty,
      'content': content.toJson(),
    });
    final tmp = File('${file.path}.tmp');
    await tmp.writeAsString(payload, flush: true);
    await tmp.rename(file.path);
  }

  Future<File> _cacheFile({
    required String workspaceId,
    required String path,
  }) async {
    final root = await _root();
    final key = base64Url.encode(utf8.encode('$workspaceId::$path'));
    return File('${root.path}/$key.json');
  }

  Future<Directory> _root() async {
    final explicit = _rootDirectory;
    if (explicit != null) {
      return explicit;
    }
    final support = await getApplicationSupportDirectory();
    return Directory('${support.path}/act-file-cache/v1');
  }
}
