part of '../act_home_page.dart';

class _CollectionMemberTile extends StatelessWidget {
  const _CollectionMemberTile({
    required this.member,
    required this.defaultWorkspaceId,
    required this.busy,
    required this.onSetPrimary,
    required this.onRemove,
  });

  final WorkspaceCollectionMember member;
  final String? defaultWorkspaceId;
  final bool busy;
  final VoidCallback onSetPrimary;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final isPrimary =
        member.role == 'primary' || member.workspaceId == defaultWorkspaceId;
    return ListTile(
      dense: true,
      contentPadding: EdgeInsets.zero,
      leading: Icon(
        isPrimary ? Icons.folder_special_outlined : Icons.folder_outlined,
        color: isPrimary
            ? AppColors.accent(context)
            : AppColors.secondaryText(context),
      ),
      title: Text(
        member.workspace.name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w800),
      ),
      subtitle: Text(
        isPrimary ? 'Primary' : member.workspace.localPath,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: busy
          ? const SizedBox.square(
              dimension: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Wrap(
              spacing: 2,
              children: [
                IconButton(
                  tooltip: 'Set primary',
                  onPressed: isPrimary ? null : onSetPrimary,
                  icon: const Icon(Icons.star_outline, size: 18),
                ),
                IconButton(
                  tooltip: 'Remove from collection',
                  onPressed: onRemove,
                  icon: const Icon(Icons.link_off, size: 18),
                ),
              ],
            ),
    );
  }
}
