import 'dart:async';

import 'package:flutter/material.dart';

import 'core/app_config.dart';
import 'core/log/app_logger.dart';
import 'core/push/push_notifications.dart';
import 'features/auth/data/auth_session.dart';
import 'features/auth/data/session_store.dart';
import 'features/news/data/news_api_client.dart';
import 'features/news/data/news_models.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  FlutterError.onError = AppLogger.flutterError;
  runApp(const NihMobileApp());
}

class NihMobileApp extends StatefulWidget {
  const NihMobileApp({
    super.key,
    NewsApiClient? client,
    SessionStore? sessionStore,
    PushNotifications? pushNotifications,
  }) : _client = client,
       _sessionStore = sessionStore,
       _pushNotifications = pushNotifications;

  final NewsApiClient? _client;
  final SessionStore? _sessionStore;
  final PushNotifications? _pushNotifications;

  @override
  State<NihMobileApp> createState() => _NihMobileAppState();
}

class _NihMobileAppState extends State<NihMobileApp> {
  late final NewsApiClient _client =
      widget._client ?? NewsApiClient(baseUrl: AppConfig.apiBaseUrl);
  late final SessionStore _sessionStore =
      widget._sessionStore ?? SessionStore();
  late final PushNotifications _pushNotifications =
      widget._pushNotifications ??
      PushNotifications(enabled: AppConfig.enablePushStub);
  AuthSession? _session;
  PushRegistrationState _pushState = const PushRegistrationState(
    enabled: false,
    status: 'не ініціалізовано',
  );
  bool _loading = true;
  String _message = '';

  @override
  void initState() {
    super.initState();
    unawaited(_bootstrap());
  }

  Future<void> _bootstrap() async {
    try {
      final saved = await _sessionStore.load();
      if (saved != null) {
        _client.session = saved;
        final user = await _client.me();
        final refreshed = AuthSession(
          accessToken: saved.accessToken,
          user: user,
        );
        final pushState = await _pushNotifications.initialize(refreshed);
        if (!mounted) return;
        setState(() {
          _session = refreshed;
          _pushState = pushState;
        });
      }
    } catch (error, stackTrace) {
      AppLogger.warn('Saved session bootstrap failed: $error');
      AppLogger.error(
        'Session bootstrap stack',
        error: error,
        stackTrace: stackTrace,
      );
      await _sessionStore.clear();
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _handleLogin(String email, String password) async {
    setState(() {
      _message = '';
      _loading = true;
    });
    try {
      final session = await _client.login(email: email, password: password);
      await _sessionStore.save(session);
      final pushState = await _pushNotifications.initialize(session);
      if (!mounted) return;
      setState(() {
        _session = session;
        _pushState = pushState;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _message = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _handleLogout() async {
    await _sessionStore.clear();
    await _pushNotifications.dispose();
    _client.session = null;
    if (!mounted) return;
    setState(() {
      _session = null;
      _pushState = _pushNotifications.state;
      _message = '';
    });
  }

  @override
  void dispose() {
    _client.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Центр новинної аналітики',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff2563eb)),
        useMaterial3: true,
      ),
      home: _loading
          ? const LoadingScreen()
          : _session == null
          ? LoginScreen(
              apiBaseUrl: _client.baseUrl,
              message: _message,
              onLogin: _handleLogin,
            )
          : MobileHomeScreen(
              client: _client,
              onLogout: _handleLogout,
              pushState: _pushState,
              session: _session!,
            ),
    );
  }
}

class LoadingScreen extends StatelessWidget {
  const LoadingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    required this.apiBaseUrl,
    required this.message,
    required this.onLogin,
    super.key,
  });

  final String apiBaseUrl;
  final String message;
  final Future<void> Function(String email, String password) onLogin;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _email = TextEditingController(
    text: 'demo@example.com',
  );
  final TextEditingController _password = TextEditingController(
    text: 'demo-password',
  );
  bool _submitting = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
    });
    try {
      await widget.onLogin(_email.text, _password.text);
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const SizedBox(height: 24),
            Text(
              'UA-SKILLS',
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: Colors.blueGrey,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Центр новинної аналітики',
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              widget.apiBaseUrl,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 28),
            TextField(
              controller: _email,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                labelText: 'Email',
              ),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                labelText: 'Пароль',
              ),
              obscureText: true,
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: _submitting
                  ? const SizedBox.square(
                      dimension: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.login),
              label: const Text('Увійти'),
            ),
            if (widget.message.isNotEmpty) ...[
              const SizedBox(height: 16),
              ErrorBanner(message: widget.message),
            ],
          ],
        ),
      ),
    );
  }
}

