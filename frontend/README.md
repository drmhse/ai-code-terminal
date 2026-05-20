# ACT Flutter Frontend

Cross-platform client for AI Code Terminal.

## Targets

- Android
- iOS
- macOS
- Web

## Development

```bash
flutter pub get
flutter run -d macos
```

## Organization

- `lib/main.dart`: Small app entrypoint.
- `lib/src/app`: App shell and global theme.
- `lib/src/features`: User-facing screens and feature widgets.
- `lib/src/models`: Backend response models.
- `lib/src/services`: Backend API, AuthOS, and secure storage helpers.
- `lib/src/core`: Shared platform and parsing utilities.

Hand-written Dart files should stay below 500 lines. Split features by screen, widget, model, and service when a file starts getting large.

The app defaults to:

- Android emulator: `http://10.0.2.2:3001`
- macOS, iOS simulator, and web: `http://localhost:3001`

Override deployment URLs through build configuration, not through the login UI:

```bash
flutter run -d macos \
  --dart-define=ACT_API_BASE_URL=https://api.example.com \
  --dart-define=AUTHOS_BASE_URL=https://auth.example.com
```

Protected backend APIs require an AuthOS JWT.

## AuthOS

Configure the client with your AuthOS service:

- Organization slug: your organization slug
- Service slug: your service slug
- Client ID: your public client ID
- AuthOS API URL: your AuthOS API base URL

Only the public client ID is compiled into Flutter. Do not add a client secret
to the mobile, desktop, or web app.

OAuth provider login starts at `/auth/:provider` with `org`, `service`, and
`redirect_uri` parameters. AuthOS redirects back with tokens in the URL
fragment, and the app stores access and refresh tokens with
`flutter_secure_storage`.

Registered redirect URIs needed by the app:

- Web development: `http://localhost:4000/auth/callback`
- Web deployment: the deployed origin plus `/auth/callback`
- Native targets: `act://auth/callback`

## Checks

```bash
dart format .
flutter analyze
flutter test
```

## Web Build

```bash
sh scripts/build_web.sh
```

The backend Docker Compose stack serves the generated `build/web` directory through Caddy.
