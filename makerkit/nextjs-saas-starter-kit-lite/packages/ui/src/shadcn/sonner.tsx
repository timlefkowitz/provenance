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
            'group-[.toaster]:bg-[#f6ede8] group-[.toaster]:text-[#8b3725] group-[.toaster]:border-[#d4917a] dark:group-[.toaster]:bg-[#2a1208] dark:group-[.toaster]:text-[#e8a48a] dark:group-[.toaster]:border-[#7a3820]',
          success:
            'group-[.toaster]:bg-[#edf0e8] group-[.toaster]:text-[#3a5428] group-[.toaster]:border-[#8ab478] dark:group-[.toaster]:bg-[#1a2a12] dark:group-[.toaster]:text-[#a2c880] dark:group-[.toaster]:border-[#3a5428]',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
