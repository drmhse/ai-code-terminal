import 'dart:convert';

import 'package:http/http.dart' as http;

part 'mock_act_data.dart';

class MockActClient extends http.BaseClient {
  MockActClient();

  final _workspaces = <Map<String, dynamic>>[
    {
      'id': 'act',
      'name': 'ACT',
      'local_path': '/workspaces/ACT',
      'is_active': true,
      'github_repo': 'drmhse/ACT',
      'github_url': 'https://github.com/drmhse/ACT',
      'source_kind': 'github',
      'source_provider': 'github',
      'source_ref': 'main',
    },
    {
      'id': 'ai-code-terminal',
      'name': 'ai-code-terminal',
      'local_path': '/workspaces/ai-code-terminal',
      'is_active': true,
      'github_repo': 'drmhse/ai-code-terminal',
      'github_url': 'https://github.com/drmhse/ai-code-terminal',
      'source_kind': 'github',
      'source_provider': 'github',
      'source_ref': 'main',
    },
  ];

  final _sessions = <Map<String, dynamic>>[
    {
      'id': 'terminal-act',
      'session_name': 'ACT backend',
      'status': 'active',
      'workspace_id': 'act',
    },
    {
      'id': 'terminal-web',
      'session_name': 'Flutter web',
      'status': 'active',
      'workspace_id': 'ai-code-terminal',
    },
  ];

  final _codexSessions = <Map<String, dynamic>>[];
  final _tasks = <Map<String, dynamic>>[];
  int _counter = 3;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final path = request.url.path;
    final method = request.method.toUpperCase();
    final body = request is http.Request && request.body.isNotEmpty
        ? jsonDecode(request.body) as Map<String, dynamic>
        : <String, dynamic>{};

