import 'dart:async';
import 'dart:convert';

import 'package:act_frontend/src/services/act_api_exception.dart';
import 'package:act_frontend/src/services/auth_os_config.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

part 'auth_os_client/client.dart';

class AuthOsTokens {
  const AuthOsTokens({required this.accessToken, this.refreshToken});

  final String accessToken;
  final String? refreshToken;
}

class AuthOsLinkResult {
  const AuthOsLinkResult({
    required this.provider,
    required this.success,
    this.error,
  });

  final String? provider;
  final bool success;
  final String? error;
}

class AuthOsDeviceCode {
  const AuthOsDeviceCode({
    required this.deviceCode,
    required this.userCode,
    required this.verificationUri,
    required this.expiresIn,
    required this.interval,
  });

  final String deviceCode;
  final String userCode;
  final String verificationUri;
  final int expiresIn;
  final int interval;

  factory AuthOsDeviceCode.fromJson(Map<String, dynamic> json) {
    return AuthOsDeviceCode(
      deviceCode: json['device_code'].toString(),
      userCode: json['user_code'].toString(),
      verificationUri: json['verification_uri'].toString(),
      expiresIn: int.tryParse(json['expires_in'].toString()) ?? 900,
      interval: int.tryParse(json['interval'].toString()) ?? 5,
    );
  }
}

class AuthOsLinkedAccountGrant {
  const AuthOsLinkedAccountGrant({
    required this.id,
    required this.serviceId,
    required this.scopes,
  });

  factory AuthOsLinkedAccountGrant.fromJson(Map<String, dynamic> json) {
    return AuthOsLinkedAccountGrant(
      id: json['id']?.toString() ?? '',
      serviceId: json['service_id']?.toString() ?? '',
      scopes: _stringList(json['scopes']),
    );
  }

  final String id;
  final String serviceId;
  final List<String> scopes;
}

class AuthOsLinkedAccount {
  const AuthOsLinkedAccount({
    required this.id,
    required this.provider,
    required this.scopes,
    required this.status,
    required this.grants,
    this.email,
    this.displayName,
    this.expiresAt,
  });

  factory AuthOsLinkedAccount.fromJson(Map<String, dynamic> json) {
    final grants = json['grants'];
    return AuthOsLinkedAccount(
      id: json['id']?.toString() ?? '',
      provider: json['provider']?.toString() ?? '',
      scopes: _stringList(json['scopes']),
      status: json['status']?.toString() ?? 'active',
      email: json['email']?.toString(),
      displayName: json['display_name']?.toString(),
      expiresAt: json['expires_at']?.toString(),
      grants: grants is List
          ? grants
                .whereType<Map<String, dynamic>>()
                .map(AuthOsLinkedAccountGrant.fromJson)
                .toList(growable: false)
          : const [],
    );
  }

  final String id;
  final String provider;
  final List<String> scopes;
  final String status;
  final String? email;
  final String? displayName;
  final String? expiresAt;
  final List<AuthOsLinkedAccountGrant> grants;

  bool get active => status == 'active';
}

class AuthOsProviderDefinition {
  const AuthOsProviderDefinition({
    required this.provider,
    required this.displayName,
    required this.scopes,
    required this.connectSupported,
  });

  factory AuthOsProviderDefinition.fromJson(Map<String, dynamic> json) {
    return AuthOsProviderDefinition(
      provider: json['provider']?.toString() ?? '',
      displayName: json['display_name']?.toString() ?? '',
      scopes: _stringList(json['scopes']),
      connectSupported: json['connect_supported'] != false,
    );
  }

  final String provider;
  final String displayName;
  final List<String> scopes;
  final bool connectSupported;
}

class AuthOsLinkedAccounts {
  const AuthOsLinkedAccounts({
    required this.accounts,
    required this.availableProviders,
  });

  factory AuthOsLinkedAccounts.fromJson(Map<String, dynamic> json) {
    final accounts = json['accounts'];
    final availableProviders = json['available_providers'];
    return AuthOsLinkedAccounts(
      accounts: accounts is List
          ? accounts
                .whereType<Map<String, dynamic>>()
                .map(AuthOsLinkedAccount.fromJson)
                .toList(growable: false)
          : const [],
      availableProviders: availableProviders is List
          ? availableProviders
                .whereType<Map<String, dynamic>>()
                .map(AuthOsProviderDefinition.fromJson)
                .toList(growable: false)
          : const [],
    );
  }

  final List<AuthOsLinkedAccount> accounts;
  final List<AuthOsProviderDefinition> availableProviders;

  List<AuthOsLinkedAccount> accountsFor(AuthOsProvider provider) {
    return accounts
        .where((account) => account.active && account.provider == provider.slug)
        .toList(growable: false);
  }
}
