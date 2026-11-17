import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nih_mobile/main.dart';

void main() {
  testWidgets('login screen submits demo credentials', (tester) async {
    var submittedEmail = '';
    var submittedPassword = '';

    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(
          apiBaseUrl: 'http://10.0.2.2:3000/api',
          message: '',
          onLogin: (email, password) async {
            submittedEmail = email;
            submittedPassword = password;
          },
        ),
      ),
    );

    await tester.tap(find.text('Увійти'));
    await tester.pump();

    expect(submittedEmail, 'demo@example.com');
    expect(submittedPassword, 'demo-password');
  });
}
