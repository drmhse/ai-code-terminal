class HealthStatus {
  const HealthStatus({
    required this.status,
    required this.service,
    required this.version,
  });

  factory HealthStatus.fromJson(Map<String, dynamic> json) {
    return HealthStatus(
      status: json['status']?.toString() ?? 'unknown',
      service: json['service']?.toString() ?? 'act-server',
      version: json['version']?.toString() ?? 'unknown',
    );
  }

  final String status;
  final String service;
  final String version;
}
