import 'dart:async';

import 'package:act_frontend/src/services/terminal_socket_client.dart';

class MockTerminalSocketClient extends TerminalSocketClient {
  MockTerminalSocketClient()
    : super(baseUrl: 'https://mock.act.local', token: 'mock');

  final _connections = StreamController<bool>.broadcast();
  final _errors = StreamController<TerminalError>.broadcast();
  final _output = StreamController<TerminalOutput>.broadcast();
  final _created = StreamController<TerminalCreated>.broadcast();
  final _executionStarted = StreamController<TaskExecutionStarted>.broadcast();
  final _executionOutput = StreamController<TaskExecutionOutput>.broadcast();
  final _executionStatus =
      StreamController<TaskExecutionStatusUpdate>.broadcast();
  bool _connected = false;

  @override
  Stream<bool> get connectionChanges => _connections.stream;

  @override
  Stream<TerminalError> get errors => _errors.stream;

  @override
  Stream<TerminalOutput> get terminalOutput => _output.stream;

  @override
  Stream<TerminalCreated> get terminalCreated => _created.stream;

  @override
  Stream<TaskExecutionStarted> get executionStarted => _executionStarted.stream;

  @override
  Stream<TaskExecutionOutput> get executionOutput => _executionOutput.stream;

  @override
  Stream<TaskExecutionStatusUpdate> get executionStatus =>
      _executionStatus.stream;

  @override
  bool get isConnected => _connected;

  @override
  void connect() {
    if (_connected) {
      return;
    }
    _connected = true;
    scheduleMicrotask(() => _connections.add(true));
  }

  @override
  void createTerminal({
    required String workspaceId,
    required String sessionId,
    required String paneId,
    required int cols,
    required int rows,
  }) {
    _created.add(TerminalCreated(sessionId: sessionId, isNewSession: false));
  }

  @override
  bool sendTerminalData({required String sessionId, required String data}) {
    if (!_connected) {
      return false;
    }
    if (data.trim().isEmpty) {
      return true;
    }
    final command = data.replaceAll('\r', '').replaceAll('\n', '');
    _output.add(
      TerminalOutput(sessionId: sessionId, output: '\r\n\$ $command\r\n'),
    );
    _output.add(
      TerminalOutput(
        sessionId: sessionId,
        output: 'Demo terminal is read-only; commands are echoed locally.\r\n',
      ),
    );
    return true;
  }

  @override
  bool resizeTerminal({
    required String sessionId,
    required int cols,
    required int rows,
  }) {
    return _connected;
  }

  @override
  void terminateTerminal(String sessionId) {}

  @override
  void startTaskExecution({
    required String taskId,
    required String workspaceId,
    String permissionMode = 'acceptEdits',
    int? timeoutSeconds,
  }) {
    _executionStarted.add(
      TaskExecutionStarted(
        executionId: 'demo-run',
        taskId: taskId,
        status: 'running',
      ),
    );
    _executionStatus.add(
      const TaskExecutionStatusUpdate(
        executionId: 'demo-run',
        status: 'completed',
        exitCode: 0,
        durationMs: 4200,
      ),
    );
  }

  @override
  void dispose() {
    _connected = false;
    _connections.close();
    _errors.close();
    _output.close();
    _created.close();
    _executionStarted.close();
    _executionOutput.close();
    _executionStatus.close();
  }
}
