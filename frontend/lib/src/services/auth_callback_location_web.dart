import 'package:web/web.dart' as web;

const _capturedCallbackKey = 'act.authCallbackUrl';

List<Uri> authCallbackUrisForBootstrap() {
  final uris = <Uri>[];
  final captured = web.window.sessionStorage.getItem(_capturedCallbackKey);
  if (captured != null && captured.isNotEmpty) {
    uris.add(Uri.parse(captured));
  }

  final current = Uri.parse(web.window.location.href);
  if (!uris.any((uri) => uri.toString() == current.toString())) {
    uris.add(current);
  }

  return uris;
}

void clearAuthCallbackFromAddressBar(Uri uri) {
  web.window.sessionStorage.removeItem(_capturedCallbackKey);

  if (uri.query.isEmpty && uri.fragment.isEmpty) {
    return;
  }

  final cleanPath = uri.path.isEmpty ? '/' : uri.path;
  web.window.history.replaceState(null, '', cleanPath);
}
