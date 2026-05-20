import 'dart:async';

import 'package:socket_io_client/socket_io_client.dart' as io;

class TerminalOutput {
  const TerminalOutput({required this.sessionId, required this.output});

  final String sessionId;
  final String output;
}

class TerminalError {
  const TerminalError({this.sessionId, required this.message});

  final String? sessionId;
  final String message;

  bool get isSessionNotFound {
    final lower = message.toLowerCase();
    return sessionId != null && lower.contains('not found');
  }
}

class TerminalCreated {
  const TerminalCreated({
    required this.sessionId,
    required this.isNewSession,
    this.pid,
  });

  final String sessionId;
  final bool isNewSession;
  final int? pid;
}

class TaskExecutionStarted {
  const TaskExecutionStarted({
    required this.executionId,
    required this.taskId,
    required this.status,
  });

  final String executionId;
  final String taskId;
  final String status;
}

class TaskExecutionOutput {
  const TaskExecutionOutput({required this.executionId, required this.output});

  final String executionId;
  final String output;
}

class TaskExecutionStatusUpdate {
  const TaskExecutionStatusUpdate({
    required this.executionId,
    required this.status,
    this.exitCode,
    this.durationMs,
  });

  final String executionId;
  final String status;
  final int? exitCode;
  final int? durationMs;
}

class TerminalSocketClient {
  TerminalSocketClient({required this.baseUrl, required this.token});

  final String baseUrl;
  final String token;

  io.Socket? _socket;
  bool _authenticated = false;

  final _connectionController = StreamController<bool>.broadcast();
  final _errorController = StreamController<TerminalError>.broadcast();
  final _terminalOutputController =
      StreamController<TerminalOutput>.broadcast();
  final _terminalCreatedController =
      StreamController<TerminalCreated>.broadcast();
  final _executionStartedController =
      StreamController<TaskExecutionStarted>.broadcast();
  final _executionOutputController =
      StreamController<TaskExecutionOutput>.broadcast();
  final _executionStatusController =
      StreamController<TaskExecutionStatusUpdate>.broadcast();

  Stream<bool> get connectionChanges => _connectionController.stream;
  Stream<TerminalError> get errors => _errorController.stream;
  Stream<TerminalOutput> get terminalOutput => _terminalOutputController.stream;
  Stream<TerminalCreated> get terminalCreated =>
      _terminalCreatedController.stream;
  Stream<TaskExecutionStarted> get executionStarted =>
      _executionStartedController.stream;
  Stream<TaskExecutionOutput> get executionOutput =>
      _executionOutputController.stream;
  Stream<TaskExecutionStatusUpdate> get executionStatus =>
      _executionStatusController.stream;

  bool get isConnected => _socket?.connected == true && _authenticated;

  void connect() {
    if (_socket != null) {
      return;
    }

    final socket = io.io(
      baseUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setPath('/socket.io/')
          .disableAutoConnect()
          .enableForceNew()
          .enableReconnection()
          .setTimeout(12000)
          .build(),
    );
    _socket = socket;

    socket.onConnect((_) {
      socket.emit('authenticate', {'token': token});
    });
    socket.onDisconnect((_) {
      _authenticated = false;
      _connectionController.add(false);
    });
    socket.onConnectError((error) {
      _errorController.add(
        TerminalError(message: 'Socket connection failed: $error'),
      );
    });
    socket.on('authenticated', (_) {
      _authenticated = true;
      _connectionController.add(true);
    });
    socket.on('auth_error', (data) {
      _authenticated = false;
      _connectionController.add(false);
      _errorController.add(
        TerminalError(
          message: _readError(data, fallback: 'Socket authentication failed'),
        ),
      );
    });
    socket.on('terminal:error', (data) {
      _errorController.add(_readTerminalError(data));
    });
    socket.on('terminal-error', (data) {
      _errorController.add(_readTerminalError(data));
    });
    socket.on('terminal:output', (data) {
      final json = _asMap(data);
      final sessionId = json['sessionId']?.toString();
      final output = json['output']?.toString();
      if (sessionId != null && output != null) {
        _terminalOutputController.add(
          TerminalOutput(sessionId: sessionId, output: output),
        );
      }
    });
    socket.on('terminal:created', (data) {
      final json = _asMap(data);
      final sessionId = json['sessionId']?.toString();
      if (sessionId != null) {
        _terminalCreatedController.add(
          TerminalCreated(
            sessionId: sessionId,
            isNewSession: json['isNewSession'] == true,
            pid: json['pid'] is num ? (json['pid'] as num).toInt() : null,
          ),
        );
      }
    });
    socket.on('task:execution:started', (data) {
      final json = _asMap(data);
      final executionId = json['executionId']?.toString();
      final taskId = json['taskId']?.toString();
      if (executionId != null && taskId != null) {
        _executionStartedController.add(
          TaskExecutionStarted(
            executionId: executionId,
            taskId: taskId,
            status: json['status']?.toString() ?? 'running',
          ),
        );
      }
    });
    socket.on('task:execution:output', (data) {
      final json = _asMap(data);
      final executionId = json['executionId']?.toString();
      final output = json['output']?.toString();
      if (executionId != null && output != null) {
        _executionOutputController.add(
          TaskExecutionOutput(executionId: executionId, output: output),
        );
      }
    });
    socket.on('task:execution:status', (data) {
      final json = _asMap(data);
      final executionId = json['executionId']?.toString();
      if (executionId != null) {
        _executionStatusController.add(
          TaskExecutionStatusUpdate(
            executionId: executionId,
            status: json['status']?.toString() ?? 'unknown',
            exitCode: json['exitCode'] is num
                ? (json['exitCode'] as num).toInt()
                : null,
            durationMs: json['durationMs'] is num
                ? (json['durationMs'] as num).toInt()
                : null,
          ),
        );
      }
    });
    socket.on('task:execution:error', (data) {
      _errorController.add(
        TerminalError(
          message: _readError(data, fallback: 'Task execution failed'),
        ),
      );
    });
    socket.on('task:execution:warning', (data) {
      _errorController.add(
        TerminalError(
          message: _readError(data, fallback: 'Task execution warning'),
        ),
      );
    });

    socket.connect();
  }

