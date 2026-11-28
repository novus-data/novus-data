/**
 * OpenSky Network — aircraft near eight air-cargo hubs (Vessels Part 3B).
 * SERVER ONLY.
 *
 * ---------------------------------------------------------------------------
 * HIDDEN, AND WHY
 *
 * OpenSky describes its API as for research and non-commercial purposes and
 * asks commercial users to contact it. Novus may charge. So this source makes
 * no call at all unless OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET are set,
 * and the section stays behind `monitorEnabled` until both founders hold
 * OpenSky's written answer (DECISIONS.md).
 *
 * WHAT WAS VERIFIED, AND WHERE
 *
 * From OpenSky's own client (https://raw.githubusercontent.com/openskynetwork/
 * opensky-api/master/python/opensky_api.py, retrieved 28 November 2026): the
 * token endpoint and the client-credentials form below, a default token life
 * of 1800 seconds, the API base https://opensky-network.org/api, and
 * /states/all with lamin, lamax, lomin, lomax and extended=true. The REST
 * documentation page and the credit rules (a free account's daily allowance,
 * one credit per box of 25 square degrees or less, 429 when it runs out) come
 * from the handoff and could NOT be checked from the environment this was
 * written in. Nothing here has ever run against OpenSky.
 *
 * THE CALLS
 *
 * One token request per regeneration, then one query per node, SEQUENTIALLY,
 * never a burst. A 401 fetches one new token and retries that query once. A
 * 429 stops at once and the reading is unavailable: no retry loop. A
 * regeneration therefore costs at most eight queries.
 *
 * SECRETS: the client id and secret go into the token request body and
 * nowhere else: never into a Reading, an error or a log. The tests check.
 * ---------------------------------------------------------------------------
 */

import { AIR_NODES, type AirNode } from '../air-nodes';
import { parseStates, type ParseResult } from '../air';
import { LiveSourceError } from './http';

export const OPENSKY_TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
export const OPENSKY_API_URL = 'https://opensky-network.org/api';
const REQUEST_TIMEOUT_MS = 8_000;
const TOTAL_BUDGET_MS = 25_000;

export interface OpenSkyRaw {
  results: ParseResult[];
  /** How many HTTP requests were made, tokens included. For the live check and the tests. */
  requests: number;
}

export interface OpenSkyOptions {
  fetchImpl?: typeof fetch;
  tokenUrl?: string;
  apiUrl?: string;
  nodes?: AirNode[];
}

export async function fetchOpenSky(clientId: string, clientSecret: string, options: OpenSkyOptions = {}): Promise<OpenSkyRaw> {
  const doFetch = options.fetchImpl ?? fetch;
  const nodes = options.nodes ?? AIR_NODES;
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let requests = 0;

  const timeout = () => AbortSignal.timeout(Math.max(1, Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now())));

  async function token(): Promise<string> {
    requests += 1;
    let response: Response;
    try {
      response = await doFetch(options.tokenUrl ?? OPENSKY_TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }).toString(),
        signal: timeout(),
      });
    } catch {
      throw new LiveSourceError('OpenSky could not be reached for an access token.');
    }
    if (!response.ok) {
      throw new LiveSourceError(
        `OpenSky refused an access token (HTTP ${response.status}). Check that OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET are valid.`,
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new LiveSourceError('OpenSky returned an access token response that could not be read.');
    }
    const access = typeof body === 'object' && body !== null ? (body as { access_token?: unknown }).access_token : null;
    if (typeof access !== 'string' || access === '') throw new LiveSourceError('OpenSky returned no access token.');
    return access;
  }

  async function query(node: AirNode, bearer: string): Promise<Response> {
    const [[south, west], [north, east]] = node.box;
    const params = new URLSearchParams({
      lamin: String(south),
      lamax: String(north),
      lomin: String(west),
      lomax: String(east),
      extended: 'true',
    });
    requests += 1;
    try {
      return await doFetch(`${options.apiUrl ?? OPENSKY_API_URL}/states/all?${params}`, {
        headers: { authorization: `Bearer ${bearer}`, 'user-agent': 'NovusData/1.0 (supply chain disruption monitor)' },
        signal: timeout(),
        next: { revalidate: 900, tags: ['live', 'live:opensky'] },
      } as RequestInit);
    } catch {
      throw new LiveSourceError(`OpenSky did not answer for ${node.name} in time.`);
    }
  }

  let bearer = await token();
  const results: ParseResult[] = [];
  for (const node of nodes) {
    if (Date.now() >= deadline) throw new LiveSourceError('OpenSky took too long to answer for every hub.');
    let response = await query(node, bearer);
    if (response.status === 401) {
      bearer = await token();
      response = await query(node, bearer);
    }
    if (response.status === 429) {
      throw new LiveSourceError("OpenSky reports that this account's daily request allowance is used up. The section returns when it resets.");
    }
    if (!response.ok) throw new LiveSourceError(`OpenSky answered HTTP ${response.status} for ${node.name}.`);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new LiveSourceError(`OpenSky's answer for ${node.name} could not be read.`);
    }
    results.push(parseStates(body, node));
  }
  return { results, requests };
}
