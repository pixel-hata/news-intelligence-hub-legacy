import '../../features/auth/data/auth_session.dart';
import '../log/app_logger.dart';

class PushRegistrationState {
  const PushRegistrationState({required this.enabled, required this.status});

  final bool enabled;
  final String status;
}

class PushNotifications {
  PushNotifications({required bool enabled}) : _enabled = enabled;

  final bool _enabled;
  PushRegistrationState _state = const PushRegistrationState(
    enabled: false,
    status: 'не ініціалізовано',
  );

  PushRegistrationState get state => _state;

  Future<PushRegistrationState> initialize(AuthSession session) async {
    if (!_enabled) {
      _state = const PushRegistrationState(
        enabled: false,
        status: 'вимкнено прапорцем збірки',
      );
      return _state;
    }

    AppLogger.info('Push stub initialized for ${session.user.email}');
    _state = const PushRegistrationState(
      enabled: true,
      status: 'заглушка: провайдер токенів ще не підключено',
    );
    return _state;
  }

  Future<void> dispose() async {
    _state = const PushRegistrationState(
      enabled: false,
      status: 'не ініціалізовано',
    );
  }
}
