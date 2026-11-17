import 'package:flutter/foundation.dart';

class AppLogger {
  static const String _tag = 'NIH';

  static void info(String message) {
    if (!kDebugMode) return;
    debugPrint('$_tag|INFO|$message');
  }

  static void warn(String message) {
    if (!kDebugMode) return;
    debugPrint('$_tag|WARN|$message');
  }

  static void error(String message, {Object? error, StackTrace? stackTrace}) {
    if (!kDebugMode) return;
    final suffix = error != null ? ' error=$error' : '';
    debugPrint('$_tag|ERROR|$message$suffix');
    if (stackTrace != null) {
      debugPrint('$_tag|STACK|$stackTrace');
    }
  }

  static void flutterError(FlutterErrorDetails details) {
    error(
      details.exceptionAsString(),
      error: details.exception,
      stackTrace: details.stack,
    );
    FlutterError.presentError(details);
  }
}
