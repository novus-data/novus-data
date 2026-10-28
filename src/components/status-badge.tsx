import clsx from 'clsx';

// Imported from the types module, not the layer index: ./types is pure data,
// while the index pulls in the filesystem-backed source.
import type { DisruptionStatus } from '@/lib/disruptions/types';
import { STATUS_LABELS } from '@/lib/disruptions/types';

const DOT: Record<DisruptionStatus, string> = {
  active: 'bg-status-active',
  easing: 'bg-status-easing',
  watch: 'bg-status-watch',
  resolved: 'bg-status-resolved',
};

/**
 * A disruption's state, as a small bordered label so it reads as a status
 * rather than as loose text. The corners are the chart cells' 2px, not a pill:
 * the site is ruled boxes throughout. The dot never appears without its word
 * — status is never carried by colour alone, and amber is reserved for
 * "active" so it cannot be mistaken for a data series.
 */
export function StatusBadge({
  status,
  className,
}: {
  status: DisruptionStatus;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-[2px] border border-rule bg-surface-2 px-2 py-0.5 text-meta text-fg',
        className,
      )}
    >
      <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', DOT[status])} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
