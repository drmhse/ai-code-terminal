import 'package:flutter/material.dart';

part 'app_colors/theme_definitions.dart';

class ActTheme {
  const ActTheme({
    required this.id,
    required this.name,
    required this.description,
    required this.light,
    required this.dark,
  });

  final String id;
  final String name;
  final String description;
  final ActThemePalette light;
  final ActThemePalette dark;

  ActThemePalette palette(Brightness brightness) {
    return brightness == Brightness.dark ? dark : light;
  }
}

@immutable
class ActThemePalette extends ThemeExtension<ActThemePalette> {
  const ActThemePalette({
    required this.page,
    required this.chrome,
    required this.panel,
    required this.raised,
    required this.field,
    required this.line,
    required this.lineStrong,
    required this.primaryText,
    required this.secondaryText,
    required this.mutedText,
    required this.accent,
    required this.accentPressed,
    required this.accentSoft,
    required this.onAccent,
    required this.link,
    required this.success,
    required this.warning,
    required this.error,
  });

  final Color page;
  final Color chrome;
  final Color panel;
  final Color raised;
  final Color field;
  final Color line;
  final Color lineStrong;
  final Color primaryText;
  final Color secondaryText;
  final Color mutedText;
  final Color accent;
  final Color accentPressed;
  final Color accentSoft;
  final Color onAccent;
  final Color link;
  final Color success;
  final Color warning;
  final Color error;

  @override
  ActThemePalette copyWith({
    Color? page,
    Color? chrome,
    Color? panel,
    Color? raised,
    Color? field,
    Color? line,
    Color? lineStrong,
    Color? primaryText,
    Color? secondaryText,
    Color? mutedText,
    Color? accent,
    Color? accentPressed,
    Color? accentSoft,
    Color? onAccent,
    Color? link,
    Color? success,
    Color? warning,
    Color? error,
  }) {
    return ActThemePalette(
      page: page ?? this.page,
      chrome: chrome ?? this.chrome,
      panel: panel ?? this.panel,
      raised: raised ?? this.raised,
      field: field ?? this.field,
      line: line ?? this.line,
      lineStrong: lineStrong ?? this.lineStrong,
      primaryText: primaryText ?? this.primaryText,
      secondaryText: secondaryText ?? this.secondaryText,
      mutedText: mutedText ?? this.mutedText,
      accent: accent ?? this.accent,
      accentPressed: accentPressed ?? this.accentPressed,
      accentSoft: accentSoft ?? this.accentSoft,
      onAccent: onAccent ?? this.onAccent,
      link: link ?? this.link,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      error: error ?? this.error,
    );
  }

  @override
  ActThemePalette lerp(ThemeExtension<ActThemePalette>? other, double t) {
    if (other is! ActThemePalette) {
      return this;
    }
    return ActThemePalette(
      page: Color.lerp(page, other.page, t)!,
      chrome: Color.lerp(chrome, other.chrome, t)!,
      panel: Color.lerp(panel, other.panel, t)!,
      raised: Color.lerp(raised, other.raised, t)!,
      field: Color.lerp(field, other.field, t)!,
      line: Color.lerp(line, other.line, t)!,
      lineStrong: Color.lerp(lineStrong, other.lineStrong, t)!,
      primaryText: Color.lerp(primaryText, other.primaryText, t)!,
      secondaryText: Color.lerp(secondaryText, other.secondaryText, t)!,
      mutedText: Color.lerp(mutedText, other.mutedText, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      accentPressed: Color.lerp(accentPressed, other.accentPressed, t)!,
      accentSoft: Color.lerp(accentSoft, other.accentSoft, t)!,
      onAccent: Color.lerp(onAccent, other.onAccent, t)!,
      link: Color.lerp(link, other.link, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      error: Color.lerp(error, other.error, t)!,
    );
  }
}

class ActThemes {
  const ActThemes._();

  static const defaultThemeId = 'emerald';

  static const all = <ActTheme>[
    emerald,
    oak,
    leather,
    stanford,
    retro,
    slate,
    glacier,
    plum,
    copper,
    midnight,
  ];

  static ActTheme byId(String id) {
    return all.firstWhere((theme) => theme.id == id, orElse: () => emerald);
  }

  static const emerald = actThemeEmerald;
  static const oak = actThemeOak;
  static const leather = actThemeLeather;
  static const stanford = actThemeStanford;
  static const retro = actThemeRetro;
  static const slate = actThemeSlate;
  static const glacier = actThemeGlacier;
  static const plum = actThemePlum;
  static const copper = actThemeCopper;
  static const midnight = actThemeMidnight;
}

class AppColors {
  const AppColors._();

  static const background = Color(0xFF0B0F12);
  static const surface = Color(0xFF12181D);
  static const surfaceRaised = Color(0xFF182128);
  static const sidebar = Color(0xFF10161B);
  static const terminal = Color(0xFF070A0D);
  static const border = Color(0xFF26323B);
  static const borderStrong = Color(0xFF3C4A55);
  static const textPrimary = Color(0xFFF2F7F5);
  static const textSecondary = Color(0xFFC3D0CA);
  static const textMuted = Color(0xFF8FA09A);

  static bool isDark(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark;
  }

  static ActThemePalette palette(BuildContext context) {
    return Theme.of(context).extension<ActThemePalette>() ??
        ActThemes.emerald.palette(Theme.of(context).brightness);
  }

  static Color page(BuildContext context) => palette(context).page;
  static Color chrome(BuildContext context) => palette(context).chrome;
  static Color panel(BuildContext context) => palette(context).panel;
  static Color raised(BuildContext context) => palette(context).raised;
  static Color field(BuildContext context) => palette(context).field;
  static Color line(BuildContext context) => palette(context).line;
  static Color lineStrong(BuildContext context) => palette(context).lineStrong;
  static Color primaryText(BuildContext context) =>
      palette(context).primaryText;
  static Color secondaryText(BuildContext context) {
    return palette(context).secondaryText;
  }

  static Color mutedText(BuildContext context) => palette(context).mutedText;
  static Color accent(BuildContext context) => palette(context).accent;
  static Color accentPressed(BuildContext context) {
    return palette(context).accentPressed;
  }

  static Color accentSoft(BuildContext context) => palette(context).accentSoft;
  static Color onAccent(BuildContext context) => palette(context).onAccent;
  static Color accentBlue(BuildContext context) => palette(context).link;
  static Color success(BuildContext context) => palette(context).success;
  static Color warning(BuildContext context) => palette(context).warning;
  static Color error(BuildContext context) => palette(context).error;
}
