import { listPlaces, placeFeed, renderRss } from '@/lib/follow';

/** Follow one chokepoint, port or industrial cluster, as RSS. */
export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await listPlaces()).map(({ id }) => ({ id }));
}

export async function GET(_request: Request, context: RouteContext<'/follow/place/[id]/feed.xml'>) {
  const { id } = await context.params;
  const feed = await placeFeed(id);
  if (!feed) return new Response('Not found', { status: 404 });
  return renderRss(feed);
}
