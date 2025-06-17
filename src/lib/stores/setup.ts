import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type SetupStep = 'welcome' | 'provider' | 'add-more';

interface SetupState {
  isFirstTime: boolean;
  currentStep: SetupStep;
}

function getInitialSetupState(): SetupState {
  if (!browser) return { isFirstTime: false, currentStep: 'welcome' };

  const setupCompleted = localStorage.getItem('setupCompleted');
  return {
    isFirstTime: setupCompleted !== 'true',
    currentStep: 'welcome',
  };
}

export const setupStore = writable<SetupState>(getInitialSetupState());

export const isFirstTimeSetup = writable<boolean>(getInitialSetupState().isFirstTime);

export function nextSetupStep(): void {
  setupStore.update((state) => {
    const steps: SetupStep[] = ['welcome', 'provider', 'add-more'];
    const currentIndex = steps.indexOf(state.currentStep);
    const nextIndex = Math.min(currentIndex + 1, steps.length - 1);
    return {
      ...state,
      currentStep: steps[nextIndex],
    };
  });
}

export function setSetupStep(step: SetupStep): void {
  setupStore.update((state) => ({
    ...state,
    currentStep: step,
  }));
}

export function completeSetup(): void {
  if (browser) {
    localStorage.setItem('setupCompleted', 'true');
  }
  setupStore.set({ isFirstTime: false, currentStep: 'welcome' });
  isFirstTimeSetup.set(false);
}

export function skipSetup(): void {
  completeSetup();
}

export function resetSetup(): void {
  if (browser) {
    localStorage.removeItem('setupCompleted');
  }
  setupStore.set({ isFirstTime: true, currentStep: 'welcome' });
  isFirstTimeSetup.set(true);
}
