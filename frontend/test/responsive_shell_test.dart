import 'package:act_frontend/src/app/act_app.dart';
import 'package:act_frontend/src/features/home/widgets/codex_session_panel.dart';
import 'package:act_frontend/src/features/home/widgets/app_top_bar.dart';
import 'package:act_frontend/src/features/home/widgets/editor_preview.dart';
import 'package:act_frontend/src/features/home/widgets/github_clone_dialog.dart';
import 'package:act_frontend/src/features/home/widgets/mobile_action_dock.dart';
import 'package:act_frontend/src/features/home/widgets/sidebar_panel.dart';
import 'package:act_frontend/src/features/home/widgets/status_bar.dart';
import 'package:act_frontend/src/features/home/widgets/task_panel.dart';
import 'package:act_frontend/src/features/home/widgets/terminal_workspace.dart';
import 'package:act_frontend/src/models/file_content.dart';
import 'package:act_frontend/src/models/file_item.dart';
import 'package:act_frontend/src/models/github.dart';
import 'package:act_frontend/src/models/health_status.dart';
import 'package:act_frontend/src/models/codex_session.dart';
import 'package:act_frontend/src/models/native_task.dart';
import 'package:act_frontend/src/models/system_stats.dart';
import 'package:act_frontend/src/models/terminal_session.dart';
import 'package:act_frontend/src/models/user_profile.dart';
import 'package:act_frontend/src/models/workspace.dart';
import 'package:act_frontend/src/models/workspace_collection.dart';
import 'package:act_frontend/src/services/terminal_socket_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:xterm/xterm.dart';

