part of '../act_home_page.dart';
// ignore_for_file: invalid_use_of_protected_member

class _CreateTaskDialog extends StatefulWidget {
  const _CreateTaskDialog({
    required this.workspace,
    required this.workspaces,
    required this.collections,
    required this.selectedCollection,
    required this.readiness,
    required this.initialAgentProvider,
    required this.initialProviderModel,
    required this.initialProviderThinkingLevel,
  });

  final Workspace? workspace;
  final List<Workspace> workspaces;
  final List<WorkspaceCollection> collections;
  final WorkspaceCollection? selectedCollection;
  final RunnerReadiness? readiness;
  final String initialAgentProvider;
  final String initialProviderModel;
  final String initialProviderThinkingLevel;

  @override
  State<_CreateTaskDialog> createState() => _CreateTaskDialogState();
}

class _CreateTaskDialogState extends State<_CreateTaskDialog> {
  static const _maxAttachmentBytes = 100 * 1024 * 1024;

  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _reportController = TextEditingController();
  final _attachments = <_TaskAttachmentDraft>[];
  late Set<String> _selectedWorkspaceIds;
  late Set<String> _selectedCollectionIds;

  String _executionMode = 'implement';
  String _approvalMode = 'ask_before_edits';
  String _evidencePreference = 'tests_plus_screenshots';
  late String _agentProvider;
  String? _titleError;
  String? _workspaceError;
  bool _isPickingAttachment = false;

