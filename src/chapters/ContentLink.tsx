import type { Link } from '../content/types';

const EXTERNAL = /^https?:\/\//;

/** Anchor for a content link. External destinations open in a new tab. */
export function ContentLink({ link, className }: { link: Link; className?: string }) {
  const external = EXTERNAL.test(link.href);
  return (
    <a
      className={className}
      href={link.href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
    >
      {link.label}
    </a>
  );
}
