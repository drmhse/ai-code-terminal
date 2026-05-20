part of '../codex_session_panel.dart';

class _CodexMarkdown extends StatelessWidget {
  const _CodexMarkdown({required this.data});

  final String data;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primary = AppColors.primaryText(context);
    final secondary = AppColors.secondaryText(context);
    final muted = AppColors.mutedText(context);
    final line = AppColors.line(context);
    final codeBackground = AppColors.field(context);
    final sheet = MarkdownStyleSheet.fromTheme(theme).copyWith(
      p: TextStyle(color: primary, fontSize: 12.5, height: 1.42),
      h1: TextStyle(
        color: primary,
        fontSize: 18,
        height: 1.18,
        fontWeight: FontWeight.w800,
      ),
      h2: TextStyle(
        color: primary,
        fontSize: 16,
        height: 1.22,
        fontWeight: FontWeight.w800,
      ),
      h3: TextStyle(
        color: primary,
        fontSize: 14,
        height: 1.26,
        fontWeight: FontWeight.w800,
      ),
      h4: TextStyle(
        color: primary,
        fontSize: 13,
        height: 1.28,
        fontWeight: FontWeight.w800,
      ),
      strong: TextStyle(color: primary, fontWeight: FontWeight.w800),
      em: TextStyle(color: secondary, fontStyle: FontStyle.italic),
      a: TextStyle(
        color: AppColors.accentBlue(context),
        decoration: TextDecoration.underline,
        decorationColor: AppColors.accentBlue(context),
      ),
      blockquote: TextStyle(color: secondary, fontSize: 12.5, height: 1.4),
      blockquotePadding: const EdgeInsets.fromLTRB(12, 8, 10, 8),
      blockquoteDecoration: BoxDecoration(
        color: AppColors.accent(context).withValues(alpha: 0.08),
        border: Border(
          left: BorderSide(color: AppColors.accent(context), width: 3),
        ),
      ),
      code: TextStyle(
        color: primary,
        backgroundColor: codeBackground,
        fontSize: 12,
        height: 1.35,
        fontFamily: 'monospace',
      ),
      codeblockPadding: const EdgeInsets.all(10),
      codeblockDecoration: BoxDecoration(
        color: codeBackground,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: line),
      ),
      tableHead: TextStyle(
        color: primary,
        fontSize: 12,
        fontWeight: FontWeight.w800,
      ),
      tableBody: TextStyle(color: secondary, fontSize: 12, height: 1.35),
      tableBorder: TableBorder.all(color: line),
      listBullet: TextStyle(color: muted, fontSize: 12.5, height: 1.42),
      horizontalRuleDecoration: BoxDecoration(
        border: Border(top: BorderSide(color: line)),
      ),
    );
    return MarkdownBody(
      data: data.trimRight(),
      selectable: true,
      softLineBreak: true,
      styleSheet: sheet,
      syntaxHighlighter: _CodexSyntaxHighlighter(context),
      onTapLink: (_, href, _) {
        final uri = Uri.tryParse(href ?? '');
        if (uri == null) {
          return;
        }
        unawaited(launchUrl(uri, mode: LaunchMode.externalApplication));
      },
      checkboxBuilder: (checked) => Icon(
        checked ? Icons.check_box : Icons.check_box_outline_blank,
        size: 16,
        color: checked ? AppColors.accent(context) : muted,
      ),
    );
  }
}

class _CodexSyntaxHighlighter extends SyntaxHighlighter {
  _CodexSyntaxHighlighter(this.context);

  final BuildContext context;

  @override
  TextSpan format(String source) {
    final baseStyle = TextStyle(
      color: AppColors.primaryText(context),
      fontSize: 12,
      height: 1.35,
      fontFamily: 'monospace',
    );
    final language = _guessCodexCodeLanguage(source);
    if (source.isEmpty || source.length > 60000 || language == null) {
      return TextSpan(text: source, style: baseStyle);
    }
    try {
      final result = hl.highlight.parse(source, language: language);
      final spans = _codexHighlightSpans(
        result.nodes ?? const [],
        context,
        baseStyle,
      );
      if (spans.isEmpty) {
        return TextSpan(text: source, style: baseStyle);
      }
      return TextSpan(children: spans, style: baseStyle);
    } catch (_) {
      return TextSpan(text: source, style: baseStyle);
    }
  }
}

class _CodexHighlightedCode extends StatelessWidget {
  const _CodexHighlightedCode({required this.data});