void main() {
  for (final size in [
    const Size(390, 844),
    const Size(820, 1180),
    const Size(1440, 900),
  ]) {
    testWidgets('shell fits ${size.width.toInt()}x${size.height.toInt()}', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(size);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MaterialApp(
          theme: const ActApp().themeForTesting(),
          home: Scaffold(body: _ShellFixture(compact: size.width < 760)),
        ),
      );

      expect(find.text('ACT'), findsOneWidget);
      expect(find.text('AI Terminal'), findsWidgets);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('mobile terminal exposes command controls and composer', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: const MediaQuery(
          data: MediaQueryData(size: Size(390, 844)),
          child: Scaffold(body: _ShellFixture(compact: true)),
        ),
      ),
    );

    expect(_commandComposerButton(), findsOneWidget);
    expect(find.byTooltip('Esc'), findsOneWidget);
    expect(find.byTooltip('Ctrl+C'), findsOneWidget);
    expect(find.byTooltip('Backspace'), findsOneWidget);
    expect(find.byTooltip('Ctrl+D'), findsOneWidget);
    expect(find.byTooltip('Ctrl+L'), findsOneWidget);
    expect(find.byTooltip('Hide keyboard'), findsOneWidget);
    expect(find.byTooltip('Tab'), findsOneWidget);
    expect(find.byTooltip('Enter'), findsOneWidget);
    expect(find.text('Cmd'), findsNothing);
    expect(find.text('BS'), findsOneWidget);
    expect(find.text('Terminal socket offline'), findsOneWidget);

    await tester.tap(_commandComposerButton());
    await tester.pumpAndSettle();

    expect(find.text('codex'), findsOneWidget);
    expect(find.text('claude'), findsOneWidget);
    expect(find.text('git status'), findsOneWidget);
    expect(find.text('ls -la'), findsOneWidget);
    expect(
      find.text(
        'Compose on the full keyboard, then send one clean command into the active terminal.',
      ),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile terminal renders one command bar for multiple panes', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final workspace = _workspace();
    var controlsExpanded = true;
    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: MediaQuery(
          data: const MediaQueryData(size: Size(390, 844)),
          child: StatefulBuilder(
            builder: (context, setState) {
              return Scaffold(
                body: TerminalWorkspace(
                  workspace: workspace,
                  sessions: [
                    _session(),
                    const TerminalSession(
                      id: 'session-2',
                      sessionName: 'Agent',
                      status: 'active',
                      workspaceId: 'workspace-1',
                    ),
                  ],
                  buffers: const {'session-1': r'$ cargo check --workspace'},
                  controlsExpanded: controlsExpanded,
                  onControlsExpandedChanged: (expanded) {
                    setState(() => controlsExpanded = expanded);
                  },
                  onCreateSession: () {},
                  onTerminateSession: (_) {},
                  onSessionUnavailable: (_) {},
                  onSaveLayout: () {},
                ),
              );
            },
          ),
        ),
      ),
    );

    expect(find.text('Terminal'), findsWidgets);
    expect(find.text('Agent'), findsNothing);
    expect(find.text('Terminal socket offline'), findsOneWidget);
    expect(find.text('Active: Terminal'), findsWidgets);
    expect(_commandComposerButton(), findsOneWidget);
    expect(find.byTooltip('Ctrl+C'), findsOneWidget);
    expect(find.byTooltip('Backspace'), findsOneWidget);
    expect(find.byTooltip('Hide keyboard'), findsOneWidget);

    await _tapSecondMobilePane(tester);

    expect(find.text('Agent'), findsOneWidget);
    expect(find.text('Active: Agent'), findsWidgets);
    expect(_commandComposerButton(), findsOneWidget);
    expect(find.byTooltip('Ctrl+C'), findsOneWidget);
    expect(find.byTooltip('Hide keyboard'), findsOneWidget);
    expect(find.byTooltip('Hide terminal input'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile terminal scroll hides native keyboard', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: MediaQuery(
          data: const MediaQueryData(size: Size(390, 844)),
          child: Scaffold(
            body: TerminalWorkspace(
              workspace: _workspace(),
              sessions: const [
                TerminalSession(
                  id: 'session-1',
                  sessionName: 'Shell',
                  status: 'active',
                  workspaceId: 'workspace-1',
                ),
              ],
              buffers: const {'session-1': 'line 1\nline 2\nline 3'},
              controlsExpanded: true,
              onControlsExpandedChanged: (_) {},
              onCreateSession: () {},
              onTerminateSession: (_) {},
              onSessionUnavailable: (_) {},
              onSaveLayout: () {},
            ),
          ),
        ),
      ),
    );

    expect(find.text('Terminal socket offline'), findsOneWidget);
    expect(find.byTooltip('Hide keyboard'), findsOneWidget);
    final terminalInput = find.byKey(
      const ValueKey('terminal-input-session-1'),
    );
    await tester.showKeyboard(terminalInput);
    expect(tester.testTextInput.isVisible, isTrue);

    await tester.drag(
      find.byKey(const ValueKey('terminal-view-session-1')),
      const Offset(0, -72),
    );
    await tester.pumpAndSettle();

    expect(find.text('Terminal socket offline'), findsOneWidget);
    expect(tester.testTextInput.isVisible, isFalse);
    expect(find.byTooltip('Hide keyboard'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile command row targets active pane backspace and close', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final socket = _RecordingTerminalSocketClient();
    var terminatedSessionId = '';

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: MediaQuery(
          data: const MediaQueryData(size: Size(390, 844)),
          child: Scaffold(
            body: TerminalWorkspace(
              workspace: _workspace(),
              sessions: const [
                TerminalSession(
                  id: 'session-1',
                  sessionName: 'Shell',
                  status: 'active',
                  workspaceId: 'workspace-1',
                ),
                TerminalSession(
                  id: 'session-2',
                  sessionName: 'Agent',
                  status: 'active',
                  workspaceId: 'workspace-1',
                ),
              ],
              buffers: const {},
              socketClient: socket,
              controlsExpanded: true,
              onControlsExpandedChanged: (_) {},
              onCreateSession: () {},
              onTerminateSession: (session) {
                terminatedSessionId = session.id;
              },
              onSessionUnavailable: (_) {},
              onSaveLayout: () {},
            ),
          ),
        ),
      ),
    );

    await _tapSecondMobilePane(tester);

    await tester.tap(find.byTooltip('Backspace'));
    await tester.tap(find.byTooltip('Up'));
    await tester.tap(find.byTooltip('Down'));
    await tester.tap(find.byTooltip('Left'));
    await tester.tap(find.byTooltip('Right'));
    await tester.pump();

    expect(socket.sentData.map((event) => event.sessionId).toSet(), {
      'session-2',
    });
    expect(socket.sentData.map((event) => event.data), [
      '\x7f',
      '\x1b[A',
      '\x1b[B',
      '\x1b[D',
      '\x1b[C',
    ]);

    final closeButtons = find.byTooltip('Close terminal');
    expect(closeButtons, findsOneWidget);
    await tester.tap(closeButtons.first);
    await tester.pump();

    expect(terminatedSessionId, 'session-2');
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile terminal deck spans workspaces and can focus a pane', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final socket = _RecordingTerminalSocketClient();
    final workspace = _workspace();
    var focusMode = false;
    late StateSetter updateFocusMode;
    final otherWorkspace = _workspace(
      id: 'workspace-2',
      name: 'Server',
      localPath: '/Users/dev/projects/server',
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: MediaQuery(
          data: const MediaQueryData(size: Size(390, 844)),
          child: StatefulBuilder(
            builder: (context, setState) {
              updateFocusMode = setState;
              return Scaffold(
                body: TerminalWorkspace(
                  workspace: workspace,
                  workspaces: [workspace, otherWorkspace],
                  sessions: const [
                    TerminalSession(
                      id: 'session-1',
                      sessionName: 'Shell',
                      status: 'active',
                      workspaceId: 'workspace-1',
                    ),
                    TerminalSession(
                      id: 'session-2',
                      sessionName: 'Server shell',
                      status: 'active',
                      workspaceId: 'workspace-2',
                    ),
                  ],
                  buffers: const {},
                  socketClient: socket,
                  controlsExpanded: true,
                  onControlsExpandedChanged: (_) {},
                  focusMode: focusMode,
                  onCreateSession: () {},
                  onTerminateSession: (_) {},
                  onSessionUnavailable: (_) {},
                  onSaveLayout: () {},
                ),
              );
            },
          ),
        ),
      ),
    );

    expect(socket.createdWorkspacesBySession['session-1'], 'workspace-1');
    expect(socket.createdWorkspacesBySession['session-2'], 'workspace-2');
    expect(find.text('Shell'), findsWidgets);
    expect(find.text('Server shell'), findsNothing);

    await _tapSecondMobilePane(tester);
    expect(find.text('Server shell'), findsOneWidget);
    await tester.tap(find.byTooltip('Backspace'));
    await tester.pump();

    expect(socket.sentData.single.sessionId, 'session-2');
    expect(socket.sentData.single.data, '\x7f');

    socket.resizeCalls.clear();
    updateFocusMode(() => focusMode = true);
    await tester.pumpAndSettle();
    expect(find.byTooltip('Close terminal'), findsOneWidget);
    expect(find.text('Server shell'), findsOneWidget);
    final focusedResize = socket.resizeCalls.lastWhere(
      (call) => call.sessionId == 'session-2',
    );

    socket.resizeCalls.clear();
    updateFocusMode(() => focusMode = false);
    await tester.pumpAndSettle();
    expect(find.byTooltip('Close terminal'), findsOneWidget);
    final gridResize = socket.resizeCalls.lastWhere(
      (call) => call.sessionId == 'session-2',
    );
    expect(gridResize.cols, lessThan(focusedResize.cols));
    expect(gridResize.rows, lessThan(focusedResize.rows));
    expect(
      socket.createdSessionIds.where((sessionId) => sessionId == 'session-2'),
      hasLength(1),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile terminal reflows focused output when returning to grid', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final socket = _RecordingTerminalSocketClient();
    final workspace = _workspace();
    var focusMode = true;
    late StateSetter updateFocusMode;

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: MediaQuery(
          data: const MediaQueryData(size: Size(390, 844)),
          child: StatefulBuilder(
            builder: (context, setState) {
              updateFocusMode = setState;
              return Scaffold(
                body: TerminalWorkspace(
                  workspace: workspace,
                  workspaces: [workspace],
                  sessions: const [
                    TerminalSession(
                      id: 'session-1',
                      sessionName: 'Shell',
                      status: 'active',
                      workspaceId: 'workspace-1',
                    ),
                    TerminalSession(
                      id: 'session-2',
                      sessionName: 'Agent',
                      status: 'active',
                      workspaceId: 'workspace-1',
                    ),
                  ],
                  buffers: const {},
                  socketClient: socket,
                  controlsExpanded: false,
                  onControlsExpandedChanged: (_) {},
                  focusMode: focusMode,
                  onCreateSession: () {},
                  onTerminateSession: (_) {},
                  onSessionUnavailable: (_) {},
                  onSaveLayout: () {},
                ),
              );
            },
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final focusedView = tester.widget<TerminalView>(
      find.byKey(const ValueKey('terminal-view-session-1')),
    );
    final terminal = focusedView.terminal;
    final focusedWidth = terminal.viewWidth;
    expect(focusedWidth, greaterThan(20));

    final targetLength = focusedWidth - 2;
    final lineBuffer = StringBuffer();
    while (lineBuffer.length < targetLength) {
      lineBuffer.write('-rw-rw-r-- 1 ubuntu ubuntu dark_mode.png ');
    }
    final focusedLine = lineBuffer.toString().substring(0, targetLength);

    terminal.write('\x1b[2J\x1b[H$focusedLine');
    expect(terminal.buffer.lines[1].toString().trim(), isEmpty);

    updateFocusMode(() => focusMode = false);
    await tester.pumpAndSettle();

    final gridView = tester.widget<TerminalView>(
      find.byKey(const ValueKey('terminal-view-session-1')),
    );
    expect(identical(gridView.terminal, terminal), isTrue);
    expect(terminal.viewWidth, lessThan(focusedWidth));
    expect(focusedLine.length, greaterThan(terminal.viewWidth));
    expect(terminal.buffer.lines[1].toString().trim(), isNotEmpty);
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile terminal mosaic uses foreground separators', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: MediaQuery(
          data: const MediaQueryData(size: Size(390, 844)),
          child: Scaffold(
            body: TerminalWorkspace(
              workspace: _workspace(),
              sessions: const [
                TerminalSession(
                  id: 'session-1',
                  sessionName: 'Shell',
                  status: 'active',
                  workspaceId: 'workspace-1',
                ),
                TerminalSession(
                  id: 'session-2',
                  sessionName: 'Agent',
                  status: 'active',
                  workspaceId: 'workspace-1',
                ),
                TerminalSession(
                  id: 'session-3',
                  sessionName: 'Logs',
                  status: 'active',
                  workspaceId: 'workspace-1',
                ),
              ],
              buffers: const {},
              controlsExpanded: false,
              onControlsExpandedChanged: (_) {},
              onCreateSession: () {},
              onTerminateSession: (_) {},
              onSessionUnavailable: (_) {},
              onSaveLayout: () {},
            ),
          ),
        ),
      ),
    );

    final cell = tester.widget<DecoratedBox>(
      find.byKey(const ValueKey('terminal-grid-cell-session-1')),
    );
    final decoration = cell.decoration as BoxDecoration;
    final border = decoration.border! as Border;
    final terminalView = tester.widget<TerminalView>(
      find.byType(TerminalView).first,
    );

    expect(cell.position, DecorationPosition.foreground);
    expect(border.right.style, BorderStyle.solid);
    expect(border.bottom.style, BorderStyle.solid);
    expect(terminalView.terminal.reflowEnabled, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('closing a pane preserves the surviving terminal attachment', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final socket = _RecordingTerminalSocketClient();
    var sessions = const [
      TerminalSession(
        id: 'session-1',
        sessionName: 'Shell',
        status: 'active',
        workspaceId: 'workspace-1',
      ),
      TerminalSession(
        id: 'session-2',
        sessionName: 'Agent',
        status: 'active',
        workspaceId: 'workspace-1',
      ),
    ];

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: MediaQuery(
          data: const MediaQueryData(size: Size(390, 844)),
          child: StatefulBuilder(
            builder: (context, setState) {
              return Scaffold(
                body: TerminalWorkspace(
                  workspace: _workspace(),
                  sessions: sessions,
                  buffers: const {
                    'session-1': 'shell buffer',
                    'session-2': 'agent buffer',
                  },
                  socketClient: socket,
                  controlsExpanded: true,
                  onControlsExpandedChanged: (_) {},
                  onCreateSession: () {},
                  onTerminateSession: (session) {
                    setState(() {
                      sessions = sessions
                          .where((candidate) => candidate.id != session.id)
                          .toList(growable: false);
                    });
                  },
                  onSessionUnavailable: (_) {},
                  onSaveLayout: () {},
                ),
              );
            },
          ),
        ),
      ),
    );

    expect(socket.createdSessionIds, containsAll(['session-1', 'session-2']));

    await _tapSecondMobilePane(tester);
    await tester.tap(find.byTooltip('Close terminal').last);
    await tester.pump();

    expect(sessions.map((session) => session.id), ['session-1']);
    expect(
      socket.createdSessionIds.where((sessionId) => sessionId == 'session-1'),
      hasLength(1),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile line input icon opens the command composer', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: MediaQuery(
          data: const MediaQueryData(size: Size(390, 844)),
          child: Scaffold(
            body: TerminalWorkspace(
              workspace: _workspace(),
              sessions: const [
                TerminalSession(
                  id: 'session-1',
                  sessionName: 'Shell',
                  status: 'active',
                  workspaceId: 'workspace-1',
                ),
              ],
              buffers: const {},
              socketClient: _RecordingTerminalSocketClient(),
              controlsExpanded: true,
              onControlsExpandedChanged: (_) {},
              onCreateSession: () {},
              onTerminateSession: (_) {},
              onSessionUnavailable: (_) {},
              onSaveLayout: () {},
            ),
          ),
        ),
      ),
    );

    await tester.tap(_commandComposerButton());
    await tester.pumpAndSettle();

    expect(find.text('codex'), findsOneWidget);
    expect(find.text('git status'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile Apple keyboard input sends text and delete to terminal', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final socket = _RecordingTerminalSocketClient();

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: MediaQuery(
          data: const MediaQueryData(size: Size(390, 844)),
          child: Scaffold(
            body: TerminalWorkspace(
              workspace: _workspace(),
              sessions: const [
                TerminalSession(
                  id: 'session-1',
                  sessionName: 'Shell',
                  status: 'active',
                  workspaceId: 'workspace-1',
                ),
              ],
              buffers: const {},
              socketClient: socket,
              controlsExpanded: true,
              onControlsExpandedChanged: (_) {},
              onCreateSession: () {},
              onTerminateSession: (_) {},
              onSessionUnavailable: (_) {},
              onSaveLayout: () {},
            ),
          ),
        ),
      ),
    );

    final terminalInput = find.byKey(
      const ValueKey('terminal-input-session-1'),
    );
    await tester.showKeyboard(terminalInput);
    final input = tester.widget<TextField>(terminalInput);
    expect(input.keyboardType, TextInputType.multiline);
    expect(input.textInputAction, TextInputAction.newline);

    tester.testTextInput.updateEditingValue(
      const TextEditingValue(
        text: ' c',
        selection: TextSelection.collapsed(offset: 2),
      ),
    );
    await tester.pump();
    tester.testTextInput.updateEditingValue(
      const TextEditingValue(
        text: ' \n',
        selection: TextSelection.collapsed(offset: 2),
      ),
    );
    await tester.pump();
    tester.testTextInput.updateEditingValue(
      const TextEditingValue(
        text: '',
        selection: TextSelection.collapsed(offset: 0),
      ),
    );
    await tester.pump();

    expect(socket.sentData.map((event) => event.data), ['c', '\r', '\x7f']);
    expect(
      socket.sentData.every((event) => event.sessionId == 'session-1'),
      isTrue,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile terminal keyboard can hide and reopen from pane taps', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: MediaQuery(
          data: const MediaQueryData(size: Size(390, 844)),
          child: Scaffold(
            body: TerminalWorkspace(
              workspace: _workspace(),
              sessions: const [
                TerminalSession(
                  id: 'session-1',
                  sessionName: 'Shell',
                  status: 'active',
                  workspaceId: 'workspace-1',
                ),
              ],
              buffers: const {},
              socketClient: _RecordingTerminalSocketClient(),
              controlsExpanded: true,
              onControlsExpandedChanged: (_) {},
              onCreateSession: () {},
              onTerminateSession: (_) {},
              onSessionUnavailable: (_) {},
              onSaveLayout: () {},
            ),
          ),
        ),
      ),
    );

    final terminalInput = find.byKey(
      const ValueKey('terminal-input-session-1'),
    );
    await tester.showKeyboard(terminalInput);
    expect(tester.testTextInput.isVisible, isTrue);

    await tester.tap(find.byTooltip('Hide keyboard'));
    await tester.pump();
    expect(tester.testTextInput.isVisible, isFalse);

    await tester.tap(find.byKey(const ValueKey('terminal-view-session-1')));
    await tester.pump();
    expect(tester.testTextInput.isVisible, isTrue);
    await tester.pump(const Duration(milliseconds: 350));
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile terminal pane tap keeps native keyboard focus', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: MediaQuery(
          data: const MediaQueryData(size: Size(390, 844)),
          child: Scaffold(
            body: TerminalWorkspace(
              workspace: _workspace(),
              sessions: const [
                TerminalSession(
                  id: 'session-1',
                  sessionName: 'Shell',
                  status: 'active',
                  workspaceId: 'workspace-1',
                ),
              ],
              buffers: const {},
              socketClient: _RecordingTerminalSocketClient(),
              controlsExpanded: true,
              onControlsExpandedChanged: (_) {},
              onCreateSession: () {},
              onTerminateSession: (_) {},
              onSessionUnavailable: (_) {},
              onSaveLayout: () {},
            ),
          ),
        ),
      ),
    );

    final terminalInput = find.byKey(
      const ValueKey('terminal-input-session-1'),
    );
    await tester.showKeyboard(terminalInput);
    await tester.tap(find.byTooltip('Hide keyboard'));
    await tester.pump();
    expect(tester.testTextInput.isVisible, isFalse);

    await tester.tap(find.byKey(const ValueKey('terminal-view-session-1')));
    await tester.pump();

    final input = tester.widget<TextField>(terminalInput);
    expect(input.focusNode?.hasFocus, isTrue);
    expect(tester.testTextInput.isVisible, isTrue);
    await tester.pump(const Duration(milliseconds: 350));
    expect(tester.takeException(), isNull);
  });

  testWidgets('file tree expands directories inline like an editor', (
    tester,
  ) async {
    final src = _files().first;
    const child = FileItem(
      name: 'main.dart',
      path: '/Users/dev/projects/ai-terminal/src/main.dart',
      isDirectory: false,
      size: 1280,
    );
    var toggledPath = '';
    var selectedPath = '';

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: SizedBox(
            width: 390,
            height: 844,
            child: SidebarPanel(
              workspaces: [_workspace()],
              files: _files(),
              selectedWorkspace: _workspace(),
              selectedFile: null,
              isLoadingWorkspaces: false,
              workspaceError: null,
              directoryChildren: const {
                '/Users/dev/projects/ai-terminal/src': [child],
              },
              expandedDirectories: {src.path},
              onWorkspaceSelected: (_) {},
              onFileSelected: (file) => selectedPath = file.path,
              onDirectoryToggled: (file) => toggledPath = file.path,
              onCreateWorkspace: () {},
              onCloneRepository: () {},
            ),
          ),
        ),
      ),
    );

    expect(find.text('src'), findsOneWidget);
    expect(find.text('main.dart'), findsOneWidget);
    expect(find.text('Cargo.toml'), findsOneWidget);

    await tester.tap(find.text('src'));
    await tester.tap(find.text('main.dart'));
    await tester.pump();

    expect(toggledPath, src.path);
    expect(selectedPath, child.path);
    expect(tester.takeException(), isNull);
  });

  testWidgets('files search renders loaded results and keeps the query', (
    tester,
  ) async {
    const result = FileItem(
      name: 'main.dart',
      path: '/Users/dev/projects/ai-terminal/lib/main.dart',
      isDirectory: false,
      size: 512,
    );
    var query = 'main';

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: StatefulBuilder(
          builder: (context, setState) {
            return Scaffold(
              body: SizedBox(
                width: 390,
                height: 844,
                child: SidebarPanel(
                  workspaces: [_workspace()],
                  files: _files(),
                  selectedWorkspace: _workspace(),
                  selectedFile: result,
                  isLoadingWorkspaces: false,
                  workspaceError: null,
                  fileSearchQuery: query,
                  fileSearchResults: const [result],
                  isIndexingFiles: true,
                  onFileSearchChanged: (value) {
                    setState(() => query = value);
                  },
                  fileListKey: const PageStorageKey('files-workspace-1'),
                  onWorkspaceSelected: (_) {},
                  onFileSelected: (_) {},
                  onDirectoryToggled: (_) {},
                  onCreateWorkspace: () {},
                  onCloneRepository: () {},
                ),
              ),
            );
          },
        ),
      ),
    );

    expect(find.byKey(const ValueKey('file-search-field')), findsOneWidget);
    expect(find.text('main.dart'), findsOneWidget);
    expect(find.text('.../lib/main.dart'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    await tester.enterText(
      find.byKey(const ValueKey('file-search-field')),
      'cargo',
    );
    await tester.pump();
    expect(query, 'cargo');
    expect(tester.takeException(), isNull);
  });

  testWidgets('workspace clone action shows immediate pending feedback', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: SizedBox(
            width: 390,
            height: 844,
            child: SidebarPanel(
              workspaces: [_workspace()],
              files: _files(),
              selectedWorkspace: _workspace(),
              selectedFile: null,
              isLoadingWorkspaces: false,
              workspaceError: null,
              isPreparingClone: true,
              onWorkspaceSelected: (_) {},
              onFileSelected: (_) {},
              onCreateWorkspace: () {},
              onCloneRepository: () {},
            ),
          ),
        ),
      ),
    );

    expect(find.byTooltip('Opening GitHub'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('editor shows initial file content in dark and light themes', (
    tester,
  ) async {
    for (final brightness in Brightness.values) {
      await tester.pumpWidget(
        MaterialApp(
          theme: const ActApp().themeForTesting(brightness),
          home: const Scaffold(
            body: SizedBox(
              width: 390,
              height: 700,
              child: EditorPreview(
                file: FileItem(
                  name: 'README.md',
                  path: '/workspace/README.md',
                  isDirectory: false,
                  size: 42,
                ),
                content: FileContent(
                  path: 'README.md',
                  content: '# ACT\n\nUse the mobile editor.',
                  encoding: 'utf-8',
                  size: 29,
                  isBinary: false,
                ),
                isLoading: false,
                isSaving: false,
                hasUnsavedDraft: false,
                onChanged: _noopSave,
                onSave: _noopSave,
              ),
            ),
          ),
        ),
      );

      expect(find.textContaining('Use the mobile editor'), findsWidgets);
      expect(find.text('README.md'), findsOneWidget);

      final surface = tester.widget<Container>(
        find.byKey(const ValueKey('code-editor-surface')),
      );
      final textField = tester.widget<TextField>(
        find.byKey(const ValueKey('code-editor-field')),
      );
      final surfaceColor = surface.color!;
      final textColor = textField.style!.color!;
      final textSpan = textField.controller!.buildTextSpan(
        context: tester.element(
          find.byKey(const ValueKey('code-editor-field')),
        ),
        style: textField.style,
        withComposing: false,
      );
      final spanColors = _textColors(textSpan).where((color) {
        final alpha = (color.a * 255).round().clamp(0, 255);
        return color != Colors.transparent && alpha > 0;
      }).toSet();

      expect(textColor, isNot(Colors.transparent));
      expect(spanColors.length, greaterThan(1));
      expect(
        _contrastRatio(textColor, surfaceColor),
        greaterThanOrEqualTo(4.5),
        reason:
            'Editor text color $textColor must remain readable on '
            '$surfaceColor in ${brightness.name} mode.',
      );
      expect(textField.decoration!.filled, isFalse);
      expect(textField.decoration!.fillColor, Colors.transparent);
      expect(
        textField.decoration!.contentPadding,
        const EdgeInsets.fromLTRB(16, 14, 16, 16),
      );
      for (final color in spanColors) {
        expect(
          _contrastRatio(color, surfaceColor),
          greaterThanOrEqualTo(3),
          reason:
              'Syntax color $color must remain readable on $surfaceColor '
              'in ${brightness.name} mode.',
        );
      }
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('editor undo and redo follow unsaved edits', (tester) async {
    final file = _files().last;
    var content = const FileContent(
      path: 'Cargo.toml',
      content: '[package]\nname = "act"',
      encoding: 'utf-8',
      size: 22,
      isBinary: false,
    );
    final saves = <String>[];

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: StatefulBuilder(
          builder: (context, setState) {
            return Scaffold(
              body: SizedBox(
                width: 390,
                height: 700,
                child: EditorPreview(
                  file: file,
                  content: content,
                  isLoading: false,
                  isSaving: false,
                  hasUnsavedDraft: false,
                  onChanged: (_) {},
                  onSave: (value) {
                    saves.add(value);
                    setState(() {
                      content = FileContent(
                        path: content.path,
                        content: value,
                        encoding: content.encoding,
                        size: value.length,
                        isBinary: false,
                      );
                    });
                  },
                ),
              ),
            );
          },
        ),
      ),
    );

    final editorField = find.byKey(const ValueKey('code-editor-field'));
    await tester.showKeyboard(editorField);
    await tester.enterText(editorField, '[package]\nname = "act-mobile"');
    await tester.pump(const Duration(milliseconds: 700));

    final undoFinder = find.widgetWithIcon(IconButton, Icons.undo);
    final redoFinder = find.widgetWithIcon(IconButton, Icons.redo);
    IconButton undoButton() => tester.widget<IconButton>(undoFinder);
    IconButton redoButton() => tester.widget<IconButton>(redoFinder);
    TextField editor() => tester.widget<TextField>(editorField);

    expect(undoButton().onPressed, isNotNull);
    await tester.tap(undoFinder);
    await tester.pump();
    expect(editor().controller!.text, '[package]\nname = "act"');

    expect(redoButton().onPressed, isNotNull);
    await tester.tap(redoFinder);
    await tester.pump();
    expect(editor().controller!.text, '[package]\nname = "act-mobile"');

    await tester.tap(find.text('Save'));
    await tester.pump();

    expect(saves, ['[package]\nname = "act-mobile"']);
    expect(undoButton().onPressed, isNull);
    expect(redoButton().onPressed, isNull);
    expect(tester.takeException(), isNull);
  });

  testWidgets('empty workspace dashboard buttons are tappable on mobile', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    var cloneTapped = 0;
    var createTapped = 0;

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: SizedBox(
            width: 390,
            height: 844,
            child: SidebarPanel(
              workspaces: const [],
              files: const [],
              selectedWorkspace: null,
              selectedFile: null,
              isLoadingWorkspaces: false,
              workspaceError: null,
              onWorkspaceSelected: (_) {},
              onFileSelected: (_) {},
              onCreateWorkspace: () => createTapped++,
              onCloneRepository: () => cloneTapped++,
            ),
          ),
        ),
      ),
    );

    expect(find.text('Start from GitHub'), findsOneWidget);
    expect(find.text('Clone GitHub repo'), findsOneWidget);
    expect(find.text('Create empty workspace'), findsOneWidget);
    expect(find.text('Files'), findsNothing);

    await tester.tap(find.text('Clone GitHub repo'));
    await tester.tap(find.text('Create empty workspace'));

    expect(cloneTapped, 1);
    expect(createTapped, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('workspace header keeps GitHub clone reachable', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    var cloneTapped = 0;
    var createTapped = 0;

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: SizedBox(
            width: 390,
            height: 844,
            child: SidebarPanel(
              workspaces: [_workspace()],
              files: _files(),
              selectedWorkspace: _workspace(),
              selectedFile: null,
              isLoadingWorkspaces: false,
              workspaceError: null,
              onWorkspaceSelected: (_) {},
              onFileSelected: (_) {},
              onCreateWorkspace: () => createTapped++,
              onCloneRepository: () => cloneTapped++,
            ),
          ),
        ),
      ),
    );

    expect(find.text('Clone GitHub'), findsNothing);
    expect(find.byTooltip('Clone from GitHub'), findsOneWidget);
    await tester.tap(find.byTooltip('Clone from GitHub'));
    await tester.tap(find.byTooltip('Workspaces'));

    expect(cloneTapped, 1);
    expect(createTapped, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile files body can suppress workspace header', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: SizedBox(
            width: 390,
            height: 844,
            child: SidebarPanel(
              workspaces: [_workspace()],
              files: _files(),
              selectedWorkspace: _workspace(),
              selectedFile: null,
              isLoadingWorkspaces: false,
              workspaceError: null,
              onWorkspaceSelected: (_) {},
              onFileSelected: (_) {},
              onCreateWorkspace: () {},
              onCloneRepository: () {},
              showWorkspaceHeader: false,
            ),
          ),
        ),
      ),
    );

    expect(find.byTooltip('Clone from GitHub'), findsNothing);
    expect(find.byTooltip('Workspaces'), findsNothing);
    expect(find.text('AI Terminal'), findsOneWidget);
    expect(find.text('FILES'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('GitHub clone flow is full screen and returns cloned workspace', (
    tester,
  ) async {
    const repository = GitHubRepository(
      id: 1,
      name: 'ck',
      fullName: 'example-user/ck',
      cloneUrl: 'https://github.com/example-user/ck.git',
      private: false,
      defaultBranch: 'main',
      language: 'Dart',
    );
    Workspace? clonedWorkspace;

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Builder(
          builder: (context) {
            return Scaffold(
              body: Center(
                child: FilledButton(
                  onPressed: () async {
                    clonedWorkspace = await showGitHubCloneDialog(
                      context: context,
                      status: const GitHubProviderStatus(
                        available: true,
                        provider: 'github',
                        hasAccessToken: true,
                        hasRefreshToken: true,
                        scopes: ['repo', 'read:user'],
                      ),
                      initialPage: const GitHubRepositoryPage(
                        repositories: [repository],
                        page: 1,
                        perPage: 50,
                        hasMore: false,
                      ),
                      onSearch: (_, _) async => const GitHubRepositoryPage(
                        repositories: [repository],
                        page: 1,
                        perPage: 50,
                        hasMore: false,
                      ),
                      onClone: (_) async => _workspace(
                        id: 'workspace-cloned',
                        name: 'ck',
                        localPath: '/Users/dev/projects/ck',
                      ),
                    );
                  },
                  child: const Text('Clone'),
                ),
              ),
            );
          },
        ),
      ),
    );

    await tester.tap(find.text('Clone'));
    await tester.pumpAndSettle();

    expect(
      find.widgetWithText(TextField, 'Search repositories'),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.verified_outlined), findsOneWidget);
    expect(find.textContaining('token'), findsNothing);
    expect(find.textContaining('scope'), findsNothing);

    await tester.tap(find.text('example-user/ck'));
    await tester.pump();
    expect(find.text('Cloning example-user/ck'), findsOneWidget);
    await tester.pumpAndSettle();

    expect(clonedWorkspace?.id, 'workspace-cloned');
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile dock keeps terminal navigation stable', (tester) async {
    var selected = 1;

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: StatefulBuilder(
          builder: (context, setState) {
            return Scaffold(
              body: const SizedBox.shrink(),
              bottomNavigationBar: MobileActionDock(
                selectedIndex: selected,
                onSelected: (index) => setState(() => selected = index),
              ),
            );
          },
        ),
      ),
    );

    expect(find.text('Files'), findsOneWidget);
    expect(find.text('Terminal'), findsOneWidget);
    expect(find.text('Tasks'), findsOneWidget);
    expect(find.text('Agent'), findsOneWidget);
    expect(find.text('Editor'), findsNothing);
    expect(find.byTooltip('Hide terminal input'), findsNothing);
    expect(find.byTooltip('Show terminal input'), findsNothing);

    await tester.tap(find.text('Files'));
    await tester.pump();
    expect(selected, 0);
    expect(find.text('Terminal'), findsOneWidget);
    expect(find.byTooltip('Show terminal input'), findsNothing);
    expect(find.byTooltip('Hide terminal input'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile terminal title names the focused pane', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    var toggled = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: AppTopBar(
            workspace: _workspace(),
            user: const UserProfile(email: 'dev@example.com', plan: 'pro'),
            onRefresh: () {},
            onLogout: () {},
            onChooseTheme: () {},
            isTerminalMode: true,
            terminalPaneCount: 2,
            focusedTerminalTitle: 'Session 7a41ddf-53d...',
            onToggleTerminalFocusMode: () => toggled = true,
          ),
        ),
      ),
    );

    expect(find.text('Session 7a41ddf-53d...'), findsOneWidget);
    expect(find.text('AI Terminal - 2 active'), findsOneWidget);
    expect(find.byTooltip('Immersive terminal'), findsOneWidget);
    await tester.tap(find.byTooltip('Immersive terminal'));
    expect(toggled, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile terminal toolbar toggles terminal input', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    var expanded = true;

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: StatefulBuilder(
          builder: (context, setState) {
            return Scaffold(
              body: AppTopBar(
                workspace: _workspace(),
                user: const UserProfile(email: 'dev@example.com', plan: 'pro'),
                onRefresh: () {},
                onLogout: () {},
                onChooseTheme: () {},
                isTerminalMode: true,
                terminalPaneCount: 2,
                terminalControlsExpanded: expanded,
                onToggleTerminalControls: () {
                  setState(() => expanded = !expanded);
                },
              ),
            );
          },
        ),
      ),
    );

    expect(find.byTooltip('Hide terminal input'), findsOneWidget);
    await tester.tap(find.byTooltip('Hide terminal input'));
    await tester.pump();
    expect(find.byTooltip('Show terminal input'), findsOneWidget);
    await tester.tap(find.byTooltip('Show terminal input'));
    await tester.pump();
    expect(find.byTooltip('Hide terminal input'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile terminal new pane shows immediate pending feedback', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    var tapped = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: AppTopBar(
            workspace: _workspace(),
            user: const UserProfile(email: 'dev@example.com', plan: 'pro'),
            onRefresh: () {},
            onLogout: () {},
            onChooseTheme: () {},
            isTerminalMode: true,
            terminalPaneCount: 1,
            isCreatingTerminal: true,
            onCreateTerminal: () => tapped = true,
          ),
        ),
      ),
    );

    expect(find.byTooltip('Starting terminal'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.tap(find.byTooltip('Starting terminal'));
    await tester.pump();
    expect(tapped, isFalse);
    expect(tester.takeException(), isNull);
  });

  testWidgets('top bar exposes theme picker from more actions', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1024, 720));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    var openedThemePicker = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: AppTopBar(
            workspace: _workspace(),
            user: const UserProfile(email: 'dev@example.com', plan: 'pro'),
            onRefresh: () {},
            onLogout: () {},
            onChooseTheme: () => openedThemePicker = true,
          ),
        ),
      ),
    );

    await tester.tap(find.byTooltip('More actions'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Theme'));
    await tester.pump();

    expect(openedThemePicker, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('top bar exposes server process controls from more actions', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1024, 720));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    var openedProcesses = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: AppTopBar(
            workspace: _workspace(),
            user: const UserProfile(email: 'dev@example.com', plan: 'pro'),
            onRefresh: () {},
            onLogout: () {},
            onChooseTheme: () {},
            onOpenServerProcesses: () => openedProcesses = true,
          ),
        ),
      ),
    );

    await tester.tap(find.byTooltip('More actions'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Server processes'));
    await tester.pump();

    expect(openedProcesses, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('top bar keeps global duplicate actions inside overflow', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1024, 720));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    var refreshed = false;
    var managedAccounts = false;
    var switchedProfile = false;
    var loggedOut = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: AppTopBar(
            workspace: _workspace(),
            user: const UserProfile(email: 'dev@example.com', plan: 'pro'),
            onRefresh: () => refreshed = true,
            onLogout: () => loggedOut = true,
            onChooseTheme: () {},
            onManageAccounts: () => managedAccounts = true,
            onSwitchProfile: () => switchedProfile = true,
          ),
        ),
      ),
    );

    expect(find.byTooltip('Refresh'), findsNothing);
    expect(find.byTooltip('Connected accounts'), findsNothing);
    expect(find.byTooltip('Hosted ACT'), findsNothing);
    expect(find.byTooltip('Sign out'), findsNothing);

    await tester.tap(find.byTooltip('More actions'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Refresh workspace'));
    await tester.pumpAndSettle();
    expect(refreshed, isTrue);

    await tester.tap(find.byTooltip('More actions'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Connected accounts'));
    await tester.pumpAndSettle();
    expect(managedAccounts, isTrue);

    await tester.tap(find.byTooltip('More actions'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Switch ACT profile'));
    await tester.pumpAndSettle();
    expect(switchedProfile, isTrue);

    await tester.tap(find.byTooltip('More actions'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sign out of ACT'));
    await tester.pumpAndSettle();
    expect(loggedOut, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile top bar shows route title and context actions', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    var cloned = false;
    var managedCollections = false;
    var createdWorkspace = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: AppTopBar(
            workspace: _workspace(),
            user: const UserProfile(email: 'dev@example.com', plan: 'pro'),
            onRefresh: () {},
            onLogout: () {},
            onChooseTheme: () {},
            mobileTitle: 'Workspace',
            mobileIcon: Icons.folder_open,
            mobileActions: [
              AppTopBarAction(
                tooltip: 'Clone from GitHub',
                icon: Icons.download_outlined,
                onPressed: () => cloned = true,
              ),
              AppTopBarAction(
                tooltip: 'Manage collections',
                icon: Icons.account_tree_outlined,
                onPressed: () => managedCollections = true,
              ),
              AppTopBarAction(
                tooltip: 'Create workspace',
                icon: Icons.add,
                onPressed: () => createdWorkspace = true,
              ),
            ],
          ),
        ),
      ),
    );

    expect(find.text('Workspace'), findsOneWidget);
    expect(find.byTooltip('Refresh'), findsNothing);
    expect(find.byTooltip('Sign out'), findsNothing);

    await tester.tap(find.byTooltip('Clone from GitHub'));
    await tester.tap(find.byTooltip('Manage collections'));
    await tester.tap(find.byTooltip('Create workspace'));
    await tester.pump();

    expect(cloned, isTrue);
    expect(managedCollections, isTrue);
    expect(createdWorkspace, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile editor has a compact back affordance', (tester) async {
    var closed = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: EditorPreview(
            file: _files().last,
            content: const FileContent(
              path: 'Cargo.toml',
              content: '[package]\nname = "act"',
              encoding: 'utf-8',
              size: 22,
              isBinary: false,
            ),
            isLoading: false,
            isSaving: false,
            hasUnsavedDraft: false,
            onChanged: _noopSave,
            onSave: _noopSave,
            onClose: () => closed = true,
          ),
        ),
      ),
    );

    await tester.tap(find.byTooltip('Back to files'));
    await tester.pump();

    expect(closed, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('ACT task panel shows runner readiness blockers', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: TaskPanel(
            readiness: const RunnerReadiness(
              runnerMode: 'local_single_user',
              codexLoginStatus: 'Not logged in',
              codexVersion: 'codex 1.0',
              workspaceRoot: '/tmp/workspaces',
              artifactRoot: '/tmp/artifacts',
              runtimeRoot: '/tmp/runtime',
              codexHome: '/tmp/runtime/codex',
              availableDiskGb: 12,
              minFreeDiskGb: 20,
              githubProviderStatus: 'checked on PR run',
              ready: false,
              blockedReasons: ['Codex is not logged in'],
            ),
            availableWorkspaces: const [],
            tasks: const [],
            selectedTask: null,
            isLoading: false,
            executionStatus: null,
            onRefresh: () {},
            onTaskCleared: () {},
            onTaskSelected: (_) {},
            onRunTask: (_) async {},
            onUpdateTask: (_, _) async {},
            onOpenCodexSession: (_) {},
            onLoadArtifact: (_, _, artifact) async =>
                NativeTaskArtifactContent(artifact: artifact),
            onFinalizeRun: (_, _) async {},
            onCreatePullRequests: (_, _) async {},
            onCloneTask: (_) async {},
            onCreateTask: () {},
          ),
        ),
      ),
    );

    expect(find.text('ACT Tasks'), findsOneWidget);
    expect(find.textContaining('Codex is not logged in'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile task body suppresses duplicated task header', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: TaskPanel(
            readiness: _readyRunner(),
            availableWorkspaces: const [],
            tasks: const [],
            selectedTask: null,
            isLoading: false,
            executionStatus: null,
            onRefresh: () {},
            onTaskCleared: () {},
            onTaskSelected: (_) {},
            onRunTask: (_) async {},
            onUpdateTask: (_, _) async {},
            onOpenCodexSession: (_) {},
            onLoadArtifact: (_, _, artifact) async =>
                NativeTaskArtifactContent(artifact: artifact),
            onFinalizeRun: (_, _) async {},
            onCreatePullRequests: (_, _) async {},
            onCloneTask: (_) async {},
            onCreateTask: () {},
            showHeader: false,
          ),
        ),
      ),
    );

    expect(find.text('ACT Tasks'), findsNothing);
    expect(find.byTooltip('Refresh tasks'), findsNothing);
    expect(find.byTooltip('New task'), findsNothing);
    expect(find.text('All tasks - 0 tasks'), findsOneWidget);
    expect(find.byTooltip('Filter tasks'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('ACT task panel opens detail and saves edits', (tester) async {
    await tester.binding.setSurfaceSize(const Size(900, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final workspaces = [
      _workspace(id: 'workspace-1', name: 'jules'),
      _workspace(
        id: 'workspace-2',
        name: 'one',
        localPath: '/Users/dev/projects/one',
      ),
    ];
    final task = _nativeTask();
    NativeTask? selectedTask;
    TaskUpdateDraft? capturedDraft;

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: StatefulBuilder(
          builder: (context, setState) {
            return Scaffold(
              body: TaskPanel(
                readiness: _readyRunner(),
                availableWorkspaces: workspaces,
                tasks: [task],
                selectedTask: selectedTask,
                isLoading: false,
                executionStatus: null,
                onRefresh: () {},
                onTaskCleared: () {},
                onTaskSelected: (task) => setState(() => selectedTask = task),
                onRunTask: (_) async {},
                onUpdateTask: (task, draft) async {
                  capturedDraft = draft;
                },
                onOpenCodexSession: (_) {},
                onLoadArtifact: (_, _, artifact) async =>
                    NativeTaskArtifactContent(artifact: artifact),
                onFinalizeRun: (_, _) async {},
                onCreatePullRequests: (_, _) async {},
                onCloneTask: (_) async {},
                onCreateTask: () {},
              ),
            );
          },
        ),
      ),
    );

    await tester.tap(find.text('Fix tasks'));
    await tester.pumpAndSettle();

    expect(find.byTooltip('Run task'), findsOneWidget);
    expect(find.text('Issue description'), findsWidgets);

    await tester.enterText(find.byType(TextField).first, 'Updated task');
    await tester.drag(find.byType(ListView).last, const Offset(0, -260));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('task-detail-project-search')),
      'one',
    );
    await tester.pump();
    await tester.tap(
      find.byKey(const ValueKey('task-project-choice-workspace-2')),
    );
    await tester.pump();
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(capturedDraft?.title, 'Updated task');
    expect(
      capturedDraft?.workspaceIds,
      containsAll(['workspace-1', 'workspace-2']),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('ACT task panel exposes collection and project filters', (
    tester,
  ) async {
    String? selectedType;
    String? selectedId;
    final workspace = _workspace(id: 'workspace-1', name: 'jules');
    final collection = _collection(name: 'Client suite', workspace: workspace);

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: TaskPanel(
            readiness: _readyRunner(),
            availableWorkspaces: [workspace],
            availableCollections: [collection],
            taskScopeType: 'collection',
            taskScopeId: collection.id,
            tasks: [_nativeTask()],
            selectedTask: null,
            isLoading: false,
            executionStatus: null,
            onRefresh: () {},
            onTaskScopeChanged: (type, id) {
              selectedType = type;
              selectedId = id;
            },
            onTaskCleared: () {},
            onTaskSelected: (_) {},
            onRunTask: (_) async {},
            onUpdateTask: (_, _) async {},
            onOpenCodexSession: (_) {},
            onLoadArtifact: (_, _, artifact) async =>
                NativeTaskArtifactContent(artifact: artifact),
            onFinalizeRun: (_, _) async {},
            onCreatePullRequests: (_, _) async {},
            onCloneTask: (_) async {},
            onCreateTask: () {},
          ),
        ),
      ),
    );

    expect(find.text('Client suite - 1 task'), findsOneWidget);
    await tester.tap(find.byTooltip('Filter tasks'));
    await tester.pumpAndSettle();
    expect(find.text('COLLECTIONS'), findsOneWidget);
    expect(find.text('PROJECTS'), findsOneWidget);

    await tester.tap(find.text('All tasks'));
    await tester.pump();
    expect(selectedType, isNull);
    expect(selectedId, isNull);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Codex panel renders stream events and sends follow-up prompts', (
    tester,
  ) async {
    final sent = <String>[];
    final openedTerminals = <String>[];

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: CodexSessionPanel(
            workspace: _workspace(),
            sessions: const [
              CodexSessionSummary(
                id: 'session-1',
                title: 'Fix mobile terminal',
                cwd: '/Users/mc/Desktop/projects/silly/ACT',
                rolloutPath: '/Users/mc/.codex/sessions/session-1.jsonl',
                updatedAt: null,
                status: 'completed',
                terminalSessionId: 'terminal-1',
              ),
              CodexSessionSummary(
                id: 'session-2',
                title: 'Check Codex resume',
                cwd: '/Users/mc/Desktop/projects/silly/ACT',
                rolloutPath: '/Users/mc/.codex/sessions/session-2.jsonl',
                updatedAt: null,
                status: 'failed',
              ),
            ],
            events: const [
              CodexSessionEvent(
                index: 0,
                kind: 'message',
                role: 'developer',
                text: 'Internal runtime instructions',
              ),
              CodexSessionEvent(
                index: 3,
                kind: 'message',
                role: 'user',
                text:
                    '<environment_context>\n  <cwd>/home/ubuntu/act-workspaces/example</cwd>\n</environment_context>',
              ),
              CodexSessionEvent(
                index: 4,
                kind: 'turn',
                title: 'Turn',
                status: '019e0aa3-7aac-7300-82f1-39aa551695b6',
              ),
              CodexSessionEvent(
                index: 5,
                kind: 'status',
                title: 'Pi RPC started',
                status: 'running',
              ),
              CodexSessionEvent(
                index: 1,
                kind: 'message',
                role: 'assistant',
                text: 'I am checking the terminal flow.',
              ),
              CodexSessionEvent(
                index: 2,
                kind: 'tool_call',
                title: 'exec_command',
                command: 'git status --short',
              ),
            ],
            selectedSessionId: 'session-1',
            isLoading: false,
            error: null,
            canLaunch: true,
            isLaunching: false,
            onLaunch: (_) async {},
            onNewChat: () {},
            onSessionSelected: (_) {},
            onOpenLinkedTerminal: openedTerminals.add,
            onSendText: (text) async => sent.add(text),
            onInterruptAndSend: (_) async {},
            onInterrupt: () {},
          ),
        ),
      ),
    );

    expect(find.text('Fix mobile terminal'), findsOneWidget);
    expect(
      find.text('Codex - All conversations - completed - 2 conversations'),
      findsOneWidget,
    );
    expect(find.textContaining('2 conversations'), findsOneWidget);
    expect(find.textContaining('Internal runtime instructions'), findsNothing);
    expect(find.textContaining('<environment_context>'), findsNothing);
    expect(find.text('Turn'), findsNothing);
    expect(find.textContaining('019e0aa3'), findsNothing);
    expect(find.text('Pi RPC started'), findsNothing);
    expect(find.textContaining('checking the terminal flow'), findsOneWidget);
    expect(find.text('Tool Calls'), findsOneWidget);
    expect(find.text('git status --short'), findsNothing);

    await tester.tap(find.text('Tool Calls'));
    await tester.pump();
    expect(find.text('git status --short'), findsOneWidget);

    await tester.tap(find.text('Fix mobile terminal'));
    await tester.pumpAndSettle();
    expect(find.text('Agent conversations'), findsOneWidget);
    expect(find.text('Check Codex resume'), findsOneWidget);
    await tester.tap(find.byTooltip('Open linked terminal'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'continue');
    await tester.tap(find.byTooltip('Send to Codex'));
    await tester.pump();

    expect(sent, ['continue']);
    expect(openedTerminals, ['terminal-1']);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'Codex panel keeps selected runtime alias after provider id arrives',
    (tester) async {
      final sent = <String>[];
      var launches = 0;

      await tester.pumpWidget(
        MaterialApp(
          theme: const ActApp().themeForTesting(),
          home: Scaffold(
            body: CodexSessionPanel(
              workspace: _workspace(),
              sessions: const [
                CodexSessionSummary(
                  id: 'provider-thread-1',
                  runtimeSessionId: 'runtime:launch-1',
                  title: 'Brand new launch',
                  cwd: '/Users/mc/Desktop/projects/silly/ACT',
                  rolloutPath: '',
                  updatedAt: null,
                  status: 'running',
                ),
                CodexSessionSummary(
                  id: 'older-thread',
                  title: 'Older thread',
                  cwd: '/Users/mc/Desktop/projects/silly/ACT',
                  rolloutPath: '',
                  updatedAt: null,
                  status: 'completed',
                ),
              ],
              events: const [
                CodexSessionEvent(
                  index: 0,
                  kind: 'message',
                  role: 'assistant',
                  text: 'Still working on the new launch.',
                  status: 'streaming',
                ),
              ],
              selectedSessionId: 'runtime:launch-1',
              isLoading: false,
              error: null,
              canLaunch: true,
              isLaunching: false,
              onLaunch: (_) async => launches += 1,
              onNewChat: () {},
              onSessionSelected: (_) {},
              onOpenLinkedTerminal: (_) {},
              onSendText: (text) async => sent.add(text),
              onInterruptAndSend: (_) async {},
              onInterrupt: () {},
            ),
          ),
        ),
      );

      expect(find.text('Brand new launch'), findsOneWidget);
      expect(find.text('Older thread'), findsNothing);
      expect(find.textContaining('Still working'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'stay here');
      await tester.tap(find.byTooltip('Queue follow-up'));
      await tester.pump();

      expect(sent, ['stay here']);
      expect(launches, 0);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Codex panel folds successful tool output and expands diagnostics',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: const ActApp().themeForTesting(),
          home: Scaffold(
            body: CodexSessionPanel(
              workspace: _workspace(),
              sessions: const [
                CodexSessionSummary(
                  id: 'session-1',
                  title: 'Tool folding',
                  cwd: '/Users/mc/Desktop/projects/silly/ACT',
                  rolloutPath: '',
                  updatedAt: null,
                  status: 'completed',
                ),
              ],
              events: const [
                CodexSessionEvent(
                  index: 9,
                  kind: 'tool_call',
                  title: 'Running command',
                  command: 'sleep 10\nthen echo done',
                  status: 'running',
                ),
                CodexSessionEvent(
                  index: 10,
                  kind: 'tool_output',
                  title: 'Command output',
                  output: 'first line\nsecond line',
                  status: 'completed',
                ),
                CodexSessionEvent(
                  index: 11,
                  kind: 'diagnostic',
                  title: 'Codex diagnostic',
                  text:
                      'error: unexpected argument -C\nUsage: codex exec resume',
                ),
              ],
              selectedSessionId: 'session-1',
              isLoading: false,
              error: null,
              canLaunch: true,
              isLaunching: false,
              onLaunch: (_) async {},
              onNewChat: () {},
              onSessionSelected: (_) {},
              onOpenLinkedTerminal: (_) {},
              onSendText: (_) async {},
              onInterruptAndSend: (_) async {},
              onInterrupt: () {},
            ),
          ),
        ),
      );

      expect(find.text('Tool Calls'), findsOneWidget);
      expect(find.textContaining('need attention'), findsNothing);
      expect(find.textContaining('sleep 10'), findsNothing);
      expect(find.textContaining('then echo done'), findsNothing);
      expect(find.text('first line'), findsNothing);
      expect(find.textContaining('second line'), findsNothing);
      expect(find.textContaining('unexpected argument -C'), findsOneWidget);

      await tester.tap(find.text('Tool Calls'));
      await tester.pump();
      expect(find.textContaining('sleep 10'), findsOneWidget);
      expect(find.textContaining('then echo done'), findsNothing);
      expect(find.text('first line'), findsOneWidget);
      expect(find.textContaining('second line'), findsNothing);

      await tester.tap(find.text('Tool output - completed'));
      await tester.pump();
      expect(find.textContaining('second line'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Codex panel shows Pi progress while waiting for output', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: CodexSessionPanel(
            workspace: _workspace(),
            sessions: const [
              CodexSessionSummary(
                id: 'pi-session-1',
                title: 'Pi run',
                cwd: '/Users/mc/Desktop/projects/silly/ACT',
                rolloutPath: '',
                updatedAt: null,
                status: 'running',
              ),
            ],
            events: const [
              CodexSessionEvent(
                index: 0,
                kind: 'status',
                title: 'Pi RPC started',
                status: 'running',
              ),
            ],
            selectedSessionId: 'pi-session-1',
            isLoading: false,
            error: null,
            canLaunch: true,
            isLaunching: false,
            agentProvider: 'pi',
            onLaunch: (_) async {},
            onNewChat: () {},
            onSessionSelected: (_) {},
            onOpenLinkedTerminal: (_) {},
            onSendText: (_) async {},
            onInterruptAndSend: (_) async {},
            onInterrupt: () {},
          ),
        ),
      ),
    );

    expect(find.text('Pi RPC started'), findsNothing);
    expect(find.text('Agent is thinking'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Codex panel shows Pi reload-next-prompt state', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: CodexSessionPanel(
            workspace: _workspace(),
            sessions: const [
              CodexSessionSummary(
                id: 'pi-session-1',
                title: 'Pi run',
                cwd: '/Users/mc/Desktop/projects/silly/ACT',
                rolloutPath: '',
                updatedAt: null,
                status: 'completed',
                agentProvider: 'pi',
              ),
            ],
            events: const [],
            selectedSessionId: 'pi-session-1',
            isLoading: false,
            error: null,
            canLaunch: true,
            isLaunching: false,
            agentProvider: 'pi',
            reloadPiNextPrompt: true,
            onLaunch: (_) async {},
            onNewChat: () {},
            onSessionSelected: (_) {},
            onOpenLinkedTerminal: (_) {},
            onSendText: (_) async {},
            onInterruptAndSend: (_) async {},
            onInterrupt: () {},
          ),
        ),
      ),
    );

    expect(
      find.text('Pi will reload tools before the next prompt'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('Codex panel shows deterministic Codex progress phases', (
    tester,
  ) async {
    Widget panel(List<CodexSessionEvent> events) {
      return MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: CodexSessionPanel(
            workspace: _workspace(),
            sessions: const [
              CodexSessionSummary(
                id: 'codex-session-1',
                title: 'Codex run',
                cwd: '/Users/mc/Desktop/projects/silly/ACT',
                rolloutPath: '',
                updatedAt: null,
                status: 'running',
                isBusy: true,
              ),
            ],
            events: events,
            selectedSessionId: 'codex-session-1',
            isLoading: false,
            error: null,
            canLaunch: true,
            isLaunching: false,
            agentProvider: 'codex',
            onLaunch: (_) async {},
            onNewChat: () {},
            onSessionSelected: (_) {},
            onOpenLinkedTerminal: (_) {},
            onSendText: (_) async {},
            onInterruptAndSend: (_) async {},
            onInterrupt: () {},
          ),
        ),
      );
    }

    await tester.pumpWidget(
      panel(const [
        CodexSessionEvent(
          index: 0,
          kind: 'status',
          title: 'agent start',
          status: 'running',
        ),
      ]),
    );
    expect(find.text('Agent is thinking'), findsOneWidget);

    await tester.pumpWidget(
      panel(const [
        CodexSessionEvent(
          index: 0,
          kind: 'message',
          role: 'assistant',
          text: 'Working',
          status: 'streaming',
        ),
      ]),
    );
    await tester.pump();
    expect(find.text('Agent is responding'), findsOneWidget);

    await tester.pumpWidget(
      panel(const [
        CodexSessionEvent(
          index: 0,
          kind: 'tool_call',
          title: 'bash',
          command: 'npm test',
          status: 'running',
        ),
      ]),
    );
    await tester.pump();
    expect(find.text('Agent is using tools'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Codex panel follows streaming text when already at latest', (
    tester,
  ) async {
    String paragraph(String label) =>
        List.generate(8, (index) => '$label line $index').join('\n\n');

    Widget panel(String assistantText) {
      return MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: SizedBox(
            height: 260,
            child: CodexSessionPanel(
              workspace: _workspace(),
              sessions: const [
                CodexSessionSummary(
                  id: 'stream-session',
                  title: 'Streaming',
                  cwd: '/Users/mc/Desktop/projects/silly/ACT',
                  rolloutPath: '',
                  updatedAt: null,
                  status: 'running',
                  isBusy: false,
                ),
              ],
              events: [
                const CodexSessionEvent(
                  index: 0,
                  kind: 'message',
                  role: 'user',
                  text: 'start',
                  status: 'submitted',
                ),
                CodexSessionEvent(
                  index: 1,
                  kind: 'message',
                  role: 'assistant',
                  text: assistantText,
                  status: 'streaming',
                ),
              ],
              selectedSessionId: 'stream-session',
              isLoading: false,
              error: null,
              canLaunch: true,
              isLaunching: false,
              onLaunch: (_) async {},
              onNewChat: () {},
              onSessionSelected: (_) {},
              onOpenLinkedTerminal: (_) {},
              onSendText: (_) async {},
              onInterruptAndSend: (_) async {},
              onInterrupt: () {},
            ),
          ),
        ),
      );
    }

    await tester.pumpWidget(panel(paragraph('first')));
    await tester.pump();
    final scrollable = tester.state<ScrollableState>(
      find
          .descendant(
            of: find.byType(ListView),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    scrollable.position.jumpTo(scrollable.position.maxScrollExtent);
    final oldMax = scrollable.position.maxScrollExtent;

    await tester.pumpWidget(
      panel('${paragraph('first')}\n\n${paragraph('second')}'),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 320));

    expect(scrollable.position.maxScrollExtent, greaterThan(oldMax));
    expect(scrollable.position.pixels, scrollable.position.maxScrollExtent);
    expect(find.text('New messages'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Codex panel floats queued prompts outside the thread', (
    tester,
  ) async {
    Widget panel({required int queuedCount, required bool submitted}) {
      return MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: CodexSessionPanel(
            workspace: _workspace(),
            sessions: [
              CodexSessionSummary(
                id: 'runtime-1',
                title: 'Running Codex',
                cwd: '/Users/mc/Desktop/projects/silly/ACT',
                rolloutPath: '',
                updatedAt: null,
                status: queuedCount > 0 ? 'running' : 'completed',
                isBusy: queuedCount > 0,
                queuedMessageCount: queuedCount,
              ),
            ],
            events: [
              const CodexSessionEvent(
                index: 1,
                kind: 'message',
                role: 'assistant',
                text: 'Working on the first request.',
              ),
              const CodexSessionEvent(
                index: 2,
                kind: 'message',
                role: 'user',
                text: 'floating only',
                status: 'queued',
              ),
              if (submitted)
                const CodexSessionEvent(
                  index: 3,
                  kind: 'message',
                  role: 'user',
                  text: 'floating only',
                  status: 'submitted',
                ),
            ],
            selectedSessionId: 'runtime-1',
            isLoading: false,
            error: null,
            canLaunch: true,
            isLaunching: false,
            onLaunch: (_) async {},
            onNewChat: () {},
            onSessionSelected: (_) {},
            onOpenLinkedTerminal: (_) {},
            onSendText: (_) async {},
            onInterruptAndSend: (_) async {},
            onInterrupt: () {},
          ),
        ),
      );
    }

    await tester.pumpWidget(panel(queuedCount: 1, submitted: false));
    await tester.pump();

    expect(find.byKey(const ValueKey('codex-pending-queue')), findsOneWidget);
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('codex-pending-queue')),
        matching: find.text('floating only'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byType(ListView),
        matching: find.text('floating only'),
      ),
      findsNothing,
    );

    await tester.pumpWidget(panel(queuedCount: 0, submitted: true));
    await tester.pump();

    expect(find.byKey(const ValueKey('codex-pending-queue')), findsNothing);
    expect(
      find.descendant(
        of: find.byType(ListView),
        matching: find.text('floating only'),
      ),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('Codex panel renders assistant markdown richly', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: CodexSessionPanel(
            workspace: _workspace(),
            sessions: const [
              CodexSessionSummary(
                id: 'session-1',
                title: 'Markdown',
                cwd: '/Users/mc/Desktop/projects/silly/ACT',
                rolloutPath: '',
                updatedAt: null,
                status: 'completed',
              ),
            ],
            events: const [
              CodexSessionEvent(
                index: 1,
                kind: 'message',
                role: 'assistant',
                text:
                    '# Plan\n\n- **Ship** the fix\n- [ ] Verify tables\n\n'
                    '```dart\nfinal answer = 42;\n```\n\n'
                    '| Area | Result |\n| --- | --- |\n| UI | Good |',
              ),
            ],
            selectedSessionId: 'session-1',
            isLoading: false,
            error: null,
            canLaunch: true,
            isLaunching: false,
            onLaunch: (_) async {},
            onNewChat: () {},
            onSessionSelected: (_) {},
            onOpenLinkedTerminal: (_) {},
            onSendText: (_) async {},
            onInterruptAndSend: (_) async {},
            onInterrupt: () {},
          ),
        ),
      ),
    );

    expect(find.byType(MarkdownBody), findsOneWidget);
    expect(find.text('Plan'), findsOneWidget);
    expect(find.textContaining('**Ship**'), findsNothing);
    expect(find.textContaining('final answer = 42;'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Codex input loses focus when tapping the conversation', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: CodexSessionPanel(
            workspace: _workspace(),
            sessions: const [
              CodexSessionSummary(
                id: 'session-1',
                title: 'Keyboard focus',
                cwd: '/Users/mc/Desktop/projects/silly/ACT',
                rolloutPath: '',
                updatedAt: null,
                status: 'completed',
              ),
            ],
            events: const [
              CodexSessionEvent(
                index: 1,
                kind: 'message',
                role: 'assistant',
                text: 'Tap here to dismiss.',
              ),
            ],
            selectedSessionId: 'session-1',
            isLoading: false,
            error: null,
            canLaunch: true,
            isLaunching: false,
            onLaunch: (_) async {},
            onNewChat: () {},
            onSessionSelected: (_) {},
            onOpenLinkedTerminal: (_) {},
            onSendText: (_) async {},
            onInterruptAndSend: (_) async {},
            onInterrupt: () {},
          ),
        ),
      ),
    );

    final input = find.byType(TextField);
    await tester.showKeyboard(input);
    expect(tester.testTextInput.isVisible, isTrue);
    await tester.tap(find.textContaining('Tap here'));
    await tester.pump();
    expect(tester.testTextInput.isVisible, isFalse);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Codex input uses return for multiline and button to send', (
    tester,
  ) async {
    final sent = <String>[];

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: CodexSessionPanel(
            workspace: _workspace(),
            sessions: const [
              CodexSessionSummary(
                id: 'session-1',
                title: 'Composer',
                cwd: '/Users/mc/Desktop/projects/silly/ACT',
                rolloutPath: '',
                updatedAt: null,
                status: 'completed',
              ),
            ],
            events: const [
              CodexSessionEvent(
                index: 1,
                kind: 'message',
                role: 'assistant',
                text: 'Ready.',
              ),
            ],
            selectedSessionId: 'session-1',
            isLoading: false,
            error: null,
            canLaunch: true,
            isLaunching: false,
            onLaunch: (_) async {},
            onNewChat: () {},
            onSessionSelected: (_) {},
            onOpenLinkedTerminal: (_) {},
            onSendText: (text) async => sent.add(text),
            onInterruptAndSend: (_) async {},
            onInterrupt: () {},
          ),
        ),
      ),
    );

    final input = find.byType(TextField);
    final field = tester.widget<TextField>(input);
    expect(field.keyboardType, TextInputType.multiline);
    expect(field.textInputAction, TextInputAction.newline);

    await tester.enterText(input, 'line one\nline two');
    await tester.testTextInput.receiveAction(TextInputAction.newline);
    await tester.pump();
    expect(sent, isEmpty);

    await tester.tap(find.byTooltip('Send to Codex'));
    await tester.pump();
    expect(sent, ['line one\nline two']);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Codex panel interrupts a running structured session', (
    tester,
  ) async {
    var interrupts = 0;

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: CodexSessionPanel(
            workspace: _workspace(),
            sessions: const [
              CodexSessionSummary(
                id: 'runtime-1',
                title: 'Running Codex',
                cwd: '/Users/mc/Desktop/projects/silly/ACT',
                rolloutPath: '',
                updatedAt: null,
                status: 'running',
              ),
            ],
            events: const [],
            selectedSessionId: 'runtime-1',
            isLoading: false,
            error: null,
            canLaunch: true,
            isLaunching: false,
            onLaunch: (_) async {},
            onNewChat: () {},
            onSessionSelected: (_) {},
            onOpenLinkedTerminal: (_) {},
            onSendText: (_) async {},
            onInterruptAndSend: (_) async {},
            onInterrupt: () => interrupts++,
          ),
        ),
      ),
    );

    await tester.tap(find.byTooltip('Interrupt'));
    await tester.pump();

    expect(interrupts, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Codex panel queues and interrupt-sends while running', (
    tester,
  ) async {
    final queued = <String>[];
    final interruptSent = <String>[];

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: CodexSessionPanel(
            workspace: _workspace(),
            sessions: const [
              CodexSessionSummary(
                id: 'runtime-1',
                title: 'Running Codex',
                cwd: '/Users/mc/Desktop/projects/silly/ACT',
                rolloutPath: '',
                updatedAt: null,
                status: 'running',
                isBusy: true,
              ),
            ],
            events: const [],
            selectedSessionId: 'runtime-1',
            isLoading: false,
            error: null,
            canLaunch: true,
            isLaunching: false,
            onLaunch: (_) async {},
            onNewChat: () {},
            onSessionSelected: (_) {},
            onOpenLinkedTerminal: (_) {},
            onSendText: (text) async => queued.add(text),
            onInterruptAndSend: (text) async => interruptSent.add(text),
            onInterrupt: () {},
          ),
        ),
      ),
    );

    await tester.enterText(find.byType(TextField), 'queue this');
    expect(find.text('Queue a follow-up'), findsOneWidget);
    await tester.tap(find.byTooltip('Queue follow-up'));
    await tester.pump();
    expect(queued, ['queue this']);

    await tester.enterText(find.byType(TextField), 'replace now');
    await tester.pump();
    await tester.tap(find.byTooltip('Interrupt and send'));
    await tester.pump();
    expect(interruptSent, ['replace now']);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Codex panel can launch with an optional prompt', (tester) async {
    final launches = <String?>[];
    var newChats = 0;

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: CodexSessionPanel(
            workspace: _workspace(),
            sessions: const [],
            events: const [],
            selectedSessionId: null,
            isLoading: false,
            error: null,
            canLaunch: true,
            isLaunching: false,
            onLaunch: (prompt) async => launches.add(prompt),
            onNewChat: () => newChats++,
            onSessionSelected: (_) {},
            onOpenLinkedTerminal: (_) {},
            onSendText: (_) async {},
            onInterruptAndSend: (_) async {},
            onInterrupt: () {},
          ),
        ),
      ),
    );

    await tester.tap(find.byTooltip('New chat').first);
    await tester.pump();
    expect(newChats, 1);

    await tester.enterText(find.byType(TextField), 'inspect this repo');
    await tester.tap(find.byIcon(Icons.rocket_launch_outlined).last);
    await tester.pump();

    expect(launches, ['inspect this repo']);
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile Codex thread row keeps only the thread list affordance', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: CodexSessionPanel(
            workspace: _workspace(),
            sessions: const [
              CodexSessionSummary(
                id: 'session-1',
                title: 'Fix mobile terminal',
                cwd: '/Users/mc/Desktop/projects/silly/ACT',
                rolloutPath: '',
                updatedAt: null,
                status: 'completed',
              ),
            ],
            events: const [],
            selectedSessionId: 'session-1',
            isLoading: false,
            error: null,
            canLaunch: true,
            isLaunching: false,
            onLaunch: (_) async {},
            onNewChat: () {},
            onSessionSelected: (_) {},
            onOpenLinkedTerminal: (_) {},
            onSendText: (_) async {},
            onInterruptAndSend: (_) async {},
            onInterrupt: () {},
            showThreadActions: false,
          ),
        ),
      ),
    );

    expect(find.text('Fix mobile terminal'), findsOneWidget);
    expect(find.byTooltip('New chat'), findsNothing);
    expect(find.byTooltip('Manage collections'), findsNothing);
    expect(find.byTooltip('Filter conversations'), findsNothing);
    expect(find.byIcon(Icons.view_list_outlined), findsOneWidget);

    await tester.tap(find.text('Fix mobile terminal'));
    await tester.pumpAndSettle();
    expect(find.text('Agent conversations'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Codex panel exposes collection chat scope and manager action', (
    tester,
  ) async {
    var openedCollections = 0;
    String? collectionFilter;
    String? workspaceFilter = 'unchanged';
    final workspace = _workspace(name: 'ACT');
    final collection = _collection(
      name: 'Mobile platform',
      workspace: workspace,
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: const ActApp().themeForTesting(),
        home: Scaffold(
          body: CodexSessionPanel(
            workspace: workspace,
            workspaces: [workspace],
            selectedCollection: collection,
            collections: [collection],
            sessions: const [],
            events: const [],
            selectedSessionId: null,
            isLoading: false,
            error: null,
            canLaunch: true,
            isLaunching: false,
            onLaunch: (_) async {},
            onNewChat: () {},
            onSessionSelected: (_) {},
            onOpenLinkedTerminal: (_) {},
            onSendText: (_) async {},
            onInterruptAndSend: (_) async {},
            onInterrupt: () {},
            onWorkspaceFilterChanged: (id) => workspaceFilter = id,
            onCollectionFilterChanged: (id) => collectionFilter = id,
            onManageCollections: () => openedCollections++,
          ),
        ),
      ),
    );

    expect(find.text('Start a collection chat'), findsOneWidget);
    expect(
      find.text(
        'Codex - Collection: Mobile platform -> ACT - Draft - 0 conversations',
      ),
      findsOneWidget,
    );

    await tester.tap(find.byTooltip('Manage collections'));
    await tester.pump();

    expect(openedCollections, 1);

    await tester.tap(find.byTooltip('Filter conversations'));
    await tester.pumpAndSettle();
    expect(find.text('COLLECTIONS'), findsOneWidget);
    expect(find.text('PROJECTS'), findsOneWidget);
    await tester.tap(find.text('Mobile platform'));
    await tester.pump();

    expect(collectionFilter, 'collection-1');
    expect(workspaceFilter, 'unchanged');
    expect(tester.takeException(), isNull);
  });

  for (final brightness in Brightness.values) {
    testWidgets('shell renders ${brightness.name} contrast at mobile size', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MaterialApp(
          theme: const ActApp().themeForTesting(brightness),
          home: const Scaffold(body: _ShellFixture(compact: true)),
        ),
      );

      expect(find.text('ACT'), findsOneWidget);
      expect(find.text('AI Terminal'), findsWidgets);
      expect(find.byIcon(Icons.terminal), findsWidgets);
      expect(tester.takeException(), isNull);
    });
  }
}

