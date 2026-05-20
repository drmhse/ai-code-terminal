part of '../act_api.dart';

extension ActApiLayouts on ActApi {
  Future<List<TerminalLayout>> terminalLayouts(String workspaceId) async {
    final json = await _get(
      '/api/v1/layouts?workspace_id=${Uri.encodeQueryComponent(workspaceId)}',
    );
    return ApiEnvelope.list(json, TerminalLayout.fromJson);
  }

  Future<TerminalLayout> saveTerminalLayout({
    required String workspaceId,
    required int paneCount,
  }) async {
    final normalizedPaneCount = paneCount.clamp(1, 4);
    final tree = {
      'type': normalizedPaneCount == 1 ? 'single' : 'grid',
      'panes': List.generate(normalizedPaneCount, (index) => {'index': index}),
    };
    final existingLayouts = await terminalLayouts(workspaceId);
    final defaultLayout = existingLayouts
        .where((layout) => layout.isDefault)
        .cast<TerminalLayout?>()
        .firstWhere((layout) => layout != null, orElse: () => null);

    if (defaultLayout != null) {
      final json = await _put('/api/v1/layouts/${defaultLayout.id}', {
        'name': 'Default',
        'is_default': true,
        'tree': tree,
      });
      return ApiEnvelope.item(json, TerminalLayout.fromJson);
    }

    final json = await _post('/api/v1/layouts/with-buffers', {
      'name': 'Default',
      'layout_type': normalizedPaneCount == 1 ? 'single' : 'grid',
      'workspace_id': workspaceId,
      'is_default': true,
      'tree': tree,
    });
    final layout = ApiEnvelope.item(json, TerminalLayout.fromJson);
    await _post('/api/v1/layouts/${layout.id}/default', {});
    return layout;
  }
}