class MobileHomeScreen extends StatefulWidget {
  const MobileHomeScreen({
    required this.client,
    required this.onLogout,
    required this.pushState,
    required this.session,
    super.key,
  });

  final NewsApiClient client;
  final Future<void> Function() onLogout;
  final PushRegistrationState pushState;
  final AuthSession session;

  @override
  State<MobileHomeScreen> createState() => _MobileHomeScreenState();
}

class _MobileHomeScreenState extends State<MobileHomeScreen> {
  int _tab = 0;
  bool _loading = true;
  String _message = '';
  String _articleQuery = '';
  String _graphQuery = '';
  List<ArticleSummary> _articles = const [];
  List<EntitySummary> _entities = const [];
  List<FeedSummary> _feeds = const [];
  List<CategorySummary> _categories = const [];
  List<CategorizationAxisSummary> _axes = const [];
  NewsGraph _graph = const NewsGraph(nodes: [], edges: []);
  List<DigestSummary> _digests = const [];
  LlmTelemetrySummary? _telemetry;

  @override
  void initState() {
    super.initState();
    unawaited(_refreshAll());
  }

  Future<void> _refreshAll() async {
    setState(() {
      _loading = true;
      _message = '';
    });
    try {
      final results = await Future.wait<dynamic>([
        widget.client.fetchArticles(query: _articleQuery),
        widget.client.fetchEntities(),
        widget.client.fetchGraph(query: _graphQuery),
        widget.client.fetchDigests(),
        widget.client.fetchFeeds(),
        widget.client.fetchCategories(),
        widget.client.fetchAxes(),
        widget.client.fetchTelemetry(),
      ]);
      if (!mounted) return;
      setState(() {
        _articles = results[0] as List<ArticleSummary>;
        _entities = results[1] as List<EntitySummary>;
        _graph = results[2] as NewsGraph;
        _digests = results[3] as List<DigestSummary>;
        _feeds = results[4] as List<FeedSummary>;
        _categories = results[5] as List<CategorySummary>;
        _axes = results[6] as List<CategorizationAxisSummary>;
        _telemetry = results[7] as LlmTelemetrySummary;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _message = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      FeedTab(
        articles: _articles,
        digests: _digests,
        entities: _entities,
        feeds: _feeds,
        onOpen: _openArticle,
        onQueryChanged: (value) => _articleQuery = value,
        onRefresh: _refreshAll,
      ),
      GraphTab(
        graph: _graph,
        onEntityOpen: _openEntity,
        onQueryChanged: (value) => _graphQuery = value,
        onRefresh: _refreshAll,
      ),
      DigestTab(digests: _digests, onRefresh: _refreshAll),
      HubTab(
        apiBaseUrl: widget.client.baseUrl,
        axes: _axes,
        categories: _categories,
        feeds: _feeds,
        onLogout: widget.onLogout,
        pushState: widget.pushState,
        session: widget.session,
        telemetry: _telemetry,
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Центр новинної аналітики'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _refreshAll,
            tooltip: 'Оновити',
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (_message.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                child: ErrorBanner(message: _message),
              ),
            if (_loading) const LinearProgressIndicator(),
            Expanded(child: pages[_tab]),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (index) {
          setState(() {
            _tab = index;
          });
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.article_outlined),
            selectedIcon: Icon(Icons.article),
            label: 'Стрічка',
          ),
          NavigationDestination(
            icon: Icon(Icons.hub_outlined),
            selectedIcon: Icon(Icons.hub),
            label: 'Граф',
          ),
          NavigationDestination(
            icon: Icon(Icons.summarize_outlined),
            selectedIcon: Icon(Icons.summarize),
            label: 'Дайджести',
          ),
          NavigationDestination(
            icon: Icon(Icons.insights_outlined),
            selectedIcon: Icon(Icons.insights),
            label: 'Хаб',
          ),
        ],
      ),
    );
  }

