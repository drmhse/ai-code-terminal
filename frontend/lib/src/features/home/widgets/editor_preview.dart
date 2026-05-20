// ignore_for_file: invalid_use_of_protected_member
import 'dart:ui';

import 'package:act_frontend/src/app/app_colors.dart';
import 'package:act_frontend/src/models/file_content.dart';
import 'package:act_frontend/src/models/file_item.dart';
import 'package:flutter/material.dart';
import 'package:highlight/highlight.dart' as hl;

part 'editor_preview/code_editor.dart';

class EditorPreview extends StatefulWidget {
  const EditorPreview({
    required this.file,
    required this.content,
    required this.isLoading,
    required this.isSaving,
    required this.hasUnsavedDraft,
    required this.onChanged,
    required this.onSave,
    this.onClose,
    this.closeTooltip = 'Back to files',
    super.key,
  });

  final FileItem? file;
  final FileContent? content;
  final bool isLoading;
  final bool isSaving;
  final bool hasUnsavedDraft;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSave;
  final VoidCallback? onClose;
  final String closeTooltip;

  @override
  State<EditorPreview> createState() => _EditorPreviewState();
}

class _EditorPreviewState extends State<EditorPreview> {
  final _controller = _CodeEditingController();
  UndoHistoryController _undoController = UndoHistoryController();
  final _undoStack = <String>[];
  final _redoStack = <String>[];
  String? _loadedPath;
  String _savedContent = '';
  String _lastHistoryText = '';
  bool _applyingHistory = false;

  bool get _dirty =>
      widget.hasUnsavedDraft || _controller.text != _savedContent;

  @override
  void initState() {
    super.initState();
    _loadContent(widget.content);
  }

  @override
  void didUpdateWidget(covariant EditorPreview oldWidget) {
    super.didUpdateWidget(oldWidget);
    final content = widget.content;
    if (content != null &&
        (content.path != _loadedPath ||
            content.content != oldWidget.content?.content)) {
      _loadContent(content);
    }
    if (widget.file == null && oldWidget.file != null) {
      _loadedPath = null;
      _savedContent = '';
      _controller.clear();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _undoController.dispose();
    super.dispose();
  }

  void _loadContent(FileContent? content) {
    if (content == null) {
      return;
    }
    _loadedPath = content.path;
    _savedContent = content.content;
    if (_controller.text != content.content) {
      _controller.value = TextEditingValue(
        text: content.content,
        selection: TextSelection.collapsed(offset: content.content.length),
      );
    }
    _resetUndoHistory();
  }

  void _save() {
    widget.onSave(_controller.text);
  }

  void _resetUndoHistory() {
    _undoController.dispose();
    _undoController = UndoHistoryController();
    _undoStack.clear();
    _redoStack.clear();
    _lastHistoryText = _controller.text;
  }

  void _handleEditorChanged(String value) {
    if (!_applyingHistory && value != _lastHistoryText) {
      _undoStack.add(_lastHistoryText);
      if (_undoStack.length > 100) {
        _undoStack.removeAt(0);
      }
      _redoStack.clear();
      _lastHistoryText = value;
    }
    widget.onChanged(value);
    setState(() {});
  }

  void _undoEdit() {
    if (_undoStack.isEmpty) {
      return;
    }
    final current = _controller.text;
    final previous = _undoStack.removeLast();
    _redoStack.add(current);
    _applyHistoryText(previous);
  }

  void _redoEdit() {
    if (_redoStack.isEmpty) {
      return;
    }
    final current = _controller.text;
    final next = _redoStack.removeLast();
    _undoStack.add(current);
    _applyHistoryText(next);
  }

  void _applyHistoryText(String value) {
    _applyingHistory = true;
    _controller.value = TextEditingValue(
      text: value,
      selection: TextSelection.collapsed(offset: value.length),
    );
    _lastHistoryText = value;
    _applyingHistory = false;
    widget.onChanged(value);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final file = widget.file;
    final content = widget.content;
    _controller.fileName = widget.file?.name ?? '';
    final binary = content?.isBinary == true;
    return Container(
      decoration: BoxDecoration(
        color: AppColors.page(context),
        border: Border(left: BorderSide(color: AppColors.line(context))),
      ),
      child: Column(
        children: [
          Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: AppColors.chrome(context),
              border: Border(
                bottom: BorderSide(color: AppColors.line(context)),
              ),
            ),
            child: Row(
              children: [
                if (widget.onClose != null) ...[
                  IconButton(
                    tooltip: widget.closeTooltip,
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints.tightFor(
                      width: 32,
                      height: 32,
                    ),
                    onPressed: widget.onClose,
                    icon: const Icon(Icons.arrow_back, size: 18),
                  ),
                  const SizedBox(width: 4),
                ],
                Icon(
                  binary ? Icons.data_object : Icons.description_outlined,
                  size: 18,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    file?.name ?? 'No file open',
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                if (widget.isLoading)
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else if (file != null)
                  Text(
                    _extension(file.name).toUpperCase().replaceAll('.', ''),
                    style: TextStyle(
                      color: AppColors.mutedText(context),
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                const SizedBox(width: 8),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      tooltip: 'Undo',
                      visualDensity: VisualDensity.compact,
                      onPressed: _undoStack.isEmpty ? null : _undoEdit,
                      icon: const Icon(Icons.undo, size: 18),
                    ),
                    IconButton(
                      tooltip: 'Redo',
                      visualDensity: VisualDensity.compact,
                      onPressed: _redoStack.isEmpty ? null : _redoEdit,
                      icon: const Icon(Icons.redo, size: 18),
                    ),
                  ],
                ),
                const SizedBox(width: 4),
                FilledButton.icon(
                  onPressed:
                      file == null ||
                          content == null ||
                          binary ||
                          widget.isLoading ||
                          widget.isSaving ||
                          !_dirty
                      ? null
                      : _save,
                  icon: widget.isSaving
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.save_outlined, size: 16),
                  label: Text(widget.isSaving ? 'Saving' : 'Save'),
                ),
              ],
            ),
          ),
          if (widget.isLoading) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: file == null
                ? const _EmptyEditor()
                : content == null
                ? _EditorMessage(
                    icon: Icons.hourglass_empty,
                    text: widget.isLoading ? 'Opening file...' : 'Select again',
                  )
                : binary
                ? _EditorMessage(
                    icon: Icons.lock_outline,
                    text:
                        'Binary file preview is disabled. ${content.size} bytes, ${content.encoding}.',
                  )
                : _CodeEditor(
                    controller: _controller,
                    undoController: _undoController,
                    fileName: file.name,
                    onChanged: _handleEditorChanged,
                  ),
          ),
        ],
      ),
    );
  }
}
