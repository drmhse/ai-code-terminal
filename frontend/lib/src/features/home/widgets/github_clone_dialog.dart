// ignore_for_file: invalid_use_of_protected_member
import 'dart:async';

import 'package:act_frontend/src/app/app_colors.dart';
import 'package:act_frontend/src/models/github.dart';
import 'package:act_frontend/src/models/workspace.dart';
import 'package:flutter/material.dart';

part 'github_clone_dialog/clone_widgets.dart';

Future<Workspace?> showGitHubCloneDialog({
  required BuildContext context,
  required GitHubProviderStatus status,
  required GitHubRepositoryPage initialPage,
  required Future<GitHubRepositoryPage> Function(String query, int page)
  onSearch,
  required Future<Workspace> Function(GitHubRepository repository) onClone,
}) {
  return showDialog<Workspace>(
    context: context,
    useSafeArea: false,
    builder: (context) => Dialog.fullscreen(
      backgroundColor: AppColors.page(context),
      child: _GitHubCloneScreen(
        status: status,
        initialPage: initialPage,
        onSearch: onSearch,
        onClone: onClone,
      ),
    ),
  );
}

class _GitHubCloneScreen extends StatefulWidget {
  const _GitHubCloneScreen({
    required this.status,
    required this.initialPage,
    required this.onSearch,
    required this.onClone,
  });

  final GitHubProviderStatus status;
  final GitHubRepositoryPage initialPage;
  final Future<GitHubRepositoryPage> Function(String query, int page) onSearch;
  final Future<Workspace> Function(GitHubRepository repository) onClone;

  @override
  State<_GitHubCloneScreen> createState() => _GitHubCloneScreenState();
}

class _GitHubCloneScreenState extends State<_GitHubCloneScreen> {
  final _searchController = TextEditingController();
  Timer? _searchTimer;
  String _query = '';
  bool _isSearching = false;
  bool _isLoadingMore = false;
  GitHubRepository? _cloningRepository;
  String? _error;
  String? _cloneError;
  int? _nextPage;
  int _searchEpoch = 0;
  late List<GitHubRepository> _repositories;
  final _cache = <String, GitHubRepositoryPage>{};

  @override
  void initState() {
    super.initState();
    _repositories = widget.initialPage.repositories;
    _nextPage = widget.initialPage.nextPage;
    _cache[_cacheKey('', widget.initialPage.page)] = widget.initialPage;
  }

