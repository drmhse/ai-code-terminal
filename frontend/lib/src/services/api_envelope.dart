import 'package:act_frontend/src/services/act_api_exception.dart';

class ApiEnvelope {
  static T item<T>(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromJson,
  ) {
    final data = json['data'];
    if (data is! Map<String, dynamic>) {
      throw const ActApiException('Expected an object response');
    }
    return fromJson(data);
  }

  static List<T> list<T>(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromJson,
  ) {
    final data = json['data'];
    if (data is! List) {
      throw const ActApiException('Expected a list response');
    }
    return data
        .whereType<Map<String, dynamic>>()
        .map((entry) => fromJson(entry))
        .toList(growable: false);
  }
}
