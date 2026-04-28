'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, toast } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          error:
            'group-[.toaster]:border-[var(--toast-error-border)] group-[.toaster]:bg-[var(--toast-error-bg)] group-[.toaster]:text-[var(--toast-error-fg)]',
          success:
            'group-[.toaster]:border-[var(--toast-success-border)] group-[.toaster]:bg-[var(--toast-success-bg)] group-[.toaster]:text-[var(--toast-success-fg)]',
          warning:
            'group-[.toaster]:border-[var(--toast-warning-border)] group-[.toaster]:bg-[var(--toast-warning-bg)] group-[.toaster]:text-[var(--toast-warning-fg)]',
          info:
            'group-[.toaster]:border-[var(--toast-info-border)] group-[.toaster]:bg-[var(--toast-info-bg)] group-[.toaster]:text-[var(--toast-info-fg)]',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
