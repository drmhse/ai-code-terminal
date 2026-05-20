import 'package:act_frontend/src/app/agent_settings_controller.dart';
import 'package:act_frontend/src/app/app_colors.dart';
import 'package:act_frontend/src/app/app_theme_controller.dart';
import 'package:act_frontend/src/features/home/act_home_page.dart';
import 'package:act_frontend/src/services/connection_settings_store.dart';
import 'package:flutter/material.dart';

class ActApp extends StatefulWidget {
  const ActApp({super.key});

  ThemeData themeForTesting([
    Brightness brightness = Brightness.dark,
    String themeId = ActThemes.defaultThemeId,
  ]) {
    return ActApp.buildTheme(brightness, ActThemes.byId(themeId));
  }

  static ThemeData buildTheme(Brightness brightness, ActTheme theme) {
    final palette = theme.palette(brightness);
    final buttonShape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(8),
    );
    return ThemeData(
      colorScheme:
          ColorScheme.fromSeed(
            seedColor: palette.accent,
            brightness: brightness,
            surface: palette.chrome,
            error: palette.error,
          ).copyWith(
            primary: palette.accent,
            onPrimary: palette.onAccent,
            secondary: palette.link,
            surface: palette.chrome,
            onSurface: palette.primaryText,
            error: palette.error,
          ),
      extensions: [palette],
      scaffoldBackgroundColor: palette.page,
      useMaterial3: true,
      visualDensity: VisualDensity.adaptivePlatformDensity,
      fontFamily: 'SF Pro Text',
      appBarTheme: AppBarTheme(
        backgroundColor: palette.chrome,
        foregroundColor: palette.primaryText,
        elevation: 0,
        centerTitle: false,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: palette.panel,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(
          color: palette.primaryText,
          fontSize: 20,
          fontWeight: FontWeight.w800,
        ),
        contentTextStyle: TextStyle(color: palette.secondaryText, fontSize: 14),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: palette.panel,
        surfaceTintColor: Colors.transparent,
        textStyle: TextStyle(color: palette.primaryText),
        iconColor: palette.secondaryText,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(color: palette.line),
        ),
      ),
      cardTheme: CardThemeData(
        color: palette.chrome,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(color: palette.line),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return palette.line;
            }
            if (states.contains(WidgetState.pressed)) {
              return palette.accentPressed;
            }
            return palette.accent;
          }),
          foregroundColor: WidgetStatePropertyAll(palette.onAccent),
          iconColor: WidgetStatePropertyAll(palette.onAccent),
          overlayColor: WidgetStatePropertyAll(
            palette.onAccent.withValues(alpha: 0.08),
          ),
          shape: WidgetStatePropertyAll(buttonShape),
          minimumSize: const WidgetStatePropertyAll(Size(44, 40)),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          ),
          textStyle: const WidgetStatePropertyAll(
            TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStatePropertyAll(palette.primaryText),
          iconColor: WidgetStatePropertyAll(palette.accent),
          overlayColor: WidgetStatePropertyAll(
            palette.accent.withValues(alpha: 0.10),
          ),
          side: WidgetStateProperty.resolveWith((states) {
            final color = states.contains(WidgetState.pressed)
                ? palette.accent
                : palette.accent.withValues(
                    alpha: brightness == Brightness.dark ? 0.55 : 0.70,
                  );
            return BorderSide(color: color, width: 1.2);
          }),
          shape: WidgetStatePropertyAll(buttonShape),
          minimumSize: const WidgetStatePropertyAll(Size(44, 40)),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          ),
          textStyle: const WidgetStatePropertyAll(
            TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStatePropertyAll(palette.secondaryText),
          iconColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed) ||
                states.contains(WidgetState.hovered) ||
                states.contains(WidgetState.focused)) {
              return palette.accent;
            }
            return palette.secondaryText;
          }),
          overlayColor: WidgetStatePropertyAll(
            palette.accent.withValues(alpha: 0.10),
          ),
          shape: WidgetStatePropertyAll(buttonShape),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 72,
        backgroundColor: Colors.transparent,
        indicatorColor: palette.accent,
        indicatorShape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? palette.onAccent : palette.mutedText,
            size: selected ? 27 : 25,
          );
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            color: selected ? palette.accent : palette.mutedText,
            fontSize: 12,
            fontWeight: selected ? FontWeight.w900 : FontWeight.w700,
          );
        }),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: palette.raised,
        side: BorderSide(color: palette.accent.withValues(alpha: 0.45)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        labelStyle: TextStyle(
          color: palette.primaryText,
          fontWeight: FontWeight.w800,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: palette.field,
        labelStyle: TextStyle(color: palette.secondaryText),
        hintStyle: TextStyle(color: palette.mutedText),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: BorderSide(color: palette.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: BorderSide(color: palette.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: BorderSide(color: palette.accent),
        ),
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: palette.accent,
        selectionColor: palette.accent.withValues(alpha: 0.28),
        selectionHandleColor: palette.accent,
      ),
    );
  }

  @override
  State<ActApp> createState() => _ActAppState();
}

class _ActAppState extends State<ActApp> {
  late final AgentSettingsController _agentSettingsController;
  late final AppThemeController _themeController;

  @override
  void initState() {
    super.initState();
    _agentSettingsController = AgentSettingsController(
      ConnectionSettingsStore(),
    )..load();
    _themeController = AppThemeController(ConnectionSettingsStore())..load();
  }

  @override
  void dispose() {
    _agentSettingsController.dispose();
    _themeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AgentSettingsScope(
      controller: _agentSettingsController,
      child: ActThemeScope(
        controller: _themeController,
        child: AnimatedBuilder(
          animation: _themeController,
          builder: (context, _) {
            final selectedTheme = _themeController.selectedTheme;
            return MaterialApp(
              title: 'ACT',
              debugShowCheckedModeBanner: false,
              themeMode: ThemeMode.system,
              theme: ActApp.buildTheme(Brightness.light, selectedTheme),
              darkTheme: ActApp.buildTheme(Brightness.dark, selectedTheme),
              home: const ActHomePage(),
            );
          },
        ),
      ),
    );
  }
}
