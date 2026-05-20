import 'package:act_frontend/src/app/app_colors.dart';
import 'package:act_frontend/src/services/connection_settings_store.dart';
import 'package:flutter/material.dart';

class AppThemeController extends ChangeNotifier {
  AppThemeController(this._store);

  final ConnectionSettingsStore _store;
  String _themeId = ActThemes.defaultThemeId;

  String get themeId => _themeId;
  ActTheme get selectedTheme => ActThemes.byId(_themeId);

  Future<void> load() async {
    final loadedThemeId = await _store.loadThemeId();
    final next = ActThemes.byId(loadedThemeId).id;
    if (next != _themeId) {
      _themeId = next;
      notifyListeners();
    }
  }

  Future<void> selectTheme(String themeId) async {
    final next = ActThemes.byId(themeId).id;
    if (next == _themeId) {
      return;
    }
    _themeId = next;
    notifyListeners();
    await _store.saveThemeId(next);
  }
}

class ActThemeScope extends InheritedNotifier<AppThemeController> {
  const ActThemeScope({
    required AppThemeController controller,
    required super.child,
    super.key,
  }) : super(notifier: controller);

  static AppThemeController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<ActThemeScope>();
    assert(scope?.notifier != null, 'ActThemeScope not found in context');
    return scope!.notifier!;
  }
}
