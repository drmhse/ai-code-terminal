import 'package:act_frontend/src/app/act_app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('ACT client renders connection shell', (tester) async {
    FlutterSecureStorage.setMockInitialValues({});

    await tester.binding.setSurfaceSize(const Size(1440, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(const ActApp());
    await tester.pumpAndSettle();

    expect(find.text('AI Code Terminal'), findsOneWidget);
    expect(
      find.text('Hosted or self-hosted terminal workspace'),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.terminal), findsWidgets);
    expect(find.text('Continue with GitHub'), findsOneWidget);
    expect(find.text('Continue with Google'), findsOneWidget);
    expect(find.text('Continue with Microsoft'), findsNothing);
    expect(find.text('Change ACT profile'), findsOneWidget);
    expect(find.text('Connect self-hosted ACT'), findsNothing);
    expect(find.text('Backend URL'), findsNothing);
    expect(find.text('AuthOS API URL'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
