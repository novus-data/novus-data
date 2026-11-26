import { listEntityIds } from '@/lib/disruptions';
import { entityFeed, renderRss } from '@/lib/follow';

/** Follow one company or sector, as RSS. See src/lib/follow.ts. */
export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await listEntityIds()).map((id) => ({ id }));
}

export async function GET(_request: Request, context: RouteContext<'/entities/[id]/feed.xml'>) {
  const { id } = await context.params;
  const feed = await entityFeed(id);
  if (!feed) return new Response('Not found', { status: 404 });
  return renderRss(feed);
}
