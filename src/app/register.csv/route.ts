import { CATEGORY_LABELS, CONFIDENCE_LABELS, SEVERITY_LABELS, STATUS_LABELS, listDisruptions } from '@/lib/disruptions';
import { absoluteUrl } from '@/lib/env';

/**
 * The register as a spreadsheet: one row per assessment.
 *
 * /register.json is the feed a program polls; this is the file an analyst
 * opens. Same data, same rules, flattened: each row is one disruption set
 * against one company or sector, with the four things an assessment must carry
 * (mechanism, confidence, as-of date, sources) in their own columns, so a row
 * pasted into a model keeps its provenance with it.
 *
 * A disruption with no assessment yet still gets one row, with the entity
 * columns empty, so the file lists every entry in the register rather than
 * only the ones that reach someone.
 *
 * Nothing here is derived. There is no score, rank or blend: every cell is a
 * value a person wrote and dated in content/disruptions/, the same rule the
 * entity pages and the JSON feed hold to (CLAUDE.md §6c). Statically generated
 * at build, like everything else that is not live.
 */

export const dynamic = 'force-static';

const COLUMNS = [
  'disruption_id',
  'disruption_title',
  'status',
  'category',
  'started_at',
  'reviewed_at',
  'places',
  'entity_id',
  'entity_name',
  'entity_kind',
  'ticker',
  'sector',
  'severity',
  'confidence',
  'mechanism',
  'assessed_as_of',
  'source_titles',
  'source_publishers',
  'source_urls',
  'disruption_url',
  'entity_url',
] as const;

type Row = Record<(typeof COLUMNS)[number], string>;

/** RFC 4180: quote every field, double any quote inside it. */
function field(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Several sources in one cell, in order, separated so a spreadsheet can split them. */
function joined(values: string[]): string {
  return values.join(' | ');
}

export async function GET() {
  const disruptions = await listDisruptions();
  const rows: Row[] = [];

  for (const disruption of disruptions) {
    const shared = {
      disruption_id: disruption.id,
      disruption_title: disruption.title,
      status: STATUS_LABELS[disruption.status],
      category: CATEGORY_LABELS[disruption.category],
      started_at: disruption.startedAt,
      reviewed_at: disruption.updatedAt,
      places: disruption.places.join(' | '),
      disruption_url: absoluteUrl(`/disruptions/${disruption.id}`),
    };

    if (disruption.exposures.length === 0) {
      rows.push({
        ...shared,
        entity_id: '',
        entity_name: '',
        entity_kind: '',
        ticker: '',
        sector: '',
        severity: '',
        confidence: '',
        mechanism: '',
        assessed_as_of: '',
        source_titles: joined(disruption.sources.map((source) => source.title)),
        source_publishers: joined(disruption.sources.map((source) => source.publisher)),
        source_urls: joined(disruption.sources.map((source) => source.url)),
        entity_url: '',
      });
      continue;
    }

    for (const exposure of disruption.exposures) {
      rows.push({
        ...shared,
        entity_id: exposure.entity.id,
        entity_name: exposure.entity.name,
        entity_kind: exposure.entity.kind,
        ticker: exposure.entity.ticker ?? '',
        sector: exposure.entity.sector,
        severity: SEVERITY_LABELS[exposure.severity],
        confidence: CONFIDENCE_LABELS[exposure.confidence],
        mechanism: exposure.mechanism,
        assessed_as_of: exposure.asOf,
        source_titles: joined(exposure.sources.map((source) => source.title)),
        source_publishers: joined(exposure.sources.map((source) => source.publisher)),
        source_urls: joined(exposure.sources.map((source) => source.url)),
        entity_url: absoluteUrl(`/entities/${exposure.entity.id}`),
      });
    }
  }

  const lines = [
    COLUMNS.map(field).join(','),
    ...rows.map((row) => COLUMNS.map((column) => field(row[column])).join(',')),
  ];

  // A byte-order mark so spreadsheet programs read the file as UTF-8 (the
  // register uses accents and the euro sign), and CRLF line ends per RFC 4180.
  const body = `﻿${lines.join('\r\n')}\r\n`;

  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'inline; filename="novus-data-register.csv"',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
