<template>
  <div class="p-6 bg-bg-primary min-h-screen">
    <div class="max-w-2xl mx-auto">
      <h1 class="text-text-primary font-bold text-3xl mb-6">
        🎨 Tailwind + Design Token Integration Test
      </h1>

      <!-- Theme-aware card using Tailwind utilities -->
      <div class="bg-bg-secondary border border-border-primary rounded-lg p-6 mb-6 shadow-base">
        <h2 class="text-text-primary font-semibold text-xl mb-4">
          Theme-Aware Components
        </h2>
        <p class="text-text-secondary mb-4">
          These components automatically adapt when you switch themes.
          All utilities reference your existing design tokens!
        </p>

        <!-- Button examples using Tailwind utilities -->
        <div class="flex flex-wrap gap-3 mb-6">
          <button class="bg-interactive-primary hover:bg-interactive-primary-hover text-text-inverse px-4 py-2 rounded-base font-medium transition-base">
            Primary Action
          </button>
          <button class="bg-bg-tertiary hover:bg-interactive-tertiary-hover border border-border-primary text-text-primary px-4 py-2 rounded-base font-medium transition-base">
            Secondary Action
          </button>
          <button class="bg-semantic-success text-text-inverse px-4 py-2 rounded-base font-medium transition-base">
            Success
          </button>
          <button class="bg-semantic-error text-text-inverse px-4 py-2 rounded-base font-medium transition-base">
            Error
          </button>
        </div>

        <!-- Using predefined component utilities -->
        <div class="flex flex-wrap gap-3 mb-6">
          <button class="btn-base btn-primary">
            Component Primary
          </button>
          <button class="btn-base btn-secondary">
            Component Secondary
          </button>
        </div>

        <!-- Input example -->
        <input
          type="text"
          placeholder="Theme-aware input field..."
          class="input-base w-full mb-4"
        />

        <!-- Semantic color examples -->
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-semantic-success-bg border border-semantic-success-border text-semantic-success p-3 rounded-base">
            <strong>Success:</strong> Operation completed successfully
          </div>
          <div class="bg-semantic-warning-bg border border-semantic-warning-border text-semantic-warning p-3 rounded-base">
            <strong>Warning:</strong> Please check your settings
          </div>
          <div class="bg-semantic-error-bg border border-semantic-error-border text-semantic-error p-3 rounded-base">
            <strong>Error:</strong> Something went wrong
          </div>
          <div class="bg-semantic-info-bg border border-semantic-info-border text-semantic-info p-3 rounded-base">
            <strong>Info:</strong> Additional information available
          </div>
        </div>
      </div>

      <!-- Comparison: Original vs Tailwind -->
      <div class="bg-bg-secondary border border-border-primary rounded-lg p-6">
        <h2 class="text-text-primary font-semibold text-xl mb-4">
          Original vs Tailwind Comparison
        </h2>

        <div class="grid md:grid-cols-2 gap-6">
          <div>
            <h3 class="text-text-primary font-medium mb-3">Original Approach</h3>
            <a href="#" class="btn-github block">
              <ArrowRightIcon class="h-4 w-4" />
              GitHub Login (Original)
            </a>
          </div>

          <div>
            <h3 class="text-text-primary font-medium mb-3">Tailwind Approach</h3>
            <a href="#" class="flex items-center justify-center gap-2 w-full px-6 py-3 bg-interactive-primary hover:bg-interactive-primary-hover text-text-inverse font-medium rounded-base transition-base hover:translate-y-[-1px] hover:shadow-md">
              <ArrowRightIcon class="h-4 w-4" />
              GitHub Login (Tailwind)
            </a>
          </div>
        </div>

        <p class="text-text-tertiary text-sm mt-4">
          Both approaches work together! Your existing styles remain unchanged while Tailwind adds new capabilities.
        </p>
      </div>

      <div class="mt-6 p-4 bg-bg-tertiary rounded-lg">
        <p class="text-text-secondary text-sm">
          💡 <strong>Try switching themes</strong> to see all these components automatically adapt!
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowRightIcon } from '@heroicons/vue/24/outline'
</script>

<style scoped>
/* Your original btn-github class still works perfectly */
.btn-github {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3) var(--space-6);
  background: var(--color-interactive-primary);
  color: white;
  border: none;
  border-radius: var(--radius-base);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  transition: var(--transition-base);
  cursor: pointer;
}

.btn-github:hover {
  background: var(--color-interactive-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
</style>