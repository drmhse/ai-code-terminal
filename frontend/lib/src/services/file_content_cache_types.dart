import 'package:act_frontend/src/models/file_content.dart';

class CachedFileContent {
  const CachedFileContent({
    required this.content,
    required this.cachedAt,
    required this.dirty,
  });

  final FileContent content;
  final DateTime cachedAt;
  final bool dirty;
}
