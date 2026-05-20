class DeploymentConfig {
  const DeploymentConfig({
    required this.deploymentMode,
    required this.actPublicUrl,
    required this.authOsBaseUrl,
    required this.authOsOrgSlug,
    required this.authOsServiceSlug,
    required this.authOsClientId,
    required this.requiredGitHubScopes,
    required this.nativeRedirectUri,
    required this.webCallbackUri,
    this.authOsDashboardUrl,
  });

  factory DeploymentConfig.fromJson(Map<String, dynamic> json) {
    return DeploymentConfig(
      deploymentMode: json['deployment_mode']?.toString() ?? '',
      actPublicUrl: json['act_public_url']?.toString() ?? '',
      authOsBaseUrl: json['authos_base_url']?.toString() ?? '',
      authOsDashboardUrl: json['authos_dashboard_url']?.toString(),
      authOsOrgSlug: json['authos_org_slug']?.toString() ?? '',
      authOsServiceSlug: json['authos_service_slug']?.toString() ?? '',
      authOsClientId: json['authos_client_id']?.toString() ?? '',
      requiredGitHubScopes:
          (json['required_github_scopes'] as List? ?? const [])
              .map((scope) => scope.toString())
              .where((scope) => scope.isNotEmpty)
              .toList(growable: false),
      nativeRedirectUri: json['native_redirect_uri']?.toString() ?? '',
      webCallbackUri: json['web_callback_uri']?.toString() ?? '',
    );
  }

  final String deploymentMode;
  final String actPublicUrl;
  final String authOsBaseUrl;
  final String? authOsDashboardUrl;
  final String authOsOrgSlug;
  final String authOsServiceSlug;
  final String authOsClientId;
  final List<String> requiredGitHubScopes;
  final String nativeRedirectUri;
  final String webCallbackUri;
}