void _noopSave(String _) {}

Future<void> _tapSecondMobilePane(WidgetTester tester) async {
  await tester.tapAt(const Offset(300, 160));
  await tester.pumpAndSettle();
}

Iterable<Color> _textColors(InlineSpan span) sync* {
  final color = span.style?.color;
  if (color != null) {
    yield color;
  }
  if (span is TextSpan) {
    final children = span.children;
    if (children != null) {
      for (final child in children) {
        yield* _textColors(child);
      }
    }
  }
}

double _contrastRatio(Color foreground, Color background) {
  final foregroundLuminance = foreground.computeLuminance();
  final backgroundLuminance = background.computeLuminance();
  final lighter = foregroundLuminance > backgroundLuminance
      ? foregroundLuminance
      : backgroundLuminance;
  final darker = foregroundLuminance > backgroundLuminance
      ? backgroundLuminance
      : foregroundLuminance;
  return (lighter + 0.05) / (darker + 0.05);
}

class _ShellFixture extends StatelessWidget {
  const _ShellFixture({required this.compact});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    final workspace = _workspace();
    final sidebar = SidebarPanel(
      workspaces: [workspace],
      files: _files(),
      selectedWorkspace: workspace,
      selectedFile: _files().last,
      isLoadingWorkspaces: false,
      workspaceError: null,
      onWorkspaceSelected: (_) {},
      onFileSelected: (_) {},
      onCreateWorkspace: () {},
      onCloneRepository: () {},
    );
    final terminal = TerminalWorkspace(
      workspace: workspace,
      sessions: [_session()],
      buffers: const {'session-1': r'$ cargo check --workspace'},
      controlsExpanded: true,
      onControlsExpandedChanged: (_) {},
      onCreateSession: () {},
      onTerminateSession: (_) {},
      onSessionUnavailable: (_) {},
      onSaveLayout: () {},
    );