  @override
  void initState() {
    super.initState();
    _agentProvider = widget.initialAgentProvider;
    _selectedWorkspaceIds = {
      if (widget.workspace != null) widget.workspace!.id,
    };
    _selectedCollectionIds = {
      if (widget.selectedCollection != null) widget.selectedCollection!.id,
    };
    for (final collection in widget.collections) {
      if (_selectedCollectionIds.contains(collection.id)) {
        _selectedWorkspaceIds.addAll(
          collection.members.map((member) => member.workspaceId),
        );
      }
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _reportController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final isMobile = size.width < 760;
    final topSafeArea = MediaQuery.viewPaddingOf(context).top;
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final availableHeight = math.max(
      320.0,
      size.height - bottomInset - topSafeArea - 24,
    );
    final dialogHeight = math.min(availableHeight, 720.0);
    final form = _formChildren();

    if (isMobile) {
      return Scaffold(
        resizeToAvoidBottomInset: true,
        backgroundColor: AppColors.chrome(context),
        appBar: AppBar(
          automaticallyImplyLeading: false,
          backgroundColor: AppColors.chrome(context),
          foregroundColor: AppColors.primaryText(context),
          elevation: 0,
          titleSpacing: 12,
          title: Row(
            children: [
              Icon(Icons.task_alt, color: AppColors.accent(context)),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'New ACT task',
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
          actions: [
            IconButton(
              tooltip: 'Close',
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.close),
            ),
          ],
        ),
        body: SafeArea(
          top: false,
          child: ListView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            children: form,
          ),
        ),
        bottomNavigationBar: AnimatedPadding(
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOut,
          padding: EdgeInsets.only(bottom: bottomInset),
          child: SafeArea(top: false, child: _DialogActions(onSubmit: _submit)),
        ),
      );
    }

    return Align(
      alignment: Alignment.topCenter,
      child: Padding(
        padding: EdgeInsets.fromLTRB(12, 12, 12, 12 + bottomInset),
        child: Dialog(
          insetPadding: EdgeInsets.zero,
          backgroundColor: AppColors.chrome(context),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          child: SizedBox(
            width: math.min(size.width - 24, 560),
            height: dialogHeight,
            child: Column(
              mainAxisSize: MainAxisSize.max,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _DialogHeader(onClose: () => Navigator.pop(context)),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: form,
                    ),
                  ),
                ),
                _DialogActions(onSubmit: _submit),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _formChildren() {
    final selectedWorkspaces = _selectedWorkspaces();
    return [
      _WorkspacePicker(
        collections: widget.collections,
        selectedCollectionIds: _selectedCollectionIds,
        workspaces: _availableWorkspaces(),
        selectedWorkspaceIds: _selectedWorkspaceIds,
        errorText: _workspaceError,
        onToggled: _toggleWorkspace,
        onCollectionToggled: _toggleCollection,
      ),
      const SizedBox(height: 12),
      TextField(
        key: const ValueKey('create-task-title-field'),
        controller: _titleController,
        autofocus: true,
        textInputAction: TextInputAction.next,
        decoration: InputDecoration(labelText: 'Title', errorText: _titleError),
        onChanged: (_) {
          if (_titleError != null) {
            setState(() => _titleError = null);
          }
        },
      ),
      const SizedBox(height: 12),
      TextField(
        controller: _descriptionController,
        minLines: 4,
        maxLines: 8,
        textInputAction: TextInputAction.newline,
        decoration: const InputDecoration(
          labelText: 'Issue description',
          alignLabelWithHint: true,
        ),
      ),
      const SizedBox(height: 12),
      TextField(
        controller: _reportController,
        minLines: 3,
        maxLines: 6,
        textInputAction: TextInputAction.newline,
        decoration: const InputDecoration(
          labelText: 'Final report instructions',
          alignLabelWithHint: true,
        ),
      ),
      const SizedBox(height: 12),
      _TaskDropdown(
        label: 'Agent',
        value: _agentProvider,
        options: const [
          _TaskOption('Codex', 'codex', Icons.auto_awesome),
          _TaskOption('Pi', 'pi', Icons.hub_outlined),
        ],
        onChanged: (value) => setState(() => _agentProvider = value),
      ),
      const SizedBox(height: 10),
      _TaskDropdown(
        label: 'Execution mode',
        value: _executionMode,
        options: const [
          _TaskOption('Plan only', 'plan', Icons.fact_check),
          _TaskOption('Research report', 'research', Icons.manage_search),
          _TaskOption('Implement', 'implement', Icons.build),
          _TaskOption('Implement and PR', 'implement_and_pr', Icons.call_merge),
        ],
        onChanged: _setExecutionMode,
      ),
      const SizedBox(height: 10),
      _TaskDropdown(
        label: 'Approval mode',
        value: _approvalMode,
        options: const [
          _TaskOption('Ask before edits', 'ask_before_edits', Icons.rule),
          _TaskOption('Auto edit', 'auto_edit', Icons.edit),
          _TaskOption(
            'Auto edit and create PR',
            'auto_edit_and_create_pr',
            Icons.playlist_add_check,
          ),
        ],
        onChanged: (value) => setState(() => _approvalMode = value),
      ),
      const SizedBox(height: 10),
      _TaskDropdown(
        label: 'Evidence',
        value: _evidencePreference,
        options: const [
          _TaskOption('Tests only', 'tests_only', Icons.science),
          _TaskOption(
            'Tests plus screenshots',
            'tests_plus_screenshots',
            Icons.screenshot_monitor,
          ),
          _TaskOption('Full evidence', 'full_evidence', Icons.inventory_2),
        ],
        onChanged: (value) => setState(() => _evidencePreference = value),
      ),
      const SizedBox(height: 14),
      _AttachmentPicker(
        attachments: _attachments,
        isPicking: _isPickingAttachment,
        onPick: _pickAttachments,
        onRemove: (index) => setState(() => _attachments.removeAt(index)),
      ),
      const SizedBox(height: 14),
      _RunPreview(
        selectedWorkspaces: selectedWorkspaces,
        readiness: widget.readiness,
        executionMode: _executionMode,
        approvalMode: _approvalMode,
        evidencePreference: _evidencePreference,
        agentProvider: _agentProvider,
        attachmentCount: _attachments.length,
      ),
    ];
  }

  Future<void> _pickAttachments() async {
    setState(() => _isPickingAttachment = true);
    try {
      final result = await FilePicker.pickFiles(
        allowMultiple: true,
        withData: true,
      );
      if (!mounted || result == null) {
        return;
      }
      final next = <_TaskAttachmentDraft>[];
      for (final file in result.files) {
        final bytes = file.bytes;
        if (bytes == null || bytes.isEmpty) {
          continue;
        }
        if (bytes.length > _maxAttachmentBytes) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('${file.name} is larger than the 100MB limit.'),
            ),
          );
          continue;
        }
        next.add(
          _TaskAttachmentDraft(
            name: file.name,
            contentType: _guessContentType(file.name),
            bytes: bytes,
          ),
        );
      }
      if (next.isNotEmpty) {
        setState(() => _attachments.addAll(next));
      }
    } finally {
      if (mounted) {
        setState(() => _isPickingAttachment = false);
      }
    }
  }

  void _submit() {
    final title = _titleController.text.trim();
    final workspaceIds = _selectedWorkspaceIds.toList(growable: false);
    if (title.isEmpty) {
      setState(() => _titleError = 'Task title is required');
      return;
    }
    if (workspaceIds.isEmpty) {
      setState(() => _workspaceError = 'Select at least one project');
      return;
    }
    Navigator.pop(
      context,
      _CreateTaskDraft(
        title: title,
        description: _descriptionController.text.trim(),
        workspaceIds: workspaceIds,
        collectionIds: _selectedCollectionIds.toList(growable: false),
        finalReportInstructions: _reportController.text.trim(),
        executionMode: _executionMode,
        approvalMode: _approvalMode,
        evidencePreference: _evidencePreference,
        agentProvider: _agentProvider,
        providerModel: _providerModelFor(_agentProvider),
        providerThinkingLevel: _providerThinkingLevelFor(_agentProvider),
        attachments: List.unmodifiable(_attachments),
      ),
    );
  }

  String _providerModelFor(String agentProvider) {
    final normalized = CodingAgents.normalize(agentProvider);
    if (normalized == CodingAgents.normalize(widget.initialAgentProvider)) {
      return widget.initialProviderModel;
    }
    return CodingAgents.byId(normalized).defaultModel;
  }

  String _providerThinkingLevelFor(String agentProvider) {
    final normalized = CodingAgents.normalize(agentProvider);
    if (normalized == CodingAgents.normalize(widget.initialAgentProvider)) {
      return widget.initialProviderThinkingLevel;
    }
    return CodingAgents.byId(normalized).defaultThinkingLevel;
  }

  void _setExecutionMode(String value) {
    setState(() {
      _executionMode = value;
      if (value == 'plan' || value == 'research') {
        _approvalMode = 'ask_before_edits';
      }
    });
  }

  void _toggleCollection(WorkspaceCollection collection, bool selected) {
    setState(() {
      if (selected) {
        _selectedCollectionIds = {..._selectedCollectionIds, collection.id};
        _selectedWorkspaceIds = {
          ..._selectedWorkspaceIds,
          ...collection.members.map((member) => member.workspaceId),
        };
      } else {
        _selectedCollectionIds = {
          for (final id in _selectedCollectionIds)
            if (id != collection.id) id,
        };
      }
      _workspaceError = null;
    });
  }

  List<Workspace> _availableWorkspaces() {
    final workspaces = <Workspace>[];
    final seen = <String>{};
    for (final workspace in [
      if (widget.workspace != null) widget.workspace!,
      ...widget.workspaces,
    ]) {
      if (seen.add(workspace.id)) {
        workspaces.add(workspace);
      }
    }
    return workspaces;
  }

  List<Workspace> _selectedWorkspaces() {
    return _availableWorkspaces()
        .where((workspace) => _selectedWorkspaceIds.contains(workspace.id))
        .toList(growable: false);
  }

  void _toggleWorkspace(Workspace workspace, bool selected) {
    setState(() {
      if (selected) {
        _selectedWorkspaceIds = {..._selectedWorkspaceIds, workspace.id};
      } else {
        _selectedWorkspaceIds = {
          for (final id in _selectedWorkspaceIds)
            if (id != workspace.id) id,
        };
      }
      _workspaceError = null;
    });
  }

  String _guessContentType(String filename) {
    final name = filename.toLowerCase();
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.gif')) return 'image/gif';
    if (name.endsWith('.webp')) return 'image/webp';
    if (name.endsWith('.pdf')) return 'application/pdf';
    if (name.endsWith('.json')) return 'application/json';
    if (name.endsWith('.mov')) return 'video/quicktime';
    if (name.endsWith('.mp4')) return 'video/mp4';
    return 'text/plain';
  }
}
