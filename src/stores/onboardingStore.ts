/**
 * Onboarding Store (Zustand)
 * Tracks onboarding completion, current step, and user role selection.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isDesktop } from '../lib/runtimeConfig';

export type FinanceRole =
  | 'retail-trader'
  | 'wealth-manager'
  | 'portfolio-manager'
  | 'hedge-fund'
  | 'quant-researcher'
  | 'fintech-developer';

export interface OnboardingState {
  hasCompletedOnboarding: boolean;
  currentStep: number;
  selectedRole: FinanceRole | null;
  totalSteps: number;

  // Actions
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setRole: (role: FinanceRole) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      hasCompletedOnboarding: false,
      currentStep: 0,
      selectedRole: null,
      totalSteps: 4,

      setStep: (step) => set({ currentStep: step }),

      nextStep: () => {
        const { currentStep, totalSteps } = get();
        if (currentStep < totalSteps - 1) {
          set({ currentStep: currentStep + 1 });
        }
      },

      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 0) {
          set({ currentStep: currentStep - 1 });
        }
      },

      setRole: (role) => set({ selectedRole: role }),

      completeOnboarding: () =>
        set({ hasCompletedOnboarding: true, currentStep: 0 }),

      resetOnboarding: () =>
        set({
          hasCompletedOnboarding: false,
          currentStep: 0,
          selectedRole: null,
        }),
    }),
    {
      name: 'strategyflow-onboarding',
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        selectedRole: state.selectedRole,
      }),
      // Desktop / dev: skip the onboarding wizard. The whole app is for one
      // local user and there's no benefit to clicking through 4 screens.
      onRehydrateStorage: () => (state) => {
        const isDev = Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
        if (state && (isDesktop() || isDev) && !state.hasCompletedOnboarding) {
          state.hasCompletedOnboarding = true;
        }
      },
    }
  )
);
