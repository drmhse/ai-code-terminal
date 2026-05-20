import 'package:flutter/material.dart';

Future<void> showCreateWorkspaceDialog({
  required BuildContext context,
  required TextEditingController nameController,
  required TextEditingController pathController,
  required VoidCallback onCreate,
}) async {
  await showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Create workspace'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: nameController,
            decoration: const InputDecoration(labelText: 'Name'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: pathController,
            decoration: const InputDecoration(labelText: 'Local path'),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () {
            Navigator.pop(context);
            onCreate();
          },
          child: const Text('Create'),
        ),
      ],
    ),
  );
}
