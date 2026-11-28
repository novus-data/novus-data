import { createClient } from '@supabase/supabase-js';

import { requireSupabaseEnv } from '@/lib/env';

/**
 * The service-role client. SERVER ONLY, and used for exactly two things:
 * deleting a row from `auth.users`, which the anon key cannot do, and the
 * optional vessel registry (src/lib/live/registry/supabase.ts), whose table
 * holds no reader data and has row-level security on with no policies, so
 * nothing else can reach it. A third use needs the same scrutiny.
 *
 * ---------------------------------------------------------------------------
 * THIS KEY BYPASSES EVERY ROW-LEVEL SECURITY POLICY IN THE DATABASE.
 *
 * With it, any row belonging to any reader can be read or written. It is the
 * single most dangerous value in this project, and the realistic way it leaks
 * is not theft — it is somebody prefixing it with NEXT_PUBLIC_ to "fix" an
 * undefined variable, at which point Next inlines it into the browser bundle
 * and the whole database is public.
 *
 * Both of those failure modes are guarded below rather than left to care.
 * ---------------------------------------------------------------------------
 */

// 1. The prefix mistake, caught at module load with a message that says what
//    went wrong. Checked by literal name because Next only inlines literals.
if (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY is set. The service role key must NEVER ' +
      'carry the NEXT_PUBLIC_ prefix — that inlines it into the browser bundle and ' +
      'makes every reader row public, because this key bypasses row-level security. ' +
      'Rename it to SUPABASE_SERVICE_ROLE_KEY and rotate the key in the Supabase ' +
      'dashboard, because the old one must be assumed compromised.',
  );
}

// 2. The bundling mistake. If this module is ever pulled into a client
//    component, this throws during hydration rather than shipping the key.
if (typeof window !== 'undefined') {
  throw new Error(
    'src/lib/supabase/admin.ts reached the browser. It is server-only. Something ' +
      'imported it from a client component, directly or through a chain of imports.',
  );
}

/**
 * Only `deleteAccount` and the vessel registry should call this. If you find yourself reaching for it
 * to read a reader's rows, use the request-scoped server client instead — the
 * point of RLS is that ordinary code cannot escape it.
 */
export function createSupabaseAdminClient() {
  const { url } = requireSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set, so an account cannot be deleted. ' +
        'Deleting a row from auth.users needs the service role. Set it on the server ' +
        'only — never with a NEXT_PUBLIC_ prefix. See DEPLOY.md Part 4.',
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
