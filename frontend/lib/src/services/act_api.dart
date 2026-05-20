import 'dart:convert';

import 'package:act_frontend/src/models/directory_listing.dart';
import 'package:act_frontend/src/models/coding_agent.dart';
import 'package:act_frontend/src/models/codex_session.dart';
import 'package:act_frontend/src/models/deployment_config.dart';
import 'package:act_frontend/src/models/file_content.dart';
import 'package:act_frontend/src/models/github.dart';
import 'package:act_frontend/src/models/health_status.dart';
import 'package:act_frontend/src/models/native_task.dart';
import 'package:act_frontend/src/models/server_process.dart';
import 'package:act_frontend/src/models/system_stats.dart';
import 'package:act_frontend/src/models/terminal_layout.dart';
import 'package:act_frontend/src/models/terminal_session.dart';
import 'package:act_frontend/src/models/user_profile.dart';
import 'package:act_frontend/src/models/workspace.dart';
import 'package:act_frontend/src/models/workspace_git_changes.dart';
import 'package:act_frontend/src/models/workspace_collection.dart';
import 'package:act_frontend/src/services/act_api_exception.dart';
import 'package:act_frontend/src/services/api_envelope.dart';
import 'package:http/http.dart' as http;

part 'act_api/core_resources.dart';
part 'act_api/layouts.dart';
part 'act_api/tasks.dart';
part 'act_api/codex.dart';

class ActApi {
  ActApi({required this.client, required this.baseUrl, required this.token});

  final http.Client client;
  final String baseUrl;
  final String token;

  bool get hasToken => token.trim().isNotEmpty;

  Future<Map<String, dynamic>> _getPublic(String path) async {
    final response = await client
        .get(_uri(path))
        .timeout(const Duration(seconds: 12));
    return _decode(response, path);
  }

  Future<Map<String, dynamic>> _get(String path) async {
    final response = await client
        .get(_uri(path), headers: _headers)
        .timeout(const Duration(seconds: 20));
    return _decode(response, path);
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body,
  ) async {
    final response = await client
        .post(_uri(path), headers: _headers, body: jsonEncode(body))
        .timeout(const Duration(seconds: 20));
    return _decode(response, path);
  }

  Future<Map<String, dynamic>> _put(
    String path,
    Map<String, dynamic> body,
  ) async {
    final response = await client
        .put(_uri(path), headers: _headers, body: jsonEncode(body))
        .timeout(const Duration(seconds: 20));
    return _decode(response, path);
  }

  Future<Map<String, dynamic>> _delete(String path) async {
    final response = await client
        .delete(_uri(path), headers: _headers)
        .timeout(const Duration(seconds: 20));
    return _decode(response, path);
  }

  Map<String, String> get _headers => {
    'content-type': 'application/json',
    if (token.isNotEmpty) 'authorization': 'Bearer $token',
  };

  Map<String, String> get authHeaders => {
    if (token.isNotEmpty) 'authorization': 'Bearer $token',
  };

  Map<String, dynamic> _decode(http.Response response, String path) {
    final Object? decoded;
    try {
      decoded = jsonDecode(response.body);
    } on FormatException {
      final contentType = response.headers['content-type'] ?? 'unknown';
      if (response.body.trim().isEmpty) {
        final message = response.statusCode == 401
            ? 'ACT backend rejected the current session for $path'
            : 'ACT backend returned HTTP ${response.statusCode} with an empty response for $path';
        throw ActApiException(message, statusCode: response.statusCode);
      }
      final snippet = response.body.trim().replaceAll(RegExp(r'\s+'), ' ');
      throw ActApiException(
        'ACT backend returned HTTP ${response.statusCode} $contentType for $path instead of JSON: '
        '${snippet.length > 160 ? '${snippet.substring(0, 160)}...' : snippet}',
        statusCode: response.statusCode,
      );
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final rawMessage = decoded is Map
          ? _errorMessage(decoded['error']) ??
                response.reasonPhrase ??
                'HTTP ${response.statusCode}'
          : response.reasonPhrase ?? 'HTTP ${response.statusCode}';
      final parsed = _parseError(rawMessage);
      throw ActApiException(
        parsed.message,
        statusCode: response.statusCode,
        code: parsed.code,
      );
    }

    if (decoded is! Map<String, dynamic>) {
      throw const ActApiException('Backend returned an unexpected response');
    }

    if (decoded['success'] == false) {
      final parsed = _parseError(
        _errorMessage(decoded['error']) ?? 'Request failed',
      );
      throw ActApiException(parsed.message, code: parsed.code);
    }

    return decoded;
  }

  Uri _uri(String path) {
    return Uri.parse('$baseUrl$path');
  }

  Map<String, dynamic> _unwrapObject(Map<String, dynamic> json) {
    final data = json['data'];
    if (data is Map<String, dynamic>) {
      return data;
    }
    return json;
  }
}

String? _errorMessage(Object? error) {
  if (error is Map) {
    final details = error['details']?.toString().trim();
    if (details != null && details.isNotEmpty) {
      return details;
    }
    final message = error['message']?.toString().trim();
    if (message != null && message.isNotEmpty) {
      return message;
    }
  }
  final message = error?.toString().trim();
  return message == null || message.isEmpty ? null : message;
}

({String? code, String message}) _parseError(String raw) {
  final separator = raw.indexOf(':');
  if (separator > 0) {
    final code = raw.substring(0, separator).trim();
    final isCode = RegExp(r'^[a-z][a-z0-9_]*$').hasMatch(code);
    if (isCode) {
      return (code: code, message: raw.substring(separator + 1).trim());
    }
  }
  return (code: null, message: raw);
}
