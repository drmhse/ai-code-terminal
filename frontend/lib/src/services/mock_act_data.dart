part of 'mock_act_client.dart';

const _mockReportText =
    '# Final report\\n\\nThe ACT mock-mode frontend can be deployed as static files. Users can explore workspaces, tasks, Codex sessions, diffs, terminal panes, and repository actions without a backend.\\n';

extension _MockActData on MockActClient {
  Map<String, dynamic> _collection() => {
    'id': 'mobile-release',
    'name': 'Mobile release',
    'description': 'ACT app and public website rollout',
    'default_workspace_id': 'act',
    'members': [
      for (final workspace in _workspaces)
        {
          'collection_id': 'mobile-release',
          'workspace_id': workspace['id'],
          'role': workspace['id'] == 'act' ? 'primary' : 'member',
          'workspace': workspace,
        },
    ],
  };

  Map<String, dynamic> _listing(String path) => {
    'path': path,
    'total_items': 6,
    'hidden_items': 0,
    'items': [
      {'name': 'rust', 'path': 'rust', 'is_directory': true},
      {'name': 'deploy', 'path': 'deploy', 'is_directory': true},
      {
        'name': 'README.md',
        'path': 'README.md',
        'is_directory': false,
        'size': 2150,
        'git_status': 'modified',
      },
      {
        'name': 'GETTING_STARTED.md',
        'path': 'GETTING_STARTED.md',
        'is_directory': false,
        'size': 1490,
      },
      {
        'name': 'mock_mode.dart',
        'path': 'frontend/lib/src/services/mock_act_client.dart',
        'is_directory': false,
        'size': 8200,
        'git_status': 'untracked',
      },
    ],
  };

  Map<String, dynamic> _fileContent(String path) => {
    'path': path,
    'encoding': 'utf-8',
    'is_binary': false,
    'size': _contentFor(path).length,
    'content': _contentFor(path),
  };

  String _contentFor(String path) => path.endsWith('GETTING_STARTED.md')
      ? '# Getting started\n\nExplore workspaces, tasks, terminals, agent threads, and static mock mode.\n'
      : '# ACT\n\nMobile-first AI code terminal with hosted workspaces, Codex threads, native tasks, and GitHub workflows.\n';

  String _bufferFor(String sessionId) =>
      'ACT demo terminal\r\n\$ flutter build web --release --dart-define=ACT_MOCK_MODE=true\r\n'
      'Compiling lib/main.dart for the Web... done\r\n\$ _\r\n';

  Map<String, dynamic> _readiness() => {
    'runner_mode': 'demo',
    'codex_login_status': 'authenticated',
    'codex_version': 'codex mock',
    'pi_status': 'authenticated',
    'pi_version': 'pi mock',
    'workspace_root': '/workspaces',
    'artifact_root': '/artifacts',
    'runtime_root': '/runtime',
    'codex_home': '/runtime/codex',
    'available_disk_gb': 88,
    'min_free_disk_gb': 20,
    'github_provider_status': 'connected',
    'ready': true,
    'blocked_reasons': [],
  };

  List<Map<String, dynamic>> _allTasks() => _tasks.isEmpty
      ? [
          _completedTask(),
          _task(
            id: 'task-review',
            title: 'Review mock web release',
            status: 'ready',
          ),
        ]
      : _tasks;

  Map<String, dynamic> _task({
    required String id,
    required String title,
    required String status,
  }) => {
    'id': id,
    'title': title,
    'description':
        'Validate ACT UI flows, review changed files, and prepare the static public build.',
    'execution_mode': 'implement',
    'approval_mode': 'ask_before_edits',
    'evidence_preference': 'tests_plus_screenshots',
    'status': status,
    'agent_provider': 'codex',
    'provider_model': 'gpt-5.5',
    'provider_thinking_level': 'medium',
    'workspaces': [_taskWorkspace()],
    'attachments': [],
    'runs': status == 'ready' ? [] : [_run(status: status)],
  };

  Map<String, dynamic> _completedTask({bool withPr = false}) => _task(
    id: 'task-public',
    title: 'Prepare public ACT demo',
    status: 'completed',
  )..['runs'] = [_run(status: 'completed', withPr: withPr)];

  Map<String, dynamic> _taskWorkspace() => {
    'workspace_id': 'act',
    'name': 'ACT',
    'path': '/workspaces/ACT',
    'remote': 'drmhse/ACT',
    'working_strategy': 'worktree',
    'dirty_state': 'clean',
  };

  Map<String, dynamic> _run({required String status, bool withPr = false}) => {
    'id': 'run-public',
    'task_id': 'task-public',
    'status': status,
    'runner_mode': 'demo',
    'execution_mode': 'implement',
    'approval_mode': 'ask_before_edits',
    'artifact_dir': '/artifacts/run-public',
    'queue_position': 0,
    'codex_session_id': 'codex-public',
    'agent_provider': 'codex',
    'provider_model': 'gpt-5.5',
    'final_report': 'Mock mode is ready for Netlify static deployment.',
    'artifacts': [_artifact()],
    'pull_requests': withPr ? [_pullRequest()] : [],
  };