    return Column(
      children: [
        AppTopBar(
          workspace: workspace,
          user: const UserProfile(email: 'dev@example.com', plan: 'pro'),
          onRefresh: () {},
          onLogout: () {},
          onChooseTheme: () {},
        ),
        Expanded(
          child: compact
              ? terminal
              : _ResponsiveBody(sidebar: sidebar, terminal: terminal),
        ),
        StatusBar(
          health: const HealthStatus(
            status: 'healthy',
            service: 'act-server',
            version: '0.1.0',
          ),
          stats: _stats(),
          workspace: workspace,
          isAuthenticated: true,
        ),
      ],
    );
  }
}

class _ResponsiveBody extends StatelessWidget {
  const _ResponsiveBody({required this.sidebar, required this.terminal});

  final Widget sidebar;
  final Widget terminal;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width < 1100) {
      return Row(
        children: [
          SizedBox(width: 300, child: sidebar),
          Expanded(child: terminal),
        ],
      );
    }

    return Row(
      children: [
        SizedBox(width: 310, child: sidebar),
        Expanded(child: terminal),
        SizedBox(
          width: 340,
          child: EditorPreview(
            file: _files().last,
            content: null,
            isLoading: false,
            isSaving: false,
            hasUnsavedDraft: false,
            onChanged: (_) {},
            onSave: (_) {},
          ),
        ),
      ],
    );
  }
}