    final response = _route(method, path, request.url.queryParameters, body);
    return http.StreamedResponse(
      Stream.value(utf8.encode(jsonEncode(response.$2))),
      response.$1,
      headers: {'content-type': 'application/json'},
      reasonPhrase: response.$1 >= 400 ? 'Mock error' : 'OK',
    );
  }

  (int, Map<String, dynamic>) _route(
    String method,
    String path,
    Map<String, String> query,
    Map<String, dynamic> body,
  ) {
    if (method == 'GET' && path == '/api/v1/health') {
      return _ok({
        'status': 'healthy',
        'service': 'act-server',
        'version': 'mock',
      });
    }
    if (method == 'GET' && path == '/api/v1/deployment/config') {
      return _data({
        'act_public_url': 'https://act.drmhse.com',
        'authos_base_url': 'https://auth.example.com',
        'authos_org_slug': 'example-org',
        'authos_service_slug': 'act',
        'authos_client_id': 'demo-client',
        'required_github_scopes': [
          'repo',
          'read:user',
          'user:email',
          'read:org',
        ],
      });
    }
    if (method == 'GET' && path == '/api/v1/auth/me') {
      return _data({
        'email': 'demo@act.local',
        'plan': 'demo',
        'access_role': 'operator',
        'is_operator': true,
      });
    }
    if (method == 'GET' && path == '/api/v1/workspaces') {
      return _data(_workspaces);
    }
    if (method == 'GET' && path == '/api/v1/collections') {
      return _data([_collection()]);
    }
    if (method == 'GET' && path == '/api/v1/sessions') {
      return _data(_sessions);
    }
    if (method == 'POST' && path == '/api/v1/sessions') {
      final session = {
        'id': 'terminal-${_counter++}',
        'session_name': 'Demo terminal',
        'status': 'active',
        'workspace_id': body['workspace_id']?.toString() ?? 'act',
      };
      _sessions.insert(0, session);
      return _data(session);
    }
    if (method == 'DELETE' && path.startsWith('/api/v1/sessions/')) {
      _sessions.removeWhere((item) => item['id'] == path.split('/').last);
      return _ok({'success': true});
    }
    if (method == 'GET' && path.endsWith('/buffer')) {
      return _ok({'data': _bufferFor(path.split('/')[4])});
    }
    if (method == 'GET' && path == '/api/v1/system/stats') {
      return _data({
        'cpu_usage': 18.4,
        'memory_usage': 2418,
        'memory_total': 8192,
        'memory_percentage': 29.5,
        'disk_usage': 42,
        'disk_total': 120,
        'disk_percentage': 35.0,
        'active_sessions': _sessions.length,
        'active_processes': 3,
        'uptime_seconds': 86400,
        'system_health': 'Demo',
      });
    }
    if (path.contains('/files/content')) {
      return method == 'GET'
          ? _data(_fileContent(query['path'] ?? 'README.md'))
          : _ok({'success': true});
    }
    if (path.contains('/files')) {
      return _data(_listing(query['path'] ?? '.'));
    }
    if (method == 'GET' && path == '/api/v1/tasks/readiness') {
      return _data(_readiness());
    }
    if (path == '/api/v1/tasks') {
      if (method == 'POST') {
        final task = _task(
          id: 'task-${_counter++}',
          title: body['title']?.toString() ?? 'Demo task',
          status: 'ready',
        );
        _tasks.insert(0, task);
        return _data(task);
      }
      return _data(_allTasks());
    }
    if (method == 'POST' && path == '/api/v1/github/clone') {
      final workspace = {
        'id': 'cloned-${_counter++}',
        'name': body['name']?.toString() ?? 'cloned-repo',
        'local_path': '/workspaces/${body['name'] ?? 'cloned-repo'}',
        'is_active': true,
        'github_repo': body['name']?.toString() ?? '',
        'github_url': body['git_url']?.toString() ?? '',
        'source_kind': 'github',
        'source_provider': 'github',
        'source_ref': body['branch']?.toString() ?? 'main',
      };
      _workspaces.add(workspace);
      return _data({'workspace': workspace});
    }
    if (path.contains('/runs/') &&
        path.endsWith('/artifacts/artifact-report')) {
      return _data({'artifact': _artifact(), 'text': _mockReportText});
    }
    if (path.contains('/runs/') && path.endsWith('/finalize')) {
      return _data({'task': _completedTask()});
    }
    if (path.contains('/runs/') && path.endsWith('/pull-requests')) {
      return _data({'task': _completedTask(withPr: true)});
    }
    if (path.endsWith('/runs') && method == 'POST') {
      return _data(_run(status: 'running'));
    }
    if (RegExp(r'^/api/v1/tasks/[^/]+$').hasMatch(path) && method == 'PUT') {
      final updated = _task(
        id: path.split('/').last,
        title: body['title']?.toString() ?? 'Updated task',
        status: 'ready',
      );
      return _data(updated);
    }
    if (method == 'GET' && path == '/api/v1/codex/models') {
      return _data([
        {
          'id': 'gpt-5.5',
          'name': 'GPT-5.5',
          'provider': 'codex',
          'latest': true,
        },
        {'id': 'gpt-5.4', 'name': 'GPT-5.4', 'provider': 'codex'},
      ]);
    }
    if (path == '/api/v1/codex/sessions') {
      if (method == 'POST') {
        return _data(_launch(body));
      }
      return _data(_allCodexSessions());
    }
    if (path.endsWith('/messages') && method == 'POST') {
      return _data(
        _messageSession(path.split('/')[5], body['prompt']?.toString()),
      );
    }
    if (path.endsWith('/interrupt') && method == 'POST') {
      return _data(_sessionById(path.split('/')[5], status: 'idle'));
    }
    if (path.endsWith('/events')) {
      return _data(_events(path.split('/')[5]));
    }
    if (path.endsWith('/changes')) {
      return _data(_changes(path.split('/')[5]));
    }
    if (method == 'GET' && path == '/api/v1/github/status') {
      return _data({
        'available': true,
        'provider': 'github',
        'has_access_token': true,
        'has_refresh_token': true,
        'status': 'connected',
        'action_required': false,
        'scopes': ['repo', 'read:user', 'user:email', 'read:org'],
      });
    }
    if (method == 'GET' && path == '/api/v1/github/cli/status') {
      return _data({
        'installed': true,
        'authenticated': true,
        'username': 'example-user',
      });
    }
    if (method == 'GET' && path == '/api/v1/github/repositories') {
      return _data({
        'repositories': _repos(),
        'page': 1,
        'per_page': 50,
        'has_more': false,
      });
    }
    if (method == 'GET' && path == '/api/v1/workspaces/git/changes') {
      return _data([]);
    }
    if (method == 'GET' && path == '/api/v1/processes') {
      return _data(_processes());
    }
    if (path.startsWith('/api/v1/layouts')) {
      return _data([]);
    }
    if (method == 'POST' && path == '/api/v1/workspaces/empty') {
      final workspace = {
        'id': 'workspace-${_counter++}',
        'name': body['name']?.toString() ?? 'Demo workspace',
        'local_path': '/workspaces/demo',
        'is_active': true,
        'github_repo': '',
        'github_url': '',
      };
      _workspaces.add(workspace);
      return _data(workspace);
    }
    return _ok({'success': true, 'data': []});
  }

  (int, Map<String, dynamic>) _ok(Map<String, dynamic> json) => (200, json);
  (int, Map<String, dynamic>) _data(Object data) =>
      (200, {'success': true, 'data': data});
}
