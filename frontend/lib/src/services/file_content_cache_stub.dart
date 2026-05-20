import 'package:act_frontend/src/models/file_content.dart';
import 'package:act_frontend/src/services/file_content_cache_types.dart';

class FileContentCache {
  FileContentCache({Object? rootDirectory});

  final _items = <String, CachedFileContent>{};

  Future<CachedFileContent?> read({
    required String workspaceId,
    required String path,
  }) async {
    return _items[_key(workspaceId, path)];
  }

  Future<void> writeClean({
    required String workspaceId,
    required FileContent content,
  }) async {
    _items[_key(workspaceId, content.path)] = CachedFileContent(
      content: content,
      cachedAt: DateTime.now().toUtc(),
      dirty: false,
    );
  }

  Future<void> writeDraft({
    required String workspaceId,
    required FileContent content,
  }) async {
    _items[_key(workspaceId, content.path)] = CachedFileContent(
      content: content,
      cachedAt: DateTime.now().toUtc(),
      dirty: true,
    );
  }

  String _key(String workspaceId, String path) => '$workspaceId::$path';
}
