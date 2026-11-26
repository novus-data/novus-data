import { registerFeed, renderRss } from '@/lib/follow';

/** Follow the whole register: every entry, as RSS. See src/lib/follow.ts. */
export const dynamic = 'force-static';

export async function GET() {
  return renderRss(await registerFeed());
}
