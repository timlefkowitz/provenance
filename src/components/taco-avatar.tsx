import Image from 'next/image';

interface TacoAvatarProps {
  pictureUrl: string | null | undefined;
  displayName: string;
  className?: string;
  priority?: boolean;
}

/**
 * Profile avatar that falls back to Taco the Cat when no photo has been uploaded.
 * The `className` prop controls the container's size and shape (e.g. rounded-full, rounded-xl).
 */
export function TacoAvatar({
  pictureUrl,
  displayName,
  className = '',
  priority = false,
}: TacoAvatarProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={pictureUrl || '/taco-cat.png'}
        alt={pictureUrl ? displayName : 'Taco the Cat — default avatar'}
        fill
        className="object-cover"
        unoptimized={!!pictureUrl}
        priority={priority}
      />
    </div>
  );
}