  @override
  void dispose() {
    _searchTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _queueSearch(String value) {
    final query = value.trim();
    final localMatches = _cachedRepositoryMatches(query);
    setState(() {
      _query = query;
      if (localMatches.isNotEmpty) {
        _repositories = localMatches;
      }
      _isSearching = _cache[_cacheKey(query, 1)] == null;
      _error = null;
      _cloneError = null;
    });
    _searchTimer?.cancel();
    if (!_isSearching) {
      unawaited(_search(query, reset: true));
      return;
    }
    _searchTimer = Timer(const Duration(milliseconds: 300), () {
      unawaited(_search(query, reset: true));
    });
  }

  Future<void> _search(String query, {required bool reset}) async {
    final epoch = reset ? ++_searchEpoch : _searchEpoch;
    try {
      final requestedPage = reset ? 1 : _nextPage ?? 1;
      final cacheKey = _cacheKey(query, requestedPage);
      final cached = _cache[cacheKey];
      final page = cached ?? await widget.onSearch(query, requestedPage);
      _cache[cacheKey] = page;
      if (!mounted || query != _query || epoch != _searchEpoch) {
        return;
      }
      setState(() {
        _repositories = reset
            ? page.repositories
            : [..._repositories, ...page.repositories];
        _nextPage = page.nextPage;
        _isSearching = false;
        _isLoadingMore = false;
        _error = null;
      });
    } catch (_) {
      if (!mounted || query != _query || epoch != _searchEpoch) {
        return;
      }
      setState(() {
        _isSearching = false;
        _isLoadingMore = false;
        _error = 'Could not load repositories';
      });
    }
  }

  void _loadMore() {
    if (_nextPage == null || _isLoadingMore || _isSearching) {
      return;
    }
    setState(() => _isLoadingMore = true);
    unawaited(_search(_query, reset: false));
  }

  List<GitHubRepository> _cachedRepositoryMatches(String query) {
    final normalized = query.toLowerCase();
    if (normalized.isEmpty) {
      return _cache[_cacheKey('', 1)]?.repositories ??
          widget.initialPage.repositories;
    }
    final terms = normalized
        .split(RegExp(r'\s+'))
        .where((term) => term.isNotEmpty);
    final byId = <int, GitHubRepository>{};
    for (final page in _cache.values) {
      for (final repository in page.repositories) {
        final haystack = [
          repository.name,
          repository.fullName,
          repository.description ?? '',
          repository.language ?? '',
        ].join('\n').toLowerCase();
        if (terms.every(haystack.contains)) {
          byId[repository.id] = repository;
        }
      }
    }
    return byId.values.take(80).toList(growable: false);
  }

  Future<void> _cloneRepository(GitHubRepository repository) async {
    if (_cloningRepository != null) {
      return;
    }
    if (!repository.canRead) {
      setState(() {
        _cloneError = 'Read access is required to clone ${repository.fullName}';
      });
      return;
    }
    setState(() {
      _cloningRepository = repository;
      _cloneError = null;
    });
    try {
      final workspace = await widget.onClone(repository);
      if (!mounted) {
        return;
      }
      Navigator.of(context).pop(workspace);
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _cloningRepository = null;
        _cloneError = 'Could not clone ${repository.fullName}';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 560;
    final cloningRepository = _cloningRepository;
    return SafeArea(
      child: Column(
        children: [
          _CloneTopBar(
            connected: widget.status.available && widget.status.hasAccessToken,
            controller: _searchController,
            enabled: cloningRepository == null,
            onSearchChanged: _queueSearch,
            onClose: cloningRepository == null
                ? () => Navigator.of(context).pop()
                : null,
          ),
          Expanded(
            child: ClipRect(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  compact ? 14 : 22,
                  10,
                  compact ? 14 : 22,
                  0,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _RepositoryStatusLine(
                      isSearching: _isSearching,
                      error: _error ?? _cloneError,
                      repositoryCount: _repositories.length,
                      hasMore: _nextPage != null,
                    ),
                    if (cloningRepository != null) ...[
                      const SizedBox(height: 10),
                      _CloneProgress(repository: cloningRepository),
                    ],
                    const SizedBox(height: 8),
                    Expanded(
                      child: _repositories.isEmpty
                          ? const Center(child: Text('No repositories found'))
                          : ListView.separated(
                              padding: EdgeInsets.zero,
                              cacheExtent: 520,
                              addAutomaticKeepAlives: false,
                              addRepaintBoundaries: true,
                              itemCount:
                                  _repositories.length +
                                  (_nextPage == null ? 0 : 1),
                              separatorBuilder: (_, _) => Divider(
                                height: 1,
                                color: AppColors.line(context),
                              ),
                              itemBuilder: (context, index) {
                                if (index == _repositories.length) {
                                  return Padding(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 14,
                                    ),
                                    child: Center(
                                      child: OutlinedButton.icon(
                                        onPressed:
                                            _isLoadingMore ||
                                                cloningRepository != null
                                            ? null
                                            : _loadMore,
                                        icon: _isLoadingMore
                                            ? const SizedBox(
                                                width: 16,
                                                height: 16,
                                                child:
                                                    CircularProgressIndicator(
                                                      strokeWidth: 2,
                                                    ),
                                              )
                                            : const Icon(Icons.expand_more),
                                        label: const Text('Load more'),
                                      ),
                                    ),
                                  );
                                }
                                final repository = _repositories[index];
                                return KeyedSubtree(
                                  key: ValueKey('github-repo-${repository.id}'),
                                  child: _RepositoryTile(
                                    repository: repository,
                                    disabled:
                                        _isSearching ||
                                        cloningRepository != null ||
                                        !repository.canRead,
                                    cloning:
                                        cloningRepository?.id == repository.id,
                                    onTap: () => _cloneRepository(repository),
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