Workspace _workspace({
  String id = 'workspace-1',
  String name = 'AI Terminal',
  String localPath = '/Users/dev/projects/ai-terminal',
}) {
  return Workspace(
    id: id,
    name: name,
    localPath: localPath,
    isActive: true,
    githubRepo: 'drmhse/ai-code-terminal',
    githubUrl: 'https://github.com/drmhse/ai-code-terminal',
  );
}

WorkspaceCollection _collection({
  String id = 'collection-1',
  String name = 'Platform',
  required Workspace workspace,
}) {
  return WorkspaceCollection(
    id: id,
    name: name,
    defaultWorkspaceId: workspace.id,
    members: [
      WorkspaceCollectionMember(
        collectionId: id,
        workspaceId: workspace.id,
        role: 'primary',
        workspace: workspace,
      ),
    ],
  );
}

RunnerReadiness _readyRunner() {
  return const RunnerReadiness(
    runnerMode: 'local_single_user',
    codexLoginStatus: 'Logged in',
    codexVersion: 'codex 1.0',
    workspaceRoot: '/tmp/workspaces',
    artifactRoot: '/tmp/artifacts',
    runtimeRoot: '/tmp/runtime',
    codexHome: '/tmp/runtime/codex',
    availableDiskGb: 137,
    minFreeDiskGb: 20,
    githubProviderStatus: 'checked on PR run',
    ready: true,
    blockedReasons: [],
  );
}