  Future<void> _openArticle(ArticleSummary article) async {
    final detail = await widget.client.fetchArticle(article.id);
    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ArticleDetailScreen(detail: detail)),
    );
  }

  Future<void> _openEntity(String id) async {
    final detail = await widget.client.fetchEntity(id);
    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => EntityDetailScreen(detail: detail)),
    );
  }
}

class FeedTab extends StatelessWidget {
  const FeedTab({
    required this.articles,
    required this.digests,
    required this.entities,
    required this.feeds,
    required this.onOpen,
    required this.onQueryChanged,
    required this.onRefresh,
    super.key,
  });

  final List<ArticleSummary> articles;
  final List<DigestSummary> digests;
  final List<EntitySummary> entities;
  final List<FeedSummary> feeds;
  final Future<void> Function(ArticleSummary article) onOpen;
  final ValueChanged<String> onQueryChanged;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          MetricGrid(
            metrics: {
              'Статті': articles.length.toString(),
              'Фіди': feeds.length.toString(),
              'Сутності': entities.length.toString(),
              'Дайджести': digests.length.toString(),
            },
          ),
          const SizedBox(height: 12),
          SearchCard(
            hintText: 'Пошук статей',
            onChanged: onQueryChanged,
            onSearch: onRefresh,
          ),
          const SizedBox(height: 12),
          if (articles.isEmpty)
            const EmptyState(icon: Icons.article_outlined, title: 'Статей немає')
          else
            ...articles.map(
              (article) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: ArticleCard(
                  article: article,
                  onTap: () => onOpen(article),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class ArticleCard extends StatelessWidget {
  const ArticleCard({required this.article, required this.onTap, super.key});

  final ArticleSummary article;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final source = hostFromUrl(article.sourceUrl);
    return OutlinedCard(
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  StatusChip(label: articleStatusLabel(article.status)),
                  if (article.importance != null)
                    StatusChip(label: articleImportanceLabel(article.importance!)),
                  if (article.similarCount > 0)
                    StatusChip(label: '${article.similarCount} схожих'),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                article.title,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 6),
              Text(
                [
                  if (source.isNotEmpty) source,
                  if (article.publishedAt != null)
                    shortDate(article.publishedAt),
                ].join(' | '),
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if (article.summary != null) ...[
                const SizedBox(height: 8),
                Text(
                  article.summary!,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  ...article.categories
                      .take(3)
                      .map((category) => StatusChip(label: category.name)),
                  ...article.entities
                      .take(4)
                      .map((entity) => StatusChip(label: entity.name)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ArticleDetailScreen extends StatelessWidget {
  const ArticleDetailScreen({required this.detail, super.key});

  final ArticleDetail detail;

  @override
  Widget build(BuildContext context) {
    final article = detail.article;
    return Scaffold(
      appBar: AppBar(title: const Text('Стаття')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            article.title,
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(hostFromUrl(article.sourceUrl)),
          if (article.publishedAt != null) Text(shortDate(article.publishedAt)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              StatusChip(label: articleStatusLabel(article.status)),
              if (article.importance != null)
                StatusChip(label: articleImportanceLabel(article.importance!)),
              if (article.similarCount > 0)
                StatusChip(label: '${article.similarCount} схожих'),
            ],
          ),
          if (article.summary != null) ...[
            const SizedBox(height: 16),
            Text(article.summary!),
          ],
          const SizedBox(height: 16),
          SectionTitle('Категорії'),
          ChipWrap(labels: article.categories.map((category) => category.name)),
          const SizedBox(height: 16),
          SectionTitle('Осі'),
          ChipWrap(labels: article.axisLabels.map((label) => label.name)),
          const SizedBox(height: 16),
          SectionTitle('Сутності'),
          ChipWrap(labels: article.entities.map((entity) => entity.name)),
          const SizedBox(height: 16),
          SectionTitle('Схожі статті'),
          if (detail.similarArticles.isEmpty)
            const Text('Немає')
          else
            ...detail.similarArticles.map(
              (similar) => ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(similar.title),
                subtitle: Text(hostFromUrl(similar.sourceUrl)),
              ),
            ),
        ],
      ),
    );
  }
}

class GraphTab extends StatelessWidget {
  const GraphTab({
    required this.graph,
    required this.onEntityOpen,
    required this.onQueryChanged,
    required this.onRefresh,
    super.key,
  });

  final NewsGraph graph;
  final Future<void> Function(String id) onEntityOpen;
  final ValueChanged<String> onQueryChanged;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final nodeById = {for (final node in graph.nodes) node.id: node};
    final entityNodes = graph.nodes
        .where((node) => node.type == 'entity')
        .toList(growable: false);
    final degreeByNode = <String, int>{};
    for (final edge in graph.edges) {
      degreeByNode[edge.source] =
          (degreeByNode[edge.source] ?? 0) + edge.weight;
      degreeByNode[edge.target] =
          (degreeByNode[edge.target] ?? 0) + edge.weight;
    }
    final topEntityNodes = [...entityNodes]
      ..sort(
        (left, right) =>
            (degreeByNode[right.id] ?? 0).compareTo(degreeByNode[left.id] ?? 0),
      );
    final topEdges = [...graph.edges]
      ..sort((left, right) => right.weight.compareTo(left.weight));

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          SearchCard(
            hintText: 'Пошук у графі',
            onChanged: onQueryChanged,
            onSearch: onRefresh,
          ),
          const SizedBox(height: 12),
          MetricGrid(
            metrics: {
              'Ноди': graph.nodes.length.toString(),
              'Ребра': graph.edges.length.toString(),
              'Сутності': entityNodes.length.toString(),
            },
          ),
          const SizedBox(height: 16),
          SectionTitle('Топ сутностей'),
          if (topEntityNodes.isEmpty)
            const EmptyState(icon: Icons.hub_outlined, title: 'Сутностей немає')
          else
            ...topEntityNodes
                .take(20)
                .map(
                  (node) => OutlinedListTile(
                    icon: Icons.circle_outlined,
                    title: node.label,
                    subtitle: '${degreeByNode[node.id] ?? 0} звʼязків',
                    onTap: () => onEntityOpen(node.id),
                  ),
                ),
          const SizedBox(height: 16),
          SectionTitle('Найсильніші звʼязки'),
          if (topEdges.isEmpty)
            const Text('Немає')
          else
            ...topEdges
                .take(25)
                .map(
                  (edge) => OutlinedListTile(
                    icon: Icons.commit_outlined,
                    title: edgeTypeLabel(edge.type),
                    subtitle:
                        '${nodeById[edge.source]?.label ?? edge.source} -> ${nodeById[edge.target]?.label ?? edge.target}',
                    trailing: edge.weight.toString(),
                  ),
                ),
        ],
      ),
    );
  }
}

class EntityDetailScreen extends StatelessWidget {
  const EntityDetailScreen({required this.detail, super.key});

