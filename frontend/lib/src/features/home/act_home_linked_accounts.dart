part of 'act_home_page.dart';

class _LinkedAccountsDialog extends StatelessWidget {
  const _LinkedAccountsDialog({
    required this.linkedAccounts,
    required this.onProviderSelected,
  });

  final AuthOsLinkedAccounts? linkedAccounts;
  final ValueChanged<AuthOsProvider> onProviderSelected;

  @override
  Widget build(BuildContext context) {
    final linkedCount = AuthOsProvider.values
        .where((provider) => _accountsFor(provider).isNotEmpty)
        .length;
    final totalAccounts = linkedAccounts?.accounts.length ?? 0;
    final screenSize = MediaQuery.sizeOf(context);

    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
      backgroundColor: Colors.transparent,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: 560,
          maxHeight: screenSize.height * 0.88,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Material(
            color: AppColors.chrome(context),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _LinkedAccountsHeader(
                  linkedProviderCount: linkedCount,
                  totalAccounts: totalAccounts,
                ),
                Flexible(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(18, 18, 18, 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Choose the identity providers that can sign you back '
                          'into this ACT account. Provider tokens are only used '
                          'after ACT receives a scoped service grant.',
                          style: TextStyle(
                            color: AppColors.secondaryText(context),
                            height: 1.35,
                          ),
                        ),
                        const SizedBox(height: 16),
                        ...AuthOsProvider.values.map(
                          (provider) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _LinkedProviderCard(
                              provider: provider,
                              accounts: _accountsFor(provider),
                              onPressed: () => onProviderSelected(provider),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 18),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Login identity and provider grants stay separate.',
                          style: TextStyle(
                            color: AppColors.mutedText(context),
                            fontSize: 12,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Close'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<AuthOsLinkedAccount> _accountsFor(AuthOsProvider provider) {
    return linkedAccounts?.accountsFor(provider) ??
        const <AuthOsLinkedAccount>[];
  }
}

class _LinkedAccountsHeader extends StatelessWidget {
  const _LinkedAccountsHeader({
    required this.linkedProviderCount,
    required this.totalAccounts,
  });

  final int linkedProviderCount;
  final int totalAccounts;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: AppColors.isDark(context)
              ? const [Color(0xFF0F241E), Color(0xFF13232D)]
              : const [Color(0xFFE7FFF5), Color(0xFFEAF4FF)],
        ),
        border: Border(bottom: BorderSide(color: AppColors.line(context))),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 20, 22, 18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.accent(context).withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: AppColors.accent(context).withValues(alpha: 0.35),
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: Icon(
                      Icons.hub_outlined,
                      color: AppColors.accent(context),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Connected accounts',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text('One ACT user, multiple trusted sign-in paths.'),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _ConnectionMetric(
                  icon: Icons.verified_user_outlined,
                  label:
                      '$linkedProviderCount of ${AuthOsProvider.values.length} providers',
                ),
                _ConnectionMetric(
                  icon: Icons.account_circle_outlined,
                  label:
                      '$totalAccounts linked account${totalAccounts == 1 ? '' : 's'}',
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ConnectionMetric extends StatelessWidget {
  const _ConnectionMetric({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.chrome(context).withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.line(context)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: AppColors.accent(context)),
            const SizedBox(width: 7),
            Text(
              label,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }
}

class _LinkedProviderCard extends StatelessWidget {
  const _LinkedProviderCard({
    required this.provider,
    required this.accounts,
    required this.onPressed,
  });

  final AuthOsProvider provider;
  final List<AuthOsLinkedAccount> accounts;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final linked = accounts.isNotEmpty;
    final accent = _providerAccent(provider);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: linked
            ? accent.withValues(alpha: AppColors.isDark(context) ? 0.12 : 0.08)
            : AppColors.raised(context),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: linked
              ? accent.withValues(alpha: 0.44)
              : AppColors.line(context),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                _ProviderEmblem(provider: provider, linked: linked),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        provider.label,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        linked
                            ? '${accounts.length} account${accounts.length == 1 ? '' : 's'} linked'
                            : 'Not linked to this ACT account yet',
                        style: TextStyle(
                          color: AppColors.secondaryText(context),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                FilledButton.tonalIcon(
                  onPressed: onPressed,
                  icon: Icon(linked ? Icons.sync : Icons.add_link, size: 18),
                  label: Text(linked ? 'Reconnect' : 'Link'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (linked)
              ...accounts.map(
                (account) =>
                    _LinkedAccountRow(account: account, accent: accent),
              )
            else
              _ProviderHint(provider: provider),
          ],
        ),
      ),
    );
  }
}

class _ProviderEmblem extends StatelessWidget {
  const _ProviderEmblem({required this.provider, required this.linked});

  final AuthOsProvider provider;
  final bool linked;

  @override
  Widget build(BuildContext context) {
    final accent = _providerAccent(provider);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: accent.withValues(alpha: linked ? 0.18 : 0.10),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: accent.withValues(alpha: 0.38)),
      ),
      child: SizedBox.square(
        dimension: 44,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Center(child: Icon(_providerIcon(provider), color: accent)),
            if (linked)
              Positioned(
                right: -3,
                bottom: -3,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.chrome(context),
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.line(context)),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(2),
                    child: Icon(
                      Icons.check_circle,
                      color: AppColors.success(context),
                      size: 16,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _LinkedAccountRow extends StatelessWidget {
  const _LinkedAccountRow({required this.account, required this.accent});

  final AuthOsLinkedAccount account;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final label = account.email ?? account.displayName ?? account.provider;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.chrome(context).withValues(alpha: 0.62),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.line(context)),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
          child: Row(
            children: [
              Icon(Icons.person_outline, size: 18, color: accent),
              const SizedBox(width: 9),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${account.scopes.length} scope${account.scopes.length == 1 ? '' : 's'} available',
                      style: TextStyle(
                        color: AppColors.mutedText(context),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _AccountStatusPill(label: 'Ready', accent: accent),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProviderHint extends StatelessWidget {
  const _ProviderHint({required this.provider});

  final AuthOsProvider provider;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.field(context),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Text(
          'Link ${provider.label} to use it on the main sign-in screen for this same ACT user.',
          style: TextStyle(color: AppColors.mutedText(context), fontSize: 12),
        ),
      ),
    );
  }
}

class _AccountStatusPill extends StatelessWidget {
  const _AccountStatusPill({required this.label, required this.accent});

  final String label;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        child: Text(
          label,
          style: TextStyle(
            color: accent,
            fontSize: 11,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}

IconData _providerIcon(AuthOsProvider provider) {
  return switch (provider) {
    AuthOsProvider.github => Icons.code,
    AuthOsProvider.google => Icons.g_mobiledata,
  };
}

Color _providerAccent(AuthOsProvider provider) {
  return switch (provider) {
    AuthOsProvider.github => const Color(0xFF94A3B8),
    AuthOsProvider.google => const Color(0xFF3B82F6),
  };
}
