import { Button } from '@kit/ui/button';

export function AuthProviderButton({
  providerId,
  onClick,
  children,
}: React.PropsWithChildren<{
  providerId: string;
  onClick: () => void;
}>) {
  return (
    <Button
      className={'w-full font-serif'}
      data-provider={providerId}
      data-test={'auth-provider-button'}
      variant={'outline'}
      onClick={onClick}
    >
      <span>{children}</span>
    </Button>
  );
}
