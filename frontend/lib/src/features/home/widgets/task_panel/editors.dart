part of '../task_panel.dart';

class _TaskEditOption {
  const _TaskEditOption(this.label, this.value, this.icon);

  final String label;
  final String value;
  final IconData icon;
}

class _TaskEditDropdown extends StatelessWidget {
  const _TaskEditDropdown({
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  final String label;
  final String value;
  final List<_TaskEditOption> options;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      decoration: InputDecoration(labelText: label),
      items: options
          .map(
            (option) => DropdownMenuItem<String>(
              value: option.value,
              child: Row(
                children: [
                  Icon(option.icon, size: 18),
                  const SizedBox(width: 8),
                  Text(option.label, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          )
          .toList(growable: false),
      onChanged: onChanged == null
          ? null
          : (value) {
              if (value != null) {
                onChanged!(value);
              }
            },
    );
  }
}

class _TaskDetailSection extends StatelessWidget {
  const _TaskDetailSection({
    required this.title,
    required this.icon,
    required this.children,
  });

  final String title;
  final IconData icon;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.line(context)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.accent(context), size: 18),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
            ],
          ),
          const SizedBox(height: 8),
          ...children,
        ],
      ),
    );
  }
}

class _TaskMarkdown extends StatelessWidget {
  const _TaskMarkdown({required this.data});

  final String data;

  @override
  Widget build(BuildContext context) {
    return MarkdownBody(
      data: data.trimRight(),
      selectable: true,
      styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
        p: TextStyle(
          color: AppColors.primaryText(context),
          fontSize: 12.5,
          height: 1.38,
        ),
        h1: TextStyle(
          color: AppColors.primaryText(context),
          fontSize: 17,
          fontWeight: FontWeight.w800,
        ),
        h2: TextStyle(
          color: AppColors.primaryText(context),
          fontSize: 15,
          fontWeight: FontWeight.w800,
        ),
        code: TextStyle(
          color: AppColors.primaryText(context),
          backgroundColor: AppColors.field(context),
          fontFamily: 'monospace',
          fontSize: 12,
        ),
        codeblockDecoration: BoxDecoration(
          color: AppColors.field(context),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.line(context)),
        ),
        codeblockPadding: const EdgeInsets.all(10),
      ),
    );
  }
}