  final EntityDetail detail;

  @override
  Widget build(BuildContext context) {
    final entity = detail.entity;
    return Scaffold(
      appBar: AppBar(title: const Text('Сутність')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            entity.name,
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              StatusChip(label: entityTypeLabel(entity.type)),
              if (entity.firstSeen != null)
                StatusChip(
                  label: 'перша згадка ${dateFromSeconds(entity.firstSeen!)}',
                ),
              if (entity.lastSeen != null)
                StatusChip(label: 'остання згадка ${dateFromSeconds(entity.lastSeen!)}'),
            ],
          ),
          if (entity.description != null) ...[
            const SizedBox(height: 16),
            Text(entity.description!),
          ],
          if (entity.aliases.isNotEmpty) ...[
            const SizedBox(height: 16),
            SectionTitle('Аліаси'),
            ChipWrap(labels: entity.aliases),
          ],
          const SizedBox(height: 16),
          SectionTitle('Повʼязані сутності'),
          if (detail.relatedEntities.isEmpty)
            const Text('Немає')
          else
            ...detail.relatedEntities.map(
              (related) => OutlinedListTile(
                icon: Icons.link_outlined,
                title: related.entity.name,
                subtitle: entityTypeLabel(related.entity.type),
                trailing: related.count.toString(),
              ),
            ),
          const SizedBox(height: 16),
          SectionTitle('Активність'),
          if (detail.activity.isEmpty)
            const Text('Немає')
          else
            ChipWrap(
              labels: detail.activity.map(
                (point) => '${point.date}: ${point.count}',
              ),
            ),
          const SizedBox(height: 16),
          SectionTitle('Статті зі згадками'),
          ...detail.mentioningArticles.map(
            (article) => ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(article.title),
              subtitle: Text(hostFromUrl(article.sourceUrl)),
            ),
          ),
        ],
      ),
    );
  }
}

