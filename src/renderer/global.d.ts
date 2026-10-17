import type { SprachApi } from '../shared/types';

declare global {
  interface Window {
    sprach: SprachApi;
  }
}
