import 'dart:math' as math;

import 'package:act_frontend/src/app/act_app.dart';
import 'package:act_frontend/src/app/app_colors.dart';
import 'package:act_frontend/src/app/app_theme_controller.dart';
import 'package:act_frontend/src/app/theme_selection_page.dart';
import 'package:act_frontend/src/services/connection_settings_store.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('all themes keep required foreground contrast', () {
    for (final theme in ActThemes.all) {
      for (final brightness in Brightness.values) {
        final palette = theme.palette(brightness);
        expect(
          _contrastRatio(palette.primaryText, palette.panel),
          greaterThanOrEqualTo(7),
          reason: '${theme.id} ${brightness.name} primary text on panel',
        );
        expect(
          _contrastRatio(palette.secondaryText, palette.panel),
          greaterThanOrEqualTo(4.5),
          reason: '${theme.id} ${brightness.name} secondary text on panel',
        );
        expect(
          _contrastRatio(palette.mutedText, palette.panel),
          greaterThanOrEqualTo(4.5),
          reason: '${theme.id} ${brightness.name} muted text on panel',
        );
        expect(
          _contrastRatio(palette.primaryText, palette.field),
          greaterThanOrEqualTo(7),
          reason: '${theme.id} ${brightness.name} primary text on field',
        );
        expect(
          _contrastRatio(palette.onAccent, palette.accent),
          greaterThanOrEqualTo(4.5),
          reason: '${theme.id} ${brightness.name} on accent',
        );
      }
    }
  });

  test('theme data exposes the selected palette extension', () {
    final themeData = const ActApp().themeForTesting(
      Brightness.dark,
      'stanford',
    );
    final palette = themeData.extension<ActThemePalette>();

    expect(palette, isNotNull);
    expect(palette!.accent, ActThemes.stanford.dark.accent);
    expect(themeData.colorScheme.primary, ActThemes.stanford.dark.accent);
    expect(themeData.scaffoldBackgroundColor, ActThemes.stanford.dark.page);
  });

  test('persists selected theme id locally', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final store = ConnectionSettingsStore();

    expect(await store.loadThemeId(), ActThemes.defaultThemeId);

    await store.saveThemeId('retro');
    expect(await store.loadThemeId(), 'retro');
  });

  testWidgets('theme selection page updates the controller', (tester) async {
    FlutterSecureStorage.setMockInitialValues({});
    final controller = AppThemeController(ConnectionSettingsStore());

    await tester.pumpWidget(
      ActThemeScope(
        controller: controller,
        child: MaterialApp(
          theme: const ActApp().themeForTesting(),
          home: const ThemeSelectionPage(),
        ),
      ),
    );

    expect(find.text('Emerald'), findsWidgets);
    expect(find.text('Stanford'), findsOneWidget);

    await tester.tap(find.text('Stanford'));
    await tester.pumpAndSettle();

    expect(controller.themeId, 'stanford');
    expect(tester.takeException(), isNull);
  });
}

double _contrastRatio(Color foreground, Color background) {
  final light = _relativeLuminance(foreground);
  final dark = _relativeLuminance(background);
  final lighter = light > dark ? light : dark;
  final darker = light > dark ? dark : light;
  return (lighter + 0.05) / (darker + 0.05);
}

double _relativeLuminance(Color color) {
  double channel(double value) {
    return value <= 0.03928
        ? value / 12.92
        : math.pow((value + 0.055) / 1.055, 2.4).toDouble();
  }

  return 0.2126 * channel(color.r) +
      0.7152 * channel(color.g) +
      0.0722 * channel(color.b);
}