class DigestTab extends StatelessWidget {
  const DigestTab({required this.digests, required this.onRefresh, super.key});

  final List<DigestSummary> digests;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          MetricGrid(metrics: {'Дайджести': digests.length.toString()}),
          const SizedBox(height: 12),
          if (digests.isEmpty)
            const EmptyState(
              icon: Icons.summarize_outlined,
              title: 'Дайджестів немає',
            )
          else
            ...digests.map(
              (digest) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: DigestCard(digest: digest),
              ),
            ),
        ],
      ),
    );
  }
}

class DigestCard extends StatelessWidget {
  const DigestCard({required this.digest, super.key});

  final DigestSummary digest;

  @override
  Widget build(BuildContext context) {
    return OutlinedCard(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              digest.title,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              '${shortDate(digest.periodStart)} - ${shortDate(digest.periodEnd)}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (digest.scopeLabel != null) ...[
              const SizedBox(height: 6),
              Text(digest.scopeLabel!),
            ],
            const SizedBox(height: 10),
            Text(digest.summary),
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                if (digest.articleCount != null)
                  StatusChip(label: '${digest.articleCount} статей'),
                ...digest.topEntities
                    .take(4)
                    .map(
                      (item) => StatusChip(label: '${item.name} ${item.count}'),
                    ),
                ...digest.topCategories
                    .take(3)
                    .map(
                      (item) => StatusChip(label: '${item.name} ${item.count}'),
                    ),
              ],
            ),
            if (digest.keyArticles.isNotEmpty) ...[
              const SizedBox(height: 12),
              SectionTitle('Ключові статті'),
              ...digest.keyArticles
                  .take(4)
                  .map(
                    (article) => Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        article.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
            ],
          ],
        ),
      ),
    );
  }
}

class HubTab extends StatelessWidget {
  const HubTab({
    required this.apiBaseUrl,
    required this.axes,
    required this.categories,
    required this.feeds,
    required this.onLogout,
    required this.pushState,
    required this.session,
    required this.telemetry,
    super.key,
  });

