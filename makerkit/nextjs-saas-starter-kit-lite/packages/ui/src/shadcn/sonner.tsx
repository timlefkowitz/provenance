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
            'group-[.toaster]:bg-[#fdf2f2] group-[.toaster]:text-[#7a2828] group-[.toaster]:border-[#e8b4b4] dark:group-[.toaster]:bg-[#2d1515] dark:group-[.toaster]:text-[#f4a8a8] dark:group-[.toaster]:border-[#5c2a2a]',
          success:
            'group-[.toaster]:bg-[#f2f7f3] group-[.toaster]:text-[#2a5c38] group-[.toaster]:border-[#a8cdb4] dark:group-[.toaster]:bg-[#152d1e] dark:group-[.toaster]:text-[#a8d4b4] dark:group-[.toaster]:border-[#2a5c38]',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
