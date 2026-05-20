class FileContent {
  const FileContent({
    required this.path,
    required this.content,
    required this.encoding,
    required this.size,
    required this.isBinary,
  });

  factory FileContent.fromJson(Map<String, dynamic> json) {
    return FileContent(
      path: json['path']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      encoding: json['encoding']?.toString() ?? 'utf-8',
      size: json['size'] is num ? (json['size'] as num).toInt() : 0,
      isBinary: json['is_binary'] == true,
    );
  }

  final String path;
  final String content;
  final String encoding;
  final int size;
  final bool isBinary;

  Map<String, dynamic> toJson() {
    return {
      'path': path,
      'content': content,
      'encoding': encoding,
      'size': size,
      'is_binary': isBinary,
    };
  }
}