  void createTerminal({
    required String workspaceId,
    required String sessionId,
    required String paneId,
    required int cols,
    required int rows,
  }) {
    final socket = _socket;
    if (socket == null || !isConnected) {
      return;
    }
    socket.emit('terminal:create', {
      'workspaceId': workspaceId,
      'sessionId': sessionId,
      'paneId': paneId,
      'cols': cols,
      'rows': rows,
    });
  }

  bool sendTerminalData({required String sessionId, required String data}) {
    final socket = _socket;
    if (socket == null || !isConnected) {
      return false;
    }

    socket.emit('terminal:data', {'sessionId': sessionId, 'data': data});
    return true;
  }

  bool resizeTerminal({
    required String sessionId,
    required int cols,
    required int rows,
  }) {
    final socket = _socket;
    if (socket == null || !isConnected) {
      return false;
    }
    socket.emit('terminal:resize', {
      'sessionId': sessionId,
      'cols': cols,
      'rows': rows,
    });
    return true;
  }

  void terminateTerminal(String sessionId) {
    final socket = _socket;
    if (socket == null || !isConnected) {
      return;
    }
    socket.emit('terminal:terminate', {'sessionId': sessionId, 'data': ''});
  }

  void startTaskExecution({
    required String taskId,
    required String workspaceId,
    String permissionMode = 'acceptEdits',
    int? timeoutSeconds,
  }) {
    final payload = <String, dynamic>{
      'taskId': taskId,
      'workspaceId': workspaceId,
      'permissionMode': permissionMode,
    };
    if (timeoutSeconds != null) {
      payload['timeoutSeconds'] = timeoutSeconds;
    }
    _socket?.emit('task:execution:start', payload);
  }

  void dispose() {
    _socket?.dispose();
    _socket = null;
    _connectionController.close();
    _errorController.close();
    _terminalOutputController.close();
    _terminalCreatedController.close();
    _executionStartedController.close();
    _executionOutputController.close();
    _executionStatusController.close();
  }

  Map<String, dynamic> _asMap(Object? data) {
    if (data is Map<String, dynamic>) {
      return data;
    }
    if (data is Map) {
      return data.map((key, value) => MapEntry(key.toString(), value));
    }
    return const {};
  }

  String _readError(Object? data, {required String fallback}) {
    final json = _asMap(data);
    return json['error']?.toString() ?? json['message']?.toString() ?? fallback;
  }

  TerminalError _readTerminalError(Object? data) {
    final json = _asMap(data);
    final message = _readError(data, fallback: 'Terminal error');
    return TerminalError(
      sessionId:
          json['sessionId']?.toString() ?? _sessionIdFromMessage(message),
      message: message,
    );
  }

  String? _sessionIdFromMessage(String message) {
    return RegExp(
      r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
    ).firstMatch(message)?.group(0);
  }
}
