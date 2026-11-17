class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'NIH_API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api',
  );

  static const bool enablePushStub = bool.fromEnvironment(
    'NIH_ENABLE_PUSH_STUB',
    defaultValue: true,
  );
}
