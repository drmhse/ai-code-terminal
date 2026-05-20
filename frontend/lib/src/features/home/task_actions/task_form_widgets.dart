part of '../act_home_page.dart';

class _TaskOption {
  const _TaskOption(this.label, this.value, this.icon);

  final String label;
  final String value;
  final IconData icon;
}

class _TaskDropdown extends StatelessWidget {
  const _TaskDropdown({
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  final String label;
  final String value;
  final List<_TaskOption> options;
  final ValueChanged<String> onChanged;

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
      onChanged: (value) {
        if (value != null) {
          onChanged(value);
        }
      },
    );
  }
}

class _AttachmentPicker extends StatelessWidget {
  const _AttachmentPicker({
    required this.attachments,
    required this.isPicking,
    required this.onPick,
    required this.onRemove,
  });

  final List<_TaskAttachmentDraft> attachments;
  final bool isPicking;
  final VoidCallback onPick;
  final ValueChanged<int> onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.raised(context),
        border: Border.all(color: AppColors.line(context)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.attach_file, size: 18),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Attachments',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              TextButton.icon(
                onPressed: isPicking ? null : onPick,
                icon: isPicking
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.add, size: 18),
                label: Text(isPicking ? 'Opening' : 'Add'),
              ),
            ],
          ),
          if (attachments.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Screenshots, logs, PDFs, repro data, or short videos.',
                style: TextStyle(
                  color: AppColors.mutedText(context),
                  fontSize: 12,
                ),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (var index = 0; index < attachments.length; index++)
                    InputChip(
                      avatar: const Icon(Icons.insert_drive_file, size: 16),
                      label: Text(
                        '${attachments[index].name} (${_formatBytes(attachments[index].byteSize)})',
                        overflow: TextOverflow.ellipsis,
                      ),
                      onDeleted: () => onRemove(index),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  String _formatBytes(int bytes) {
    if (bytes >= 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    if (bytes >= 1024) {
      return '${(bytes / 1024).toStringAsFixed(1)} KB';
    }
    return '$bytes B';
  }
}

class _RunPreview extends StatelessWidget {
  const _RunPreview({
    required this.selectedWorkspaces,
    required this.readiness,
    required this.executionMode,
    required this.approvalMode,
    required this.evidencePreference,
    required this.agentProvider,
    required this.attachmentCount,
  });

  final List<Workspace> selectedWorkspaces;
  final RunnerReadiness? readiness;
  final String executionMode;
  final String approvalMode;
  final String evidencePreference;
  final String agentProvider;
  final int attachmentCount;

  @override
  Widget build(BuildContext context) {
    final projectNames = selectedWorkspaces.isEmpty
        ? 'None selected'
        : selectedWorkspaces.map((workspace) => workspace.name).join(', ');
    final rows = [
      ('Projects', projectNames),
      ('Agent', _agentLabel(agentProvider)),
      ('Runner', readiness?.runnerMode ?? 'local_single_user'),
      ('Strategy', 'isolated worktree'),
      ('Mode', executionMode.replaceAll('_', ' ')),
      ('Approval', approvalMode.replaceAll('_', ' ')),
      ('Evidence', evidencePreference.replaceAll('_', ' ')),
      ('Attachments', attachmentCount.toString()),
      ('Report', 'summary / changes / verification / evidence / PRs / risks'),
    ];
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
              Icon(Icons.preview, size: 18, color: AppColors.accent(context)),
              const SizedBox(width: 8),
              const Text(
                'Run preview',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 8),
          for (final row in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 86,
                    child: Text(
                      row.$1,
                      style: TextStyle(
                        color: AppColors.mutedText(context),
                        fontSize: 12,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(row.$2, style: const TextStyle(fontSize: 12)),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _DialogActions extends StatelessWidget {
  const _DialogActions({required this.onSubmit});

  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.line(context))),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: FilledButton.icon(
              onPressed: onSubmit,
              icon: const Icon(Icons.add_task),
              label: const Text('Create'),
            ),
          ),
        ],
      ),
    );
  }
}
