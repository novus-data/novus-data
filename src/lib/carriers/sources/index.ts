/** Chooses where carrier lists come from: CONTENT_SOURCE=fixtures means the same here as everywhere. */

import type { CarrierRecord } from '../types';
import { fixtureCarriers } from './fixtures';
import { readCarriers, type CarrierRead } from './local-files';

export function getCarrierSourceName(): 'local' | 'fixtures' {
  return process.env.CONTENT_SOURCE === 'fixtures' ? 'fixtures' : 'local';
}

export async function readFromActiveSource(): Promise<CarrierRead> {
  if (getCarrierSourceName() === 'fixtures') return { carriers: fixtureCarriers(), warnings: [] };
  return readCarriers();
}

export type { CarrierRecord };