  Map<String, dynamic> _artifact() => {
    'id': 'artifact-report',
    'run_id': 'run-public',
    'artifact_type': 'report',
    'name': 'final-report.md',
    'content_type': 'text/markdown',
    'byte_size': 620,
    'workspace_id': 'act',
    'source_path': 'reports/final-report.md',
    'preview_kind': 'markdown',
    'preview_capabilities': {
      'text': true,
      'markdown': true,
      'raw': true,
      'download': true,
    },
  };

  Map<String, dynamic> _pullRequest() => {
    'id': 'pr-42',
    'repository': 'drmhse/ai-code-terminal',
    'state': 'open',
    'url': 'https://github.com/drmhse/ai-code-terminal/pull/42',
    'action': 'created',
    'workspace_id': 'ai-code-terminal',
    'branch': 'act/public-demo',
    'title': 'Publish ACT mock demo',
  };

  Map<String, dynamic> _launch(Map<String, dynamic> body) {
    final id = 'codex-${_counter++}';
    final summary = _sessionById(
      id,
      title: 'New demo thread',
      prompt: body['prompt']?.toString(),
    );
    _codexSessions.insert(0, summary);
    return {'codex_session': summary, 'terminal_session': _sessions.first};
  }

  Map<String, dynamic> _messageSession(String id, String? prompt) =>
      _sessionById(id, prompt: prompt);

  List<Map<String, dynamic>> _allCodexSessions() => _codexSessions.isEmpty
      ? [
          _sessionById('codex-public'),
          _sessionById('codex-diff', title: 'Review repository changes'),
        ]
      : _codexSessions;

  Map<String, dynamic> _sessionById(
    String id, {
    String? title,
    String? status,
    String? prompt,
  }) => {
    'id': id,
    'title': title ?? 'Prepare ACT public demo',
    'cwd': '/workspaces/ACT',
    'rollout_path': '/mock/rollout.jsonl',
    'source': 'mock',
    'model': 'gpt-5.5',
    'agent_provider': 'codex',
    'provider_model': 'gpt-5.5',
    'updated_at': DateTime.now().toIso8601String(),
    'status': status ?? 'idle',
    'terminal_session_id': 'terminal-act',
    'scope_type': 'workspace',
    'scope_id': 'act',
    'workspace_tags': [
      {'workspace_id': 'act', 'name': 'ACT', 'repository': 'drmhse/ACT'},
    ],
    'usage': {
      'total': {
        'input_tokens': 18420,
        'output_tokens': 3120,
        'total_tokens': 21540,
      },
      'cost_usd': 0.42,
    },
    if (prompt != null) 'queued_message_count': 0,
  };

  List<Map<String, dynamic>> _events(String id) => [
    {
      'index': 0,
      'kind': 'message',
      'role': 'user',
      'text': 'Build a public mock mode that needs no backend.',
      'status': 'submitted',
    },
    {
      'index': 1,
      'kind': 'tool',
      'title': 'Inspect Flutter app',
      'text': 'Found API and socket boundaries.',
      'status': 'completed',
    },
    {
      'index': 2,
      'kind': 'message',
      'role': 'assistant',
      'text':
          'Mock data now drives workspaces, tasks, terminal buffers, diffs, and Codex threads.',
    },
  ];

  Map<String, dynamic> _changes(String id) => {
    'session_id': id,
    'workspace_path': '/workspaces/ACT',
    'git_root': '/workspaces/ACT',
    'branch': 'main',
    'summary': {'changed_files': 4, 'unstaged_files': 4},
    'files': [
      {
        'path': 'frontend/lib/src/services/mock_act_client.dart',
        'status': 'added',
        'staged': ' ',
        'unstaged': 'A',
      },
      {
        'path': 'frontend/lib/src/core/platform_defaults.dart',
        'status': 'modified',
        'staged': ' ',
        'unstaged': 'M',
      },
    ],
    'diff_stat': '2 files changed, 420 insertions(+)',
    'diff':
        'diff --git a/mock_mode.dart b/mock_mode.dart\\n+ACT_MOCK_MODE=true\\n+No backend requests are made.\\n',
    'truncated': false,
  };

  List<Map<String, dynamic>> _repos() => [
    {
      'id': 1,
      'name': 'ACT',
      'full_name': 'drmhse/ACT',
      'description': 'AI Code Terminal app',
      'clone_url': 'https://github.com/drmhse/ACT.git',
      'default_branch': 'main',
      'private': true,
      'permissions': {'pull': true, 'push': true, 'admin': true},
    },
    {
      'id': 2,
      'name': 'ai-code-terminal',
      'full_name': 'drmhse/ai-code-terminal',
      'description': 'Public ACT release repo',
      'clone_url': 'https://github.com/drmhse/ai-code-terminal.git',
      'default_branch': 'main',
      'private': false,
      'permissions': {'pull': true, 'push': true},
    },
  ];

  List<Map<String, dynamic>> _processes() => [
    {
      'id': 'proc-1',
      'name': 'ACT server',
      'pid': 4242,
      'command': 'act-server',
      'working_directory': '/workspaces/ACT/server',
      'workspace_id': 'act',
      'status': 'running',
      'updated_at': DateTime.now().toIso8601String(),
    },
    {
      'id': 'proc-2',
      'name': 'Flutter web demo',
      'pid': 5173,
      'command': 'flutter run -d web-server',
      'working_directory': '/workspaces/ai-code-terminal/frontend',
      'workspace_id': 'ai-code-terminal',
      'status': 'running',
      'updated_at': DateTime.now().toIso8601String(),
    },
  ];
}
