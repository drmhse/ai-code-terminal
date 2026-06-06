part of '../editor_preview.dart';

class _CodeEditingController extends TextEditingController {
  String fileName = '';

  @override
  TextSpan buildTextSpan({
    required BuildContext context,
    TextStyle? style,
    required bool withComposing,
  }) {
    final baseStyle = style ?? TextStyle(color: AppColors.primaryText(context));
    final spans = _highlight(text, fileName, context, baseStyle);

    if (!withComposing || !value.composing.isValid) {
      return TextSpan(style: baseStyle, children: spans);
    }

    final composing = value.composing;
    final before = text.substring(0, composing.start);
    final active = text.substring(composing.start, composing.end);
    final after = text.substring(composing.end);
    return TextSpan(
      style: baseStyle,
      children: [
        ..._highlight(before, fileName, context, baseStyle),
        TextSpan(
          text: active,
          style: baseStyle.merge(
            const TextStyle(decoration: TextDecoration.underline),
          ),
        ),
        ..._highlight(after, fileName, context, baseStyle),
      ],
    );
  }
}

class _CodeEditor extends StatelessWidget {
  const _CodeEditor({
    required this.controller,
    required this.undoController,
    required this.fileName,
    required this.onChanged,
  });

  final _CodeEditingController controller;
  final UndoHistoryController undoController;
  final String fileName;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final codeStyle = TextStyle(
      color: AppColors.primaryText(context),
      fontFamily: 'monospace',
      fontSize: 13,
      height: 1.45,
      letterSpacing: 0,
    );
    return Container(
      key: const ValueKey('code-editor-surface'),
      color: AppColors.field(context),
      child: TextField(
        key: const ValueKey('code-editor-field'),
        controller: controller,
        undoController: undoController,
        onChanged: onChanged,
        expands: true,
        minLines: null,
        maxLines: null,
        keyboardType: TextInputType.multiline,
        textInputAction: TextInputAction.newline,
        autocorrect: false,
        enableSuggestions: false,
        spellCheckConfiguration: SpellCheckConfiguration.disabled(),
        smartDashesType: SmartDashesType.disabled,
        smartQuotesType: SmartQuotesType.disabled,
        style: codeStyle,
        cursorColor: AppColors.accent(context),
        selectionControls: materialTextSelectionControls,
        decoration: InputDecoration(
          filled: false,
          fillColor: Colors.transparent,
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          disabledBorder: InputBorder.none,
          contentPadding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
          hintText: 'File is empty',
          hintStyle: TextStyle(color: AppColors.mutedText(context)),
          isCollapsed: false,
        ),
        selectionHeightStyle: BoxHeightStyle.tight,
        selectionWidthStyle: BoxWidthStyle.tight,
        contextMenuBuilder: (context, editableTextState) {
          return AdaptiveTextSelectionToolbar.editableText(
            editableTextState: editableTextState,
          );
        },
      ),
    );
  }
}

class _EditorMessage extends StatelessWidget {
  const _EditorMessage({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: AppColors.mutedText(context), size: 42),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Text(
              text,
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.secondaryText(context)),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyEditor extends StatelessWidget {
  const _EmptyEditor();

  @override
  Widget build(BuildContext context) {
    return const _EditorMessage(
      icon: Icons.article_outlined,
      text: 'Open a file from the file browser',
    );
  }
}

List<TextSpan> _highlight(
  String source,
  String fileName,
  BuildContext context,
  TextStyle baseStyle,
) {
  final language = _highlightLanguage(fileName);
  if (source.isEmpty || language == null || source.length > 220000) {
    return [TextSpan(text: source, style: baseStyle)];
  }

  try {
    final result = hl.highlight.parse(source, language: language);
    final spans = _spansFromNodes(result.nodes ?? const [], context, baseStyle);
    if (spans.isEmpty) {
      return [TextSpan(text: source, style: baseStyle)];
    }
    return spans;
  } catch (_) {
    return [TextSpan(text: source, style: baseStyle)];
  }
}

List<TextSpan> _spansFromNodes(
  List<hl.Node> nodes,
  BuildContext context,
  TextStyle inheritedStyle,
) {
  final spans = <TextSpan>[];
  for (final node in nodes) {
    final style = inheritedStyle.merge(_styleForClass(node.className, context));
    final value = node.value;
    if (value != null) {
      spans.add(TextSpan(text: value, style: style));
    }
    final children = node.children;
    if (children != null && children.isNotEmpty) {
      spans.addAll(_spansFromNodes(children, context, style));
    }
  }
  return spans;
}

TextStyle _styleForClass(String? className, BuildContext context) {
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

String? _highlightLanguage(String fileName) {
  final ext = _extension(fileName);
  return const {
        '.bash': 'bash',
        '.c': 'c',
        '.cc': 'cpp',
        '.cpp': 'cpp',
        '.cs': 'cs',
        '.css': 'css',
        '.dart': 'dart',
        '.dockerfile': 'dockerfile',
        '.go': 'go',
        '.h': 'cpp',
        '.html': 'xml',
        '.java': 'java',
        '.js': 'javascript',
        '.json': 'json',
        '.jsx': 'javascript',
        '.kt': 'kotlin',
        '.kts': 'kotlin',
        '.md': 'markdown',
        '.php': 'php',
        '.py': 'python',
        '.rb': 'ruby',
        '.rs': 'rust',
        '.sh': 'bash',
        '.sql': 'sql',
        '.swift': 'swift',
        '.toml': 'toml',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.vue': 'vue',
        '.xml': 'xml',
        '.yaml': 'yaml',
        '.yml': 'yaml',
      }[ext] ??
      switch (fileName.toLowerCase()) {
        'dockerfile' => 'dockerfile',
        'makefile' => 'makefile',
        _ => null,
      };
}

String _extension(String fileName) {
  final dot = fileName.lastIndexOf('.');
  return dot == -1 ? '' : fileName.substring(dot).toLowerCase();
}