NativeTask _nativeTask() {
  return const NativeTask(
    id: 'task-1',
    title: 'Fix tasks',
    description: 'Issue description',
    executionMode: 'implement',
    approvalMode: 'ask_before_edits',
    evidencePreference: 'tests_plus_screenshots',
    status: 'ready',
    workspaces: [
      NativeTaskWorkspace(
        workspaceId: 'workspace-1',
        name: 'jules',
        path: '/Users/dev/projects/jules',
        workingStrategy: 'worktree',
        dirtyState: 'clean',
        remote: 'example-user/jules',
      ),
    ],
    attachments: [],
    runs: [],
  );
}

List<FileItem> _files() {
  return const [
    FileItem(
      name: 'src',
      path: '/Users/dev/projects/ai-terminal/src',
      isDirectory: true,
    ),
    FileItem(
      name: 'Cargo.toml',
      path: '/Users/dev/projects/ai-terminal/Cargo.toml',
      isDirectory: false,
      size: 2048,
    ),
  ];
}

TerminalSession _session() {
  return const TerminalSession(
    id: 'session-1',
    sessionName: 'Terminal',
    status: 'active',
    workspaceId: 'workspace-1',
  );
}

Finder _commandComposerButton() {
  return find.byWidgetPredicate(
    (widget) => widget is IconButton && widget.tooltip == 'Command',
    description: 'command composer IconButton',
  );
}

