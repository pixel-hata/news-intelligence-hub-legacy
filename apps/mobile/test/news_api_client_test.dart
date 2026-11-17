import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nih_mobile/features/auth/data/auth_session.dart';
import 'package:nih_mobile/features/news/data/news_api_client.dart';

void main() {
  test('login stores session and later requests use bearer token', () async {
    final requests = <http.Request>[];
    final client = MockClient((request) async {
      requests.add(request);
      if (request.url.path.endsWith('/auth/login')) {
        return http.Response(
          jsonEncode({
            'accessToken': 'token-1',
            'user': {
              'id': 'user-1',
              'email': 'demo@example.com',
              'emailConfirmed': true,
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }

      return http.Response(
        jsonEncode({
          'articles': [
            {
              'id': 'article-1',
              'title': 'AI infrastructure update',
              'sourceUrl': 'https://example.com/a',
              'status': 'processed',
              'categories': [],
              'axisLabels': [],
              'entities': [],
              'similarCount': 0,
            },
          ],
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    });

    final api = NewsApiClient(
      baseUrl: 'https://example.com/api',
      client: client,
    );

    final session = await api.login(
      email: 'demo@example.com',
      password: 'demo-password',
    );
    final articles = await api.fetchArticles();

    expect(session.accessToken, 'token-1');
    expect(articles.single.title, 'AI infrastructure update');
    expect(requests.last.headers['Authorization'], 'Bearer token-1');
  });

  test(
    'mobile hub endpoints are read-only and parse backend summaries',
    () async {
      final requests = <http.Request>[];
      final client = MockClient((request) async {
        requests.add(request);
        final path = request.url.path;

        if (path.endsWith('/feeds')) {
          return jsonResponse({
            'feeds': [
              {
                'id': 'feed-1',
                'title': 'Tech News',
                'url': 'https://example.com/feed.xml',
                'status': 'active',
                'pollingIntervalMinutes': 60,
                'lastPolledAt': '2026-06-06T10:00:00.000Z',
              },
            ],
          });
        }

        if (path.endsWith('/categories')) {
          return jsonResponse({
            'categories': [
              {
                'id': 'cat-1',
                'name': 'AI Infrastructure',
                'color': '#2563eb',
                'ruleText': 'Match AI infrastructure coverage',
                'includeKeywords': ['inference'],
                'excludeKeywords': ['coupon'],
              },
            ],
          });
        }

        if (path.endsWith('/axes')) {
          return jsonResponse({
            'axes': [
              {
                'id': 'axis-1',
                'name': 'Content type',
                'prompt': 'Classify content type',
                'sortOrder': 10,
                'isActive': true,
                'labels': [
                  {'id': 'label-1', 'name': 'news', 'sortOrder': 10},
                ],
              },
            ],
          });
        }

        if (path.endsWith('/telemetry/llm')) {
          return jsonResponse({
            'llm': {
              'totalCalls': 2,
              'totalTokens': 1200,
              'cacheHits': 1,
              'estimatedCostUsd': 0.001234,
              'byProvider': [
                {
                  'provider': 'mock',
                  'callCount': 2,
                  'totalTokens': 1200,
                  'estimatedCostUsd': 0.001234,
                },
              ],
              'byTask': [],
              'recentCalls': [],
            },
          });
        }

        if (path.endsWith('/digests')) {
          return jsonResponse({
            'digests': [
              {
                'id': 'digest-1',
                'title': 'Weekly AI digest',
                'summary': 'Key updates.',
                'periodStart': '2026-06-01T00:00:00.000Z',
                'periodEnd': '2026-06-06T00:00:00.000Z',
                'articleCount': 5,
                'scopeLabel': 'category:AI Infrastructure',
                'topEntities': [
                  {'name': 'OpenAI', 'count': 3},
                ],
                'topCategories': [
                  {'name': 'AI Infrastructure', 'count': 5},
                ],
                'keyArticles': [
                  {'id': 'article-1', 'title': 'Inference update'},
                ],
              },
            ],
          });
        }

        if (path.endsWith('/entities/entity-1')) {
          return jsonResponse({
            'entity': {
              'id': 'entity-1',
              'name': 'OpenAI',
              'type': 'company',
              'aliases': [],
            },
            'mentioningArticles': [],
            'relatedEntities': [
              {
                'count': 2,
                'entity': {
                  'id': 'entity-2',
                  'name': 'Azure',
                  'type': 'technology',
                  'aliases': [],
                },
              },
            ],
            'activity': [
              {'date': '2026-06-06', 'count': 2},
            ],
          });
        }

        return jsonResponse({});
      });

      final api = NewsApiClient(
        baseUrl: 'https://example.com/api',
        client: client,
        session: const AuthSession(
          accessToken: 'token-1',
          user: AuthUser(
            id: 'user-1',
            email: 'demo@example.com',
            emailConfirmed: true,
          ),
        ),
      );

      expect((await api.fetchFeeds()).single.status, 'active');
      expect((await api.fetchCategories()).single.includeKeywords, [
        'inference',
      ]);
      expect((await api.fetchAxes()).single.labels.single.name, 'news');
      expect((await api.fetchTelemetry()).estimatedCostUsd, 0.001234);
      expect(
        (await api.fetchDigests()).single.topEntities.single.name,
        'OpenAI',
      );
      expect(
        (await api.fetchEntity('entity-1')).relatedEntities.single.count,
        2,
      );
      expect(requests.map((request) => request.method).toSet(), {'GET'});
    },
  );
}

http.Response jsonResponse(Map<String, dynamic> body) => http.Response(
  jsonEncode(body),
  200,
  headers: {'content-type': 'application/json'},
);
