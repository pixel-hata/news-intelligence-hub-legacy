class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.emailConfirmed,
    this.displayName,
  });

  final String id;
  final String email;
  final bool emailConfirmed;
  final String? displayName;

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
    id: json['id']?.toString() ?? '',
    email: json['email']?.toString() ?? '',
    emailConfirmed: json['emailConfirmed'] == true,
    displayName: json['displayName']?.toString(),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'emailConfirmed': emailConfirmed,
    if (displayName != null) 'displayName': displayName,
  };
}

class AuthSession {
  const AuthSession({required this.accessToken, required this.user});

  final String accessToken;
  final AuthUser user;

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
    accessToken: json['accessToken']?.toString() ?? '',
    user: AuthUser.fromJson(
      (json['user'] as Map?)?.cast<String, dynamic>() ??
          const <String, dynamic>{},
    ),
  );

  Map<String, dynamic> toJson() => {
    'accessToken': accessToken,
    'user': user.toJson(),
  };
}
