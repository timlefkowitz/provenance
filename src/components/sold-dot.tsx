/**
 * The gallery red dot: a sold work. Use `overlay` on an image (top-right) or
 * inline next to a title.
 */
export function SoldDot({
  variant = 'inline',
  className = '',
}: {
  variant?: 'inline' | 'overlay';
  className?: string;
}) {
  if (variant === 'overlay') {
    return (
      <span
        role="img"
        aria-label="Sold"
        title="Sold"
        className={`absolute top-2 right-2 z-10 h-4 w-4 rounded-full bg-red-600 ring-2 ring-white shadow ${className}`}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label="Sold"
      title="Sold"
      className={`inline-block h-3 w-3 shrink-0 rounded-full bg-red-600 align-middle ${className}`}
    />
  );
}
