import 'dart:math' as math;

import 'package:act_frontend/src/app/app_colors.dart';
import 'package:act_frontend/src/app/app_theme_controller.dart';
import 'package:flutter/material.dart';

class ThemeSelectionPage extends StatelessWidget {
  const ThemeSelectionPage({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = ActThemeScope.of(context);
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final selectedId = controller.themeId;
        final currentTheme = controller.selectedTheme;
        final currentPalette = AppColors.palette(context);
        return Scaffold(
          backgroundColor: AppColors.page(context),
          appBar: AppBar(
            title: const Text('Themes'),
            actions: [
              IconButton(
                tooltip: 'Close',
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          body: SafeArea(
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 6),
                    child: _CurrentThemeBanner(
                      theme: currentTheme,
                      palette: currentPalette,
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
                  sliver: SliverLayoutBuilder(
                    builder: (context, constraints) {
                      final width = constraints.crossAxisExtent;
                      final columns = width >= 1180
                          ? 4
                          : width >= 860
                          ? 3
                          : width >= 560
                          ? 2
                          : 1;
                      return SliverGrid(
                        delegate: SliverChildBuilderDelegate((context, index) {
                          final theme = ActThemes.all[index];
                          return _ThemeCard(
                            theme: theme,
                            selected: theme.id == selectedId,
                            onSelected: () => controller.selectTheme(theme.id),
                          );
                        }, childCount: ActThemes.all.length),
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: columns,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          mainAxisExtent: 214,
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _CurrentThemeBanner extends StatelessWidget {
  const _CurrentThemeBanner({required this.theme, required this.palette});

  final ActTheme theme;
  final ActThemePalette palette;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.chrome(context),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.line(context)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            _PaletteSwatch(palette: palette, size: 54),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    theme.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.primaryText(context),
                      fontWeight: FontWeight.w900,
                      fontSize: 20,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    theme.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.secondaryText(context),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Icon(Icons.check_circle, color: AppColors.accent(context)),
          ],
        ),
      ),
    );
  }
}

class _ThemeCard extends StatelessWidget {
  const _ThemeCard({
    required this.theme,
    required this.selected,
    required this.onSelected,
  });

  final ActTheme theme;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final palette = theme.palette(brightness);
    final borderColor = selected ? palette.accent : AppColors.line(context);
    return Material(
      color: AppColors.chrome(context),
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onSelected,
        borderRadius: BorderRadius.circular(8),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: borderColor, width: selected ? 1.6 : 1),
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _PaletteSwatch(palette: palette, size: 44),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      theme.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.primaryText(context),
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  Icon(
                    selected
                        ? Icons.radio_button_checked
                        : Icons.radio_button_unchecked,
                    color: selected
                        ? AppColors.accent(context)
                        : AppColors.mutedText(context),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Expanded(
                child: _ThemePreview(palette: palette, selected: selected),
              ),
              const SizedBox(height: 10),
              _ContrastRow(palette: palette),
            ],
          ),
        ),
      ),
    );
  }
}

class _ThemePreview extends StatelessWidget {
  const _ThemePreview({required this.palette, required this.selected});

  final ActThemePalette palette;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.panel,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: palette.line),
      ),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 54,
                  height: 24,
                  decoration: BoxDecoration(
                    color: palette.accent,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Icon(Icons.check, color: palette.onAccent, size: 16),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    height: 24,
                    decoration: BoxDecoration(
                      color: palette.field,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: palette.line),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Container(
              height: 8,
              width: 130,
              decoration: BoxDecoration(
                color: palette.primaryText,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            const SizedBox(height: 7),
            Container(
              height: 8,
              width: 92,
              decoration: BoxDecoration(
                color: palette.secondaryText,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            const Spacer(),
            Align(
              alignment: Alignment.bottomRight,
              child: Container(
                width: selected ? 52 : 38,
                height: 7,
                decoration: BoxDecoration(
                  color: selected ? palette.accent : palette.mutedText,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PaletteSwatch extends StatelessWidget {
  const _PaletteSwatch({required this.palette, required this.size});

  final ActThemePalette palette;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: SizedBox.square(
        dimension: size,
        child: Column(
          children: [
            Expanded(
              child: Row(
                children: [
                  Expanded(child: ColoredBox(color: palette.page)),
                  Expanded(child: ColoredBox(color: palette.chrome)),
                ],
              ),
            ),
            Expanded(
              child: Row(
                children: [
                  Expanded(child: ColoredBox(color: palette.field)),
                  Expanded(child: ColoredBox(color: palette.accent)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ContrastRow extends StatelessWidget {
  const _ContrastRow({required this.palette});

  final ActThemePalette palette;

  @override
  Widget build(BuildContext context) {
    final textContrast = _contrastRatio(palette.primaryText, palette.panel);
    final accentContrast = _contrastRatio(palette.onAccent, palette.accent);
    return Row(
      children: [
        _ContrastPill(label: 'Text', value: textContrast),
        const SizedBox(width: 6),
        _ContrastPill(label: 'Accent', value: accentContrast),
      ],
    );
  }
}

class _ContrastPill extends StatelessWidget {
  const _ContrastPill({required this.label, required this.value});

  final String label;
  final double value;

  @override
  Widget build(BuildContext context) {
    final pass = value >= 4.5;
    return Expanded(
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: pass
              ? AppColors.success(context).withValues(alpha: 0.12)
              : AppColors.warning(context).withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: pass
                ? AppColors.success(context).withValues(alpha: 0.32)
                : AppColors.warning(context).withValues(alpha: 0.36),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
          child: Text(
            '$label ${value.toStringAsFixed(1)}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.secondaryText(context),
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ),
    );
  }
}

double _contrastRatio(Color foreground, Color background) {
  final light = _relativeLuminance(foreground);
  final dark = _relativeLuminance(background);
  final lighter = light > dark ? light : dark;
  final darker = light > dark ? dark : light;
  return (lighter + 0.05) / (darker + 0.05);
}

double _relativeLuminance(Color color) {
  double channel(double value) {
    return value <= 0.03928
        ? value / 12.92
        : math.pow((value + 0.055) / 1.055, 2.4).toDouble();
  }

  return 0.2126 * channel(color.r) +
      0.7152 * channel(color.g) +
      0.0722 * channel(color.b);
}