  final String apiBaseUrl;
  final List<CategorizationAxisSummary> axes;
  final List<CategorySummary> categories;
  final List<FeedSummary> feeds;
  final Future<void> Function() onLogout;
  final PushRegistrationState pushState;
  final AuthSession session;
  final LlmTelemetrySummary? telemetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        SectionTitle('Акаунт'),
        OutlinedListTile(
          icon: Icons.person,
          title: session.user.email,
          subtitle: session.user.displayName ?? session.user.id,
          trailing: session.user.emailConfirmed ? 'підтверджено' : 'очікує',
        ),
        const SizedBox(height: 16),
        SectionTitle('API'),
        OutlinedCard(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Text(apiBaseUrl),
          ),
        ),
        const SizedBox(height: 16),
        SectionTitle('Фіди'),
        if (feeds.isEmpty)
          const Text('Немає')
        else
          ...feeds.map((feed) => FeedConfigCard(feed: feed)),
        const SizedBox(height: 16),
        SectionTitle('Категорії'),
        if (categories.isEmpty)
          const Text('Немає')
        else
          ...categories.map(
            (category) => CategoryConfigCard(category: category),
          ),
        const SizedBox(height: 16),
        SectionTitle('Осі'),
        if (axes.isEmpty)
          const Text('Немає')
        else
          ...axes.map((axis) => AxisConfigCard(axis: axis)),
        const SizedBox(height: 16),
        SectionTitle('LLM-телеметрія'),
        TelemetryPanel(telemetry: telemetry),
        const SizedBox(height: 16),
        SectionTitle('Push'),
        OutlinedListTile(
          icon: pushState.enabled
              ? Icons.notifications_active_outlined
              : Icons.notifications_off_outlined,
          title: pushState.enabled ? 'Заглушку налаштовано' : 'Вимкнено',
          subtitle: pushState.status,
        ),
        const SizedBox(height: 20),
        OutlinedButton.icon(
          onPressed: onLogout,
          icon: const Icon(Icons.logout),
          label: const Text('Вийти'),
        ),
      ],
    );
  }
}

class FeedConfigCard extends StatelessWidget {
  const FeedConfigCard({required this.feed, super.key});

  final FeedSummary feed;

