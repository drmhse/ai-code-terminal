import 'dart:math' as math;

import 'package:act_frontend/src/app/app_colors.dart';
import 'package:act_frontend/src/services/auth_os_config.dart';
import 'package:flutter/material.dart';

class ConnectionPanel extends StatelessWidget {
  const ConnectionPanel({
    required this.isSaving,
    required this.activeProfileLabel,
    required this.onProviderSignIn,
    required this.onSwitchProfile,
    required this.onRefresh,
    this.statusMessage,
    super.key,
  });

  final bool isSaving;
  final String activeProfileLabel;
  final ValueChanged<AuthOsProvider> onProviderSignIn;
  final VoidCallback onSwitchProfile;
  final VoidCallback onRefresh;
  final String? statusMessage;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.page(context),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 920;
            final widePanelHeight = math.max(420.0, constraints.maxHeight - 48);
            return Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: wide ? 840 : 460,
                    minHeight: wide ? 420 : 0,
                  ),
                  child: wide
                      ? SizedBox(
                          height: widePanelHeight,
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const Expanded(child: _ProductPanel()),
                              const SizedBox(width: 16),
                              Expanded(
                                child: _SignInCard(
                                  isSaving: isSaving,
                                  activeProfileLabel: activeProfileLabel,
                                  statusMessage: statusMessage,
                                  onProviderSignIn: onProviderSignIn,
                                  onSwitchProfile: onSwitchProfile,
                                  onRefresh: onRefresh,
                                ),
                              ),
                            ],
                          ),
                        )
                      : _SignInCard(
                          isSaving: isSaving,
                          activeProfileLabel: activeProfileLabel,
                          statusMessage: statusMessage,
                          onProviderSignIn: onProviderSignIn,
                          onSwitchProfile: onSwitchProfile,
                          onRefresh: onRefresh,
                        ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _SignInCard extends StatelessWidget {
  const _SignInCard({
    required this.isSaving,
    required this.activeProfileLabel,
    required this.onProviderSignIn,
    required this.onSwitchProfile,
    required this.onRefresh,
    this.statusMessage,
  });

  final bool isSaving;
  final String activeProfileLabel;
  final ValueChanged<AuthOsProvider> onProviderSignIn;
  final VoidCallback onSwitchProfile;
  final VoidCallback onRefresh;
  final String? statusMessage;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _BrandHeader(),
            const SizedBox(height: 22),
            _ServiceBadge(label: activeProfileLabel),
            if (statusMessage != null) ...[
              const SizedBox(height: 14),
              _StatusMessage(message: statusMessage!),
            ],
            const SizedBox(height: 18),
            ...AuthOsProvider.values.map(
              (provider) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: FilledButton.icon(
                  onPressed: isSaving ? null : () => onProviderSignIn(provider),
                  icon: _ProviderIcon(provider: provider),
                  label: Text('Continue with ${provider.label}'),
                ),
              ),
            ),
            const SizedBox(height: 4),
            TextButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.monitor_heart_outlined),
              label: const Text('Check connection'),
            ),
            TextButton.icon(
              onPressed: isSaving ? null : onSwitchProfile,
              icon: const Icon(Icons.swap_horiz),
              label: const Text('Change ACT profile'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductPanel extends StatelessWidget {
  const _ProductPanel();

  @override
  Widget build(BuildContext context) {
    return Card(
      color: AppColors.raised(context),
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _LogoMark(size: 52),
            const Spacer(),
            const Text(
              'ACT',
              style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            Text(
              'A focused terminal workspace for code, files, and sessions.',
              style: TextStyle(
                color: AppColors.secondaryText(context),
                fontSize: 16,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 28),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: const [
                _CapabilityChip(icon: Icons.terminal, label: 'Terminal'),
                _CapabilityChip(icon: Icons.folder_open, label: 'Files'),
                _CapabilityChip(icon: Icons.devices, label: 'Cross-platform'),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _CapabilityChip extends StatelessWidget {
  const _CapabilityChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.field(context),
        border: Border.all(color: AppColors.line(context)),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: AppColors.accent(context)),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(color: AppColors.secondaryText(context)),
            ),
          ],
        ),
      ),
    );
  }
}

class _ServiceBadge extends StatelessWidget {
  const _ServiceBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.field(context),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppColors.line(context)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Icon(
              Icons.verified_user_outlined,
              color: AppColors.accent(context),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label.isEmpty ? 'Hosted ACT' : label,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LogoMark extends StatelessWidget {
  const _LogoMark({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.accent(context),
        borderRadius: BorderRadius.circular(8),
        boxShadow: const [
          BoxShadow(
            color: Color(0x3320282F),
            blurRadius: 18,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: SizedBox.square(
        dimension: size,
        child: Icon(
          Icons.terminal,
          size: size * 0.52,
          color: AppColors.isDark(context)
              ? AppColors.page(context)
              : Colors.white,
        ),
      ),
    );
  }
}

class _ProviderIcon extends StatelessWidget {
  const _ProviderIcon({required this.provider});

  final AuthOsProvider provider;

  @override
  Widget build(BuildContext context) {
    final icon = switch (provider) {
      AuthOsProvider.github => Icons.code,
      AuthOsProvider.google => Icons.g_mobiledata,
    };
    return Icon(icon);
  }
}

class _BrandHeader extends StatelessWidget {
  const _BrandHeader();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const _LogoMark(size: 60),
        const SizedBox(height: 18),
        const Text(
          'AI Code Terminal',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Hosted or self-hosted terminal workspace',
          style: TextStyle(color: AppColors.secondaryText(context)),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

class _StatusMessage extends StatelessWidget {
  const _StatusMessage({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.field(context),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppColors.line(context)),
      ),
      child: Text(
        message,
        style: TextStyle(color: AppColors.secondaryText(context)),
      ),
    );
  }
}
