import 'package:act_frontend/src/models/file_item.dart';

class DirectoryListing {
  const DirectoryListing({
    required this.path,
    required this.items,
    required this.totalItems,
    required this.hiddenItems,
  });

  factory DirectoryListing.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['items'];
    return DirectoryListing(
      path: json['path']?.toString() ?? '',
      items: itemsJson is List
          ? itemsJson
                .whereType<Map<String, dynamic>>()
                .map(FileItem.fromJson)
                .toList(growable: false)
          : const [],
      totalItems: json['total_items'] is num
          ? (json['total_items'] as num).toInt()
          : 0,
      hiddenItems: json['hidden_items'] is num
          ? (json['hidden_items'] as num).toInt()
          : 0,
    );
  }

  final String path;
  final List<FileItem> items;
  final int totalItems;
  final int hiddenItems;
}
