import 'package:act_frontend/src/services/act_api.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('protected API calls allow explicit HTTP self-hosted backends', () async {
    late http.Request captured;
    final api = ActApi(
      baseUrl: 'http://203.0.113.10:3001',
      token: 'token',
      client: MockClient((request) async {
        captured = request;
        return http.Response(
          '{"success":true,"data":{"id":"user-1","email":"user@example.com","name":"User"}}',
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );

    await api.me();

    expect(captured.url.scheme, 'http');
    expect(captured.url.host, '203.0.113.10');
    expect(captured.headers['authorization'], 'Bearer token');
  });

  test('workspace changes and gh status use canonical routes', () async {
    final paths = <String>[];
    final api = ActApi(
      baseUrl: 'https://agent.example.com',
      token: 'token',
      client: MockClient((request) async {
        paths.add(request.url.path);
        if (request.url.path.endsWith('/cli/status')) {
          return http.Response(
            '{"success":true,"data":{"installed":true,"authenticated":true,"version":"gh version 2.0.0","username":"mona","token_source":"GH_TOKEN"}}',
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response(
          '''
          {
            "success": true,
            "data": [{
              "workspace_id": "workspace-1",
              "name": "ACT",
              "local_path": "/tmp/ACT",
              "github_repo": "drmhse/ai-code-terminal",
              "github_url": "https://github.com/drmhse/ai-code-terminal.git",
              "branch": "abc",
              "remote": "origin",
              "is_git_repository": true,
              "is_clean": false,
              "has_uncommitted_changes": true,
              "has_unpushed_changes": true,
              "staged_count": 1,
              "unstaged_count": 2,
              "untracked_count": 3,
              "ahead": 4,
              "behind": 0,
              "status": "dirty_and_unpushed"
            }]
          }
          ''',
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );

    final changes = await api.workspaceGitChanges();
    final cli = await api.githubCliStatus();

    expect(paths, [
      '/api/v1/workspaces/git/changes',
      '/api/v1/github/cli/status',
    ]);
    expect(changes.single.needsAttention, isTrue);
    expect(changes.single.localChangeCount, 6);
    expect(cli.authenticated, isTrue);
    expect(cli.username, 'mona');
  });

  test(
    'native task list and create use canonical no-trailing-slash route',
    () async {
      final paths = <String>[];
      final bodies = <String>[];
      final api = ActApi(
        baseUrl: 'https://agent.example.com',
        token: 'token',
        client: MockClient((request) async {
          paths.add(request.url.path);
          if (request.method == 'GET') {
            return http.Response(
              '{"success":true,"data":[]}',
              200,
              headers: {'content-type': 'application/json'},
            );
          }
          bodies.add(request.body);
          return http.Response(
            '''
          {
            "success": true,
            "data": {
              "id": "task-1",
              "title": "Fix route",
              "description": "Use canonical task path",
              "execution_mode": "implement",
              "approval_mode": "ask_before_edits",
              "evidence_preference": "tests_plus_screenshots",
              "status": "ready",
              "workspaces": [],
              "attachments": [],
              "runs": []
            }
          }
          ''',
            200,
            headers: {'content-type': 'application/json'},
          );
        }),
      );

      await api.nativeTasks();
      await api.createNativeTask(
        title: 'Fix route',
        description: 'Use canonical task path',
        workspaceIds: const ['workspace-1', 'workspace-2'],
      );

      expect(paths, ['/api/v1/tasks', '/api/v1/tasks']);
      expect(
        bodies.single,
        contains('"workspace_ids":["workspace-1","workspace-2"]'),
      );
    },
  );

  test('native task attachment upload uses task-scoped route', () async {
    late http.Request captured;
    final api = ActApi(
      baseUrl: 'https://agent.example.com',
      token: 'token',
      client: MockClient((request) async {
        captured = request;
        return http.Response(
          '''
          {
            "success": true,
            "data": {
              "id": "attachment-1",
              "original_filename": "proof.png",
              "content_type": "image/png",
              "byte_size": 3,
              "checksum_sha256": "abc"
            }
          }
          ''',
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );

    await api.uploadNativeTaskAttachment(
      taskId: 'task-1',
      originalFilename: 'proof.png',
      contentType: 'image/png',
      bytes: const [1, 2, 3],
    );

    expect(captured.method, 'POST');
    expect(captured.url.path, '/api/v1/tasks/task-1/attachments');
    expect(captured.body, contains('"content_base64":"AQID"'));
  });

  test('native task attachment delete uses attachment-scoped route', () async {
    late http.Request captured;
    final api = ActApi(
      baseUrl: 'https://agent.example.com',
      token: 'token',
      client: MockClient((request) async {
        captured = request;
        return http.Response(
          '{"success":true,"data":{"deleted":true}}',
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );

    await api.deleteNativeTaskAttachment(
      taskId: 'task-1',
      attachmentId: 'attachment-1',
    );

    expect(captured.method, 'DELETE');
    expect(captured.url.path, '/api/v1/tasks/task-1/attachments/attachment-1');
    expect(captured.headers['authorization'], 'Bearer token');
  });

  test('native task artifact content includes raw access metadata', () async {
    late http.Request captured;
    final api = ActApi(
      baseUrl: 'https://agent.example.com',
      token: 'token',
      client: MockClient((request) async {
        captured = request;
        return http.Response(
          '''
          {
            "success": true,
            "data": {
              "artifact": {
                "id": "artifact-1",
                "name": "report.pdf",
                "artifact_type": "pdf",
                "byte_size": 42,
                "content_type": "application/pdf",
                "preview_kind": "pdf",
                "preview_capabilities": {
                  "pdf": true,
                  "raw": true,
                  "download": true
                }
              },
              "text": null,
              "base64": "AQID"
            }
          }
          ''',
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );

    final content = await api.nativeTaskRunArtifact(
      taskId: 'task-1',
      runId: 'run-1',
      artifactId: 'artifact-1',
    );

    expect(captured.method, 'GET');
    expect(
      captured.url.path,
      '/api/v1/tasks/task-1/runs/run-1/artifacts/artifact-1',
    );
    expect(
      content.rawUrl?.path,
      '/api/v1/tasks/task-1/runs/run-1/artifacts/artifact-1/raw',
    );
    expect(content.authHeaders['authorization'], 'Bearer token');
    expect(content.artifact.previewCapabilities.pdf, isTrue);
  });

  test('native task update uses task-scoped PUT route', () async {
    late http.Request captured;
    final api = ActApi(
      baseUrl: 'https://agent.example.com',
      token: 'token',
      client: MockClient((request) async {
        captured = request;
        return http.Response(
          '''
          {
            "success": true,
            "data": {
              "id": "task-1",
              "title": "Updated",
              "description": "Updated description",
              "execution_mode": "implement",
              "approval_mode": "ask_before_edits",
              "evidence_preference": "tests_plus_screenshots",
              "status": "ready",
              "workspaces": [],
              "attachments": [],
              "runs": []
            }
          }
          ''',
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );

    await api.updateNativeTask(
      taskId: 'task-1',
      title: 'Updated',
      description: 'Updated description',
      workspaceIds: const ['workspace-1', 'workspace-2'],
    );

    expect(captured.method, 'PUT');
    expect(captured.url.path, '/api/v1/tasks/task-1');
    expect(
      captured.body,
      contains('"workspace_ids":["workspace-1","workspace-2"]'),
    );
  });

  test('native task list can be scoped by collection or workspace', () async {
    final paths = <String>[];
    final api = ActApi(
      baseUrl: 'https://agent.example.com',
      token: 'token',
      client: MockClient((request) async {
        paths.add(request.url.toString());
        return http.Response(
          '{"data":[]}',
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );

    await api.nativeTasks(workspaceId: 'workspace-1');
    await api.nativeTasks(scopeType: 'collection', scopeId: 'collection-1');

    expect(paths, [
      'https://agent.example.com/api/v1/tasks?workspace_id=workspace-1',
      'https://agent.example.com/api/v1/tasks?scope_type=collection&scope_id=collection-1',
    ]);
  });

  test('agent provider is sent for Pi chats and task runs', () async {
    final bodies = <String>[];
    final api = ActApi(
      baseUrl: 'https://agent.example.com',
      token: 'token',
      client: MockClient((request) async {
        bodies.add(request.body);
        if (request.url.path.endsWith('/runs')) {
          return http.Response(
            '''
            {"success":true,"data":{
              "id":"run-1","task_id":"task-1","status":"starting",
              "runner_mode":"local_single_user","execution_mode":"implement",
              "approval_mode":"ask_before_edits","artifact_dir":"/tmp",
              "queue_position":0,"agent_provider":"pi"
            }}
            ''',
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response(
          '''
          {"success":true,"data":{"codex_session":{
            "id":"pi:session-1","title":"Hello","rollout_path":"",
            "updated_at":"2026-05-12T00:00:00Z","status":"running",
            "agent_provider":"pi"
          }}}
          ''',
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );

    await api.launchCodexSession(
      workspaceId: 'workspace-1',
      prompt: 'Hello',
      agentProvider: 'pi',
    );
    await api.startNativeTaskRun('task-1', agentProvider: 'pi');

    expect(bodies.first, contains('"agent_provider":"pi"'));
    expect(bodies.last, contains('"agent_provider":"pi"'));
  });

  test(
    'task creation stores agent defaults and runs can use task agent',
    () async {
      final bodies = <String>[];
      final api = ActApi(
        baseUrl: 'https://agent.example.com',
        token: 'token',
        client: MockClient((request) async {
          bodies.add(request.body);
          if (request.method == 'POST' && request.url.path.endsWith('/runs')) {
            return http.Response(
              '''
            {"success":true,"data":{
              "id":"run-1","task_id":"task-1","status":"starting",
              "runner_mode":"local_single_user","execution_mode":"implement",
              "approval_mode":"ask_before_edits","artifact_dir":"/tmp",
              "queue_position":0,"agent_provider":"pi"
            }}
            ''',
              200,
              headers: {'content-type': 'application/json'},
            );
          }
          return http.Response(
            '''
          {"success": true, "data": {
            "id": "task-1",
            "title": "Fix route",
            "description": "Use canonical task path",
            "execution_mode": "implement",
            "approval_mode": "ask_before_edits",
            "evidence_preference": "tests_plus_screenshots",
            "agent_provider": "pi",
            "provider_model": "gpt-5.5",
            "provider_thinking_level": "off",
            "status": "ready",
            "workspaces": [],
            "attachments": [],
            "runs": []
          }}
          ''',
            200,
            headers: {'content-type': 'application/json'},
          );
        }),
      );

      await api.createNativeTask(
        title: 'Fix route',
        description: 'Use canonical task path',
        workspaceIds: const ['workspace-1'],
        agentProvider: 'pi',
        providerModel: 'gpt-5.5',
        providerThinkingLevel: 'off',
      );
      await api.startNativeTaskRun('task-1');

      expect(bodies.first, contains('"agent_provider":"pi"'));
      expect(bodies.first, contains('"provider_model":"gpt-5.5"'));
      expect(bodies.first, contains('"provider_thinking_level":"off"'));
      expect(bodies.last, isNot(contains('"agent_provider"')));
    },
  );
}
