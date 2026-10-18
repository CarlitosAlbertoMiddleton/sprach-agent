import type { SessionApi, SprachApi } from '../shared/types';

declare global {
  interface Window {
    sprach: SprachApi;
    sprachSession: SessionApi;
  }
}
