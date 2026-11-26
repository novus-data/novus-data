import { industryFeed, listIndustries, renderRss } from '@/lib/follow';

/** Follow one industry (every name the register files under a sector), as RSS. */
export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await listIndustries()).map(({ slug }) => ({ slug }));
}

export async function GET(_request: Request, context: RouteContext<'/follow/industry/[slug]/feed.xml'>) {
  const { slug } = await context.params;
  const feed = await industryFeed(slug);
  if (!feed) return new Response('Not found', { status: 404 });
  return renderRss(feed);
}
