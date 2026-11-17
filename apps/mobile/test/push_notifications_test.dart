import 'package:flutter_test/flutter_test.dart';
import 'package:nih_mobile/core/push/push_notifications.dart';
import 'package:nih_mobile/features/auth/data/auth_session.dart';

void main() {
  test('push notification service is wired as an explicit stub', () async {
    final push = PushNotifications(enabled: true);
    final state = await push.initialize(
      const AuthSession(
        accessToken: 'token-1',
        user: AuthUser(
          id: 'user-1',
          email: 'demo@example.com',
          emailConfirmed: true,
        ),
      ),
    );

    expect(state.enabled, isTrue);
    expect(state.status, contains('заглушка'));
  });
}
