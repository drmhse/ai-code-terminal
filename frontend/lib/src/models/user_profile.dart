class UserProfile {
  const UserProfile({
    required this.email,
    required this.plan,
    this.accessRole = 'user',
    this.isOperator = false,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      email: json['email']?.toString() ?? '',
      plan: json['plan']?.toString() ?? 'unknown',
      accessRole: json['access_role']?.toString() ?? 'user',
      isOperator: json['is_operator'] == true,
    );
  }

  final String email;
  final String plan;
  final String accessRole;
  final bool isOperator;
}