  @override
  Widget build(BuildContext context) {
    return OutlinedCard(
      margin: const EdgeInsets.only(top: 8),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    feed.title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                StatusChip(label: feedStatusLabel(feed.status)),
              ],
            ),
            const SizedBox(height: 6),
            Text(feed.url, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 6),
            Text('Кожні ${feed.pollingIntervalMinutes} хв'),
            if (feed.lastPolledAt != null) Text(shortDate(feed.lastPolledAt)),
            if (feed.lastError != null) ...[
              const SizedBox(height: 6),
              Text(
                feed.lastError!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class CategoryConfigCard extends StatelessWidget {
  const CategoryConfigCard({required this.category, super.key});

  final CategorySummary category;

  @override
  Widget build(BuildContext context) {
    return OutlinedCard(
      margin: const EdgeInsets.only(top: 8),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CategoryDot(color: category.color),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    category.name,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            if (category.description != null) ...[
              const SizedBox(height: 8),
              Text(category.description!),
            ],
            if (category.ruleText != null) ...[
              const SizedBox(height: 8),
              Text(category.ruleText!),
            ],
            if (category.includeKeywords.isNotEmpty) ...[
              const SizedBox(height: 10),
              ChipWrap(labels: category.includeKeywords.take(8)),
            ],
            if (category.excludeKeywords.isNotEmpty) ...[
              const SizedBox(height: 10),
              ChipWrap(
                labels: category.excludeKeywords
                    .take(8)
                    .map((value) => '-$value'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class AxisConfigCard extends StatelessWidget {
  const AxisConfigCard({required this.axis, super.key});

  final CategorizationAxisSummary axis;

  @override
  Widget build(BuildContext context) {
    return OutlinedCard(
      margin: const EdgeInsets.only(top: 8),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    axis.name,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                StatusChip(label: axis.isActive ? 'активна' : 'неактивна'),
              ],
            ),
            if (axis.description != null) ...[
              const SizedBox(height: 8),
              Text(axis.description!),
            ],
            if (axis.labels.isNotEmpty) ...[
              const SizedBox(height: 10),
              ChipWrap(labels: axis.labels.map((label) => label.name)),
            ],
          ],
        ),
      ),
    );
  }
}

class TelemetryPanel extends StatelessWidget {
  const TelemetryPanel({required this.telemetry, super.key});

  final LlmTelemetrySummary? telemetry;

  @override
  Widget build(BuildContext context) {
    final value = telemetry;
    if (value == null) {
      return const OutlinedCard(
        child: Padding(padding: EdgeInsets.all(14), child: Text('Не завантажено')),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        MetricGrid(
          metrics: {
            'Виклики': value.totalCalls.toString(),
            'Токени': value.totalTokens.toString(),
            'Кеш': value.cacheHits.toString(),
            'USD': formatUsd(value.estimatedCostUsd),
          },
        ),
        if (value.byProvider.isNotEmpty) ...[
          const SizedBox(height: 10),
          ...value.byProvider.map(
            (provider) => OutlinedListTile(
              icon: Icons.memory_outlined,
              title: provider.provider,
              subtitle:
                  '${provider.callCount} викликів | ${provider.totalTokens} токенів',
              trailing: formatUsd(provider.estimatedCostUsd),
            ),
          ),
        ],
        if (value.byTask.isNotEmpty) ...[
          const SizedBox(height: 10),
          ...value.byTask
              .take(4)
              .map(
                (task) => OutlinedListTile(
                  icon: Icons.insights_outlined,
                  title: task.task,
                  subtitle:
                      '${task.callCount} викликів | ${task.totalTokens} токенів',
                  trailing: formatUsd(task.estimatedCostUsd),
                ),
              ),
        ],
      ],
    );
  }
}

class SearchCard extends StatelessWidget {
  const SearchCard({
    required this.hintText,
    required this.onChanged,
    required this.onSearch,
    super.key,
  });

  final String hintText;
  final ValueChanged<String> onChanged;
  final Future<void> Function() onSearch;

  @override
  Widget build(BuildContext context) {
    return OutlinedCard(
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                decoration: InputDecoration(
                  border: const OutlineInputBorder(),
                  hintText: hintText,
                  isDense: true,
                ),
                onChanged: onChanged,
                onSubmitted: (_) => onSearch(),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filledTonal(
              onPressed: onSearch,
              tooltip: 'Пошук',
              icon: const Icon(Icons.search),
            ),
          ],
        ),
      ),
    );
  }
}

class MetricGrid extends StatelessWidget {
  const MetricGrid({required this.metrics, super.key});

  final Map<String, String> metrics;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth < 460 ? 2 : 3;
        final width = (constraints.maxWidth - (columns - 1) * 8) / columns;
        return Wrap(
          spacing: 8,
          runSpacing: 8,
          children: metrics.entries
              .map(
                (entry) => SizedBox(
                  width: width,
                  child: OutlinedCard(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            entry.key,
                            style: Theme.of(context).textTheme.labelMedium,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            entry.value,
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              )
              .toList(growable: false),
        );
      },
    );
  }
}

class OutlinedListTile extends StatelessWidget {
  const OutlinedListTile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    super.key,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final String? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedCard(
      margin: const EdgeInsets.only(top: 8),
      child: ListTile(
        leading: Icon(icon),
        title: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis),
        subtitle: subtitle == null
            ? null
            : Text(subtitle!, maxLines: 2, overflow: TextOverflow.ellipsis),
        trailing: trailing == null ? null : Text(trailing!),
        onTap: onTap,
      ),
    );
  }
}

