import { Button } from '@kit/ui/button';

import { OauthProviderLogoImage } from './oauth-provider-logo-image';

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
      className={'w-full font-serif gap-3'}
      data-provider={providerId}
      data-test={'auth-provider-button'}
      variant={'outline'}
      onClick={onClick}
    >
      <OauthProviderLogoImage providerId={providerId} />
      <span>{children}</span>
    </Button>
  );
}
