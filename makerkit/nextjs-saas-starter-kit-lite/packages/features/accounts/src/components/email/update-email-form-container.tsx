'use client';

import { useUser } from '@kit/supabase/hooks/use-user';
import { LoadingOverlay } from '@kit/ui/loading-overlay';

import { UpdateEmailForm } from './update-email-form';

export function UpdateEmailFormContainer(props: {
  callbackPath: string;
  initialUserEmail?: string | null;
}) {
  const { data: user, isPending } = useUser();

  if (props.initialUserEmail !== undefined && props.initialUserEmail !== null) {
    return (
      <UpdateEmailForm
        callbackPath={props.callbackPath}
        userEmail={props.initialUserEmail ?? ''}
      />
    );
  }

  if (isPending) {
    return <LoadingOverlay fullPage={false} />;
  }

  if (!user) {
    return null;
  }

  return (
    <UpdateEmailForm callbackPath={props.callbackPath} userEmail={user.email} />
  );
}