SystemStats _stats() {
  return const SystemStats(
    cpuUsage: 18,
    memoryUsage: 2048,
    memoryTotal: 8192,
    memoryPercentage: 25,
    diskUsage: 100,
    diskTotal: 500,
    diskPercentage: 20,
    activeSessions: 1,
    activeProcesses: 3,
    uptimeSeconds: 3600,
    systemHealth: 'Healthy',
  );
}

class _SentTerminalData {
  const _SentTerminalData({required this.sessionId, required this.data});

  final String sessionId;
  final String data;
}

class _TerminalResizeCall {
  const _TerminalResizeCall({
    required this.sessionId,
    required this.cols,
    required this.rows,
  });

  final String sessionId;
  final int cols;
  final int rows;
}

class _RecordingTerminalSocketClient extends TerminalSocketClient {
  _RecordingTerminalSocketClient()
    : super(baseUrl: 'http://localhost:8080', token: 'test-token');

  final sentData = <_SentTerminalData>[];
  final createdSessionIds = <String>[];
  final createdWorkspacesBySession = <String, String>{};
  final resizeCalls = <_TerminalResizeCall>[];

  @override
  bool get isConnected => true;

  @override
  void connect() {}

  @override
  void createTerminal({
    required String workspaceId,
    required String sessionId,
    required String paneId,
    required int cols,
    required int rows,
  }) {
    createdSessionIds.add(sessionId);
    createdWorkspacesBySession[sessionId] = workspaceId;
  }

  @override
  bool resizeTerminal({
    required String sessionId,
    required int cols,
    required int rows,
  }) {
    resizeCalls.add(
      _TerminalResizeCall(sessionId: sessionId, cols: cols, rows: rows),
    );
    return true;
  }

  @override
  bool sendTerminalData({required String sessionId, required String data}) {
    sentData.add(_SentTerminalData(sessionId: sessionId, data: data));
    return true;
  }
}
