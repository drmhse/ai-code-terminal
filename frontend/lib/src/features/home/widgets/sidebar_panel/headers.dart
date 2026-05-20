part of '../sidebar_panel.dart';
// ignore_for_file: invalid_use_of_protected_member

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    required this.icon,
    this.onPressed,
    this.secondaryIcon,
    this.onSecondaryPressed,
    this.secondaryBusy = false,
    this.tertiaryIcon,
    this.onTertiaryPressed,
  });

  final String title;
  final IconData icon;
  final VoidCallback? onPressed;
  final IconData? secondaryIcon;
  final VoidCallback? onSecondaryPressed;
  final bool secondaryBusy;
  final IconData? tertiaryIcon;
  final VoidCallback? onTertiaryPressed;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 14, 8, 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title.toUpperCase(),
              style: TextStyle(
                color: AppColors.mutedText(context),
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          if (secondaryIcon != null)
            IconButton(
              tooltip: secondaryBusy ? 'Opening GitHub' : 'Clone from GitHub',
              icon: secondaryBusy
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(secondaryIcon, size: 18),
              onPressed: onSecondaryPressed,
            ),
          if (tertiaryIcon != null)
            IconButton(
              tooltip: 'Manage collections',
              icon: Icon(tertiaryIcon, size: 18),
              onPressed: onTertiaryPressed,
            ),
          IconButton(
            tooltip: title,
            icon: Icon(icon, size: 18),
            onPressed: onPressed,
          ),
        ],
      ),
    );
  }
}

class _FilesHeader extends StatelessWidget {
  const _FilesHeader({
    required this.query,
    required this.isIndexing,
    required this.onChanged,
  });

  final String query;
  final bool isIndexing;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 10, 10, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'FILES',
                  style: TextStyle(
                    color: AppColors.mutedText(context),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (isIndexing)
                SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.mutedText(context),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          _FileSearchField(query: query, onChanged: onChanged),
        ],
      ),
    );
  }
}

class _FileSearchField extends StatefulWidget {
  const _FileSearchField({required this.query, required this.onChanged});

  final String query;
  final ValueChanged<String>? onChanged;

  @override
  State<_FileSearchField> createState() => _FileSearchFieldState();
}

class _FileSearchFieldState extends State<_FileSearchField> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.query);
  }

  @override
  void didUpdateWidget(covariant _FileSearchField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.query != _controller.text) {
      _controller.value = TextEditingValue(
        text: widget.query,
        selection: TextSelection.collapsed(offset: widget.query.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 38,
      child: TextField(
        key: const ValueKey('file-search-field'),
        controller: _controller,
        onChanged: (value) {
          setState(() {});
          widget.onChanged?.call(value);
        },
        autocorrect: false,
        enableSuggestions: false,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: 'Search files',
          prefixIcon: const Icon(Icons.search, size: 18),
          suffixIcon: _controller.text.isEmpty
              ? null
              : IconButton(
                  tooltip: 'Clear file search',
                  onPressed: () {
                    _controller.clear();
                    setState(() {});
                    widget.onChanged?.call('');
                  },
                  icon: const Icon(Icons.close, size: 16),
                ),
          isDense: true,
          filled: true,
          fillColor: AppColors.field(context),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: AppColors.line(context)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: AppColors.line(context)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: AppColors.accent(context)),
          ),
        ),
      ),
    );
  }
}
