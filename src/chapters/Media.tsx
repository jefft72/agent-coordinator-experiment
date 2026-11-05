import type { Evidence } from '../content/types';
import { withBase } from '../lib/base';

export interface MediaProps {
  item: Evidence;
  /** The first spread's media is above the fold on desktop, so it loads eagerly; everything else is lazy. */
  eager?: boolean;
  className?: string;
}

/** Real media at its real aspect ratio with its truthful caption. */
export function Media({ item, eager = false, className }: MediaProps) {
  return (
    <figure className={className ? `media ${className}` : 'media'}>
      <img
        src={withBase(item.src)}
        alt={item.alt}
        width={item.width}
        height={item.height}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
      <figcaption>{item.caption}</figcaption>
    </figure>
  );
}
