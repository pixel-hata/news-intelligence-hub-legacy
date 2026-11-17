import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../auth/data/auth_session.dart';
import 'news_models.dart';

class ApiException implements Exception {
  const ApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class NewsApiClient {
  NewsApiClient({required String baseUrl, http.Client? client, this.session})
    : _client = client ?? http.Client(),
      baseUrl = baseUrl.trim().replaceAll(RegExp(r'/$'), '');

  final http.Client _client;
  final String baseUrl;
  AuthSession? session;

  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    final json = await _request(
      'POST',
      '/auth/login',
      body: {'email': email, 'password': password},
      authenticated: false,
    );
    final session = AuthSession.fromJson(json);
    this.session = session;
    return session;
  }

  Future<AuthUser> me() async {
    final json = await _request('GET', '/auth/me');
    return AuthUser.fromJson(
      (json['user'] as Map?)?.cast<String, dynamic>() ??
          const <String, dynamic>{},
    );
  }

  Future<List<ArticleSummary>> fetchArticles({String query = ''}) async {
    final path = query.trim().isEmpty
        ? '/articles'
        : '/articles?q=${Uri.encodeQueryComponent(query.trim())}';
    final json = await _request('GET', path);
    return objectList(
      json['articles'],
    ).map(ArticleSummary.fromJson).toList(growable: false);
  }

  Future<List<FeedSummary>> fetchFeeds() async {
    final json = await _request('GET', '/feeds');
    return objectList(
      json['feeds'],
    ).map(FeedSummary.fromJson).toList(growable: false);
  }

  Future<List<CategorySummary>> fetchCategories() async {
    final json = await _request('GET', '/categories');
    return objectList(
      json['categories'],
    ).map(CategorySummary.fromJson).toList(growable: false);
  }

  Future<List<CategorizationAxisSummary>> fetchAxes() async {
    final json = await _request('GET', '/axes');
    return objectList(
      json['axes'],
    ).map(CategorizationAxisSummary.fromJson).toList(growable: false);
  }

  Future<ArticleDetail> fetchArticle(String id) async {
    final json = await _request('GET', '/articles/$id');
    return ArticleDetail.fromJson(json);
  }

  Future<List<EntitySummary>> fetchEntities({String query = ''}) async {
    final path = query.trim().isEmpty
        ? '/entities'
        : '/entities?q=${Uri.encodeQueryComponent(query.trim())}';
    final json = await _request('GET', path);
    return objectList(
      json['entities'],
    ).map(EntitySummary.fromJson).toList(growable: false);
  }

  Future<EntityDetail> fetchEntity(String id) async {
    final json = await _request('GET', '/entities/$id');
    return EntityDetail.fromJson(json);
  }

  Future<NewsGraph> fetchGraph({String query = ''}) async {
    final path = query.trim().isEmpty
        ? '/graph'
        : '/graph?q=${Uri.encodeQueryComponent(query.trim())}';
    final json = await _request('GET', path);
    return NewsGraph.fromJson(
      (json['graph'] as Map?)?.cast<String, dynamic>() ??
          const <String, dynamic>{},
    );
  }

  Future<List<DigestSummary>> fetchDigests() async {
    final json = await _request('GET', '/digests');
    return objectList(
      json['digests'],
    ).map(DigestSummary.fromJson).toList(growable: false);
  }

  Future<LlmTelemetrySummary> fetchTelemetry() async {
    final json = await _request('GET', '/telemetry/llm');
    return LlmTelemetrySummary.fromJson(
      (json['llm'] as Map?)?.cast<String, dynamic>() ??
          const <String, dynamic>{},
    );
  }

  Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool authenticated = true,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = <String, String>{
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      if (authenticated && session != null)
        'Authorization': 'Bearer ${session!.accessToken}',
    };

    final response = await _client.send(
      http.Request(method, uri)
        ..headers.addAll(headers)
        ..body = body == null ? '' : jsonEncode(body),
    );
    final text = await response.stream.bytesToString();

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException('API ${response.statusCode}: $text');
    }

    if (text.trim().isEmpty) {
      return const {};
    }

    final decoded = jsonDecode(text);
    if (decoded is Map<String, dynamic>) {
      return decoded;
    }
    throw const ApiException('Неочікувана відповідь API');
  }

  void dispose() => _client.close();
}
