part of '../act_home_page.dart';

class _CodexDiffBlock extends StatelessWidget {
  const _CodexDiffBlock({required this.title, required this.text});

  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    final diffLines = _parsePreviewDiff(text);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            color: AppColors.primaryText(context),
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        if (diffLines.any((line) => line.type != _PreviewDiffLineType.plain))
          _CodexDiffViewer(lines: diffLines)
        else
          _CodexPlainDiffText(text: text),
      ],
    );
  }
}

class _CodexDiffViewer extends StatelessWidget {
  const _CodexDiffViewer({required this.lines});

  final List<_PreviewDiffLine> lines;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.field(context),
          border: Border.all(color: AppColors.line(context)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: lines.map((line) => _CodexDiffLineRow(line: line)).toList(),
        ),
      ),
    );
  }
}

class _CodexDiffLineRow extends StatelessWidget {
  const _CodexDiffLineRow({required this.line});

  final _PreviewDiffLine line;

  @override
  Widget build(BuildContext context) {
    final colors = _diffLineColors(context, line.type);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.background,
        border: Border(
          left: BorderSide(color: colors.rail, width: line.changed ? 3 : 0),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.fromLTRB(4, 4, 8, 4),
            color: colors.gutter,
            child: Text(
              line.lineNumberLabel,
              style: TextStyle(
                color: colors.lineNumber,
                fontFamily: 'monospace',
                fontSize: 10,
                height: 1.35,
              ),
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 4, 8, 4),
              child: SelectableText(
                line.content,
                style: TextStyle(
                  color: colors.text,
                  fontFamily: 'monospace',
                  fontSize: 11,
                  height: 1.35,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CodexPlainDiffText extends StatelessWidget {
  const _CodexPlainDiffText({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.field(context),
        border: Border.all(color: AppColors.line(context)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: SelectableText(
        text,
        style: TextStyle(
          color: AppColors.secondaryText(context),
          fontFamily: 'monospace',
          fontSize: 11,
          height: 1.35,
        ),
      ),
    );
  }
}

class _PreviewDiffLine {
  const _PreviewDiffLine({
    required this.content,
    required this.type,
    this.oldLineNumber,
    this.newLineNumber,
  });

  final String content;
  final _PreviewDiffLineType type;
  final int? oldLineNumber;
  final int? newLineNumber;

  bool get changed {
    return type == _PreviewDiffLineType.added ||
        type == _PreviewDiffLineType.removed;
  }

  String get lineNumberLabel {
    if (type == _PreviewDiffLineType.header ||
        type == _PreviewDiffLineType.file ||
        type == _PreviewDiffLineType.section) {
      return '';
    }
    return (type == _PreviewDiffLineType.added ? newLineNumber : oldLineNumber)
            ?.toString() ??
        '';
  }
}

enum _PreviewDiffLineType {
  added,
  removed,
  unchanged,
  header,
  file,
  section,
  plain,
}

class _CodexDiffLineColors {
  const _CodexDiffLineColors({
    required this.background,
    required this.gutter,
    required this.rail,
    required this.lineNumber,
    required this.text,
  });

  final Color background;
  final Color gutter;
  final Color rail;
  final Color lineNumber;
  final Color text;
}

List<_PreviewDiffLine> _parsePreviewDiff(String text) {
  final lines = text.split('\n');
  final parsed = <_PreviewDiffLine>[];
  var oldLine = 0;
  var newLine = 0;

  for (final raw in lines) {
    if (raw.startsWith('@@')) {
      final match = RegExp(r'@@ -(\d+),?\d* \+(\d+),?\d* @@').firstMatch(raw);
      if (match != null) {
        oldLine = int.tryParse(match.group(1) ?? '') ?? oldLine;
        newLine = int.tryParse(match.group(2) ?? '') ?? newLine;
      }
      parsed.add(
        _PreviewDiffLine(content: raw, type: _PreviewDiffLineType.header),
      );
      continue;
    }
    if (raw.startsWith('## ')) {
      parsed.add(
        _PreviewDiffLine(content: raw, type: _PreviewDiffLineType.section),
      );
      continue;
    }
    if (raw.startsWith('diff --git') ||
        raw.startsWith('index ') ||
        raw.startsWith('--- ') ||
        raw.startsWith('+++ ')) {
      parsed.add(
        _PreviewDiffLine(content: raw, type: _PreviewDiffLineType.file),
      );
      continue;
    }
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      parsed.add(
        _PreviewDiffLine(
          content: raw,
          type: _PreviewDiffLineType.added,
          newLineNumber: newLine,
        ),
      );
      newLine++;
      continue;
    }
    if (raw.startsWith('-') && !raw.startsWith('---')) {
      parsed.add(
        _PreviewDiffLine(
          content: raw,
          type: _PreviewDiffLineType.removed,
          oldLineNumber: oldLine,
        ),
      );
      oldLine++;
      continue;
    }
    if (raw.isNotEmpty && (oldLine > 0 || newLine > 0)) {
      parsed.add(
        _PreviewDiffLine(
          content: raw,
          type: _PreviewDiffLineType.unchanged,
          oldLineNumber: oldLine,
          newLineNumber: newLine,
        ),
      );
      oldLine++;
      newLine++;
      continue;
    }
    parsed.add(
      _PreviewDiffLine(content: raw, type: _PreviewDiffLineType.plain),
    );
  }
  return parsed;
}

_CodexDiffLineColors _diffLineColors(
  BuildContext context,
  _PreviewDiffLineType type,
) {
  final dark = Theme.of(context).brightness == Brightness.dark;
  final muted = AppColors.mutedText(context);
  final secondary = AppColors.secondaryText(context);
  final field = AppColors.field(context);
  final addedBg = dark ? const Color(0xFF112D1F) : const Color(0xFFE6FFEC);
  final removedBg = dark ? const Color(0xFF3D1111) : const Color(0xFFFFE7E7);
  final addedLine = dark ? const Color(0xFF27C93F) : const Color(0xFF1F883D);
  final removedLine = dark ? const Color(0xFFFF5F56) : const Color(0xFFCF222E);
  final headerBg = dark
      ? AppColors.chrome(context).withValues(alpha: 0.42)
      : Colors.black.withValues(alpha: 0.035);
  final gutter = dark
      ? Colors.black.withValues(alpha: 0.10)
      : Colors.black.withValues(alpha: 0.025);

  switch (type) {
    case _PreviewDiffLineType.added:
      return _CodexDiffLineColors(
        background: addedBg,
        gutter: gutter,
        rail: addedLine,
        lineNumber: addedLine,
        text: addedLine,
      );
    case _PreviewDiffLineType.removed:
      return _CodexDiffLineColors(
        background: removedBg,
        gutter: gutter,
        rail: removedLine,
        lineNumber: removedLine,
        text: removedLine,
      );
    case _PreviewDiffLineType.header:
      return _CodexDiffLineColors(
        background: headerBg,
        gutter: headerBg,
        rail: Colors.transparent,
        lineNumber: muted.withValues(alpha: 0.55),
        text: muted.withValues(alpha: 0.82),
      );
    case _PreviewDiffLineType.file:
    case _PreviewDiffLineType.section:
      return _CodexDiffLineColors(
        background: AppColors.chrome(context).withValues(alpha: 0.32),
        gutter: AppColors.chrome(context).withValues(alpha: 0.32),
        rail: Colors.transparent,
        lineNumber: muted.withValues(alpha: 0.45),
        text: AppColors.primaryText(context),
      );
    case _PreviewDiffLineType.unchanged:
    case _PreviewDiffLineType.plain:
      return _CodexDiffLineColors(
        background: field,
        gutter: gutter,
        rail: Colors.transparent,
        lineNumber: muted.withValues(alpha: 0.58),
        text: secondary,
      );
  }
}