class OutlinedCard extends StatelessWidget {
  const OutlinedCard({
    required this.child,
    this.margin = EdgeInsets.zero,
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: margin,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: Theme.of(context).dividerColor),
      ),
      child: child,
    );
  }
}

class ChipWrap extends StatelessWidget {
  const ChipWrap({required this.labels, super.key});

  final Iterable<String> labels;

  @override
  Widget build(BuildContext context) {
    final items = labels
        .map((label) => label.trim())
        .where((label) => label.isNotEmpty)
        .toList(growable: false);
    if (items.isEmpty) {
      return const Text('Немає');
    }

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: items.map((label) => StatusChip(label: label)).toList(),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(
        context,
      ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip({required this.label, super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Chip(label: Text(label), visualDensity: VisualDensity.compact);
  }
}

class CategoryDot extends StatelessWidget {
  const CategoryDot({required this.color, super.key});

  final String color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 12,
      height: 12,
      decoration: BoxDecoration(
        color: colorFromHex(color),
        borderRadius: BorderRadius.circular(6),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({required this.icon, required this.title, super.key});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          Icon(icon, size: 36, color: Theme.of(context).colorScheme.outline),
          const SizedBox(height: 8),
          Text(title),
        ],
      ),
    );
  }
}

class ErrorBanner extends StatelessWidget {
  const ErrorBanner({required this.message, super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.errorContainer,
      borderRadius: BorderRadius.circular(8),
      child: Padding(padding: const EdgeInsets.all(12), child: Text(message)),
    );
  }
}

String shortDate(String? value) {
  if (value == null || value.trim().isEmpty) {
    return '';
  }
  final parsed = DateTime.tryParse(value);
  if (parsed == null) {
    return value;
  }
  final local = parsed.toLocal();
  return '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')}';
}

String dateFromSeconds(int seconds) {
  final parsed = DateTime.fromMillisecondsSinceEpoch(seconds * 1000);
  return shortDate(parsed.toIso8601String());
}

String hostFromUrl(String value) {
  final uri = Uri.tryParse(value);
  return uri?.host.isNotEmpty == true ? uri!.host : value;
}

String articleStatusLabel(String status) {
  switch (status) {
    case 'discovered':
      return 'знайдено';
    case 'filtered':
      return 'відфільтровано';
    case 'queued':
      return 'у черзі';
    case 'processing':
      return 'обробляється';
    case 'processed':
      return 'оброблено';
    case 'failed':
      return 'помилка';
    default:
      return status;
  }
}

String articleImportanceLabel(String importance) {
  switch (importance) {
    case 'high':
      return 'важлива';
    case 'normal':
      return 'нормальна';
    case 'junk':
      return 'сміття';
    default:
      return importance;
  }
}

String feedStatusLabel(String status) {
  switch (status) {
    case 'active':
      return 'активний';
    case 'paused':
      return 'на паузі';
    case 'error':
      return 'помилка';
    default:
      return status;
  }
}

String entityTypeLabel(String type) {
  switch (type.toLowerCase()) {
    case 'person':
      return 'персона';
    case 'company':
      return 'компанія';
    case 'product':
      return 'продукт';
    case 'technology':
      return 'технологія';
    case 'location':
      return 'локація';
    case 'other':
      return 'інше';
    default:
      return type;
  }
}

String edgeTypeLabel(String type) {
  switch (type) {
    case 'mentions':
      return 'Стаття згадує сутність';
    case 'co_mention':
      return 'Сутності згадуються разом';
    case 'similar':
      return 'Схожі статті';
    default:
      return type;
  }
}

String formatUsd(double value) => value.toStringAsFixed(6);

Color colorFromHex(String value) {
  final normalized = value.trim().replaceFirst('#', '');
  if (normalized.length != 6) {
    return const Color(0xff2563eb);
  }
  final parsed = int.tryParse('ff$normalized', radix: 16);
  return parsed == null ? const Color(0xff2563eb) : Color(parsed);
}