  final String data;

  @override
  Widget build(BuildContext context) {
    final source = _textLooksJson(data) ? _formatJsonForDisplay(data) : data;
    final baseStyle = TextStyle(
      color: AppColors.primaryText(context),
      fontSize: 12,
      height: 1.32,
      fontFamily: 'monospace',
    );
    return SelectableText.rich(
      _CodexSyntaxHighlighter(context).format(source.trimRight()),
      style: baseStyle,
    );
  }
}

String? _guessCodexCodeLanguage(String source) {
  final trimmed = source.trimLeft();
  final lower = trimmed.toLowerCase();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }
  if (trimmed.startsWith('diff --git') ||
      trimmed.startsWith('+++') ||
      trimmed.startsWith('---')) {
    return 'diff';
  }
  if (RegExp(r'\b(fn|let mut|impl|pub struct|use crate)::?').hasMatch(source)) {
    return 'rust';
  }
  if (RegExp(
    r'\b(final|Future<|Widget build|class \w+ extends)\b',
  ).hasMatch(source)) {
    return 'dart';
  }
  if (RegExp(r'\b(const|let|function|export default|=>)\b').hasMatch(source)) {
    return 'javascript';
  }
  if (RegExp(r'\b(def|import|from|async def|class)\b').hasMatch(source) &&
      source.contains(':')) {
    return 'python';
  }
  if (RegExp(
    r'\b(select|from|where|insert into|update|delete from)\b',
  ).hasMatch(lower)) {
    return 'sql';
  }
  if (trimmed.startsWith('<') && trimmed.contains('>')) {
    return 'xml';
  }
  if (RegExp(r'\b(display|position|color|padding|margin):').hasMatch(lower)) {
    return 'css';
  }
  if (RegExp(
    r'\b(cargo|flutter|git|npm|yarn|pnpm|cd|mkdir|rm)\b',
  ).hasMatch(lower)) {
    return 'bash';
  }
  if (RegExp(r'^\s*[\w.-]+:\s+', multiLine: true).hasMatch(source)) {
    return 'yaml';
  }
  return null;
}

List<TextSpan> _codexHighlightSpans(
  List<hl.Node> nodes,
  BuildContext context,
  TextStyle inheritedStyle,
) {
  final spans = <TextSpan>[];
  for (final node in nodes) {
    final style = inheritedStyle.merge(
      _codexHighlightStyle(node.className, context),
    );
    final value = node.value;
    if (value != null) {
      spans.add(TextSpan(text: value, style: style));
    }
    final children = node.children;
    if (children != null && children.isNotEmpty) {
      spans.addAll(_codexHighlightSpans(children, context, style));
    }
  }
  return spans;
}

TextStyle _codexHighlightStyle(String? className, BuildContext context) {
  final dark = AppColors.isDark(context);
  final name = className ?? '';
  if (name.contains('comment') || name.contains('quote')) {
    return TextStyle(color: AppColors.mutedText(context));
  }
  if (name.contains('string') ||
      name.contains('regexp') ||
      name.contains('subst')) {
    return TextStyle(
      color: dark ? const Color(0xFFF0B35B) : const Color(0xFF9A5B00),
    );
  }
  if (name.contains('number') ||
      name.contains('literal') ||
      name.contains('variable') ||
      name.contains('template-variable')) {
    return TextStyle(
      color: dark ? AppColors.success(context) : const Color(0xFF047857),
    );
  }
  if (name.contains('keyword') ||
      name.contains('selector-tag') ||
      name.contains('type')) {
    return TextStyle(
      color: dark ? AppColors.accent(context) : const Color(0xFF047857),
      fontWeight: FontWeight.w700,
    );
  }
  if (name.contains('title') ||
      name.contains('function') ||
      name.contains('section')) {
    return TextStyle(
      color: dark ? const Color(0xFF7DD3FC) : const Color(0xFF0369A1),
    );
  }
  if (name.contains('attr') ||
      name.contains('attribute') ||
      name.contains('property') ||
      name.contains('built_in') ||
      name.contains('builtin-name')) {
    return TextStyle(
      color: dark ? const Color(0xFFC4B5FD) : const Color(0xFF7C3AED),
    );
  }
  if (name.contains('meta') || name.contains('tag') || name.contains('name')) {
    return TextStyle(
      color: dark ? const Color(0xFFFCA5A5) : const Color(0xFFB91C1C),
    );
  }
  return const TextStyle();
}
