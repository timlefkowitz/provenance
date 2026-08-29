'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@kit/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import { Trans } from '@kit/ui/trans';

const UsernamePasswordSignInSchema = z.object({
  username: z.string().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
});

type FormValues = z.infer<typeof UsernamePasswordSignInSchema>;

export function UsernamePasswordSignInForm({
  onSubmit,
  loading,
}: {
  onSubmit: (params: { username: string; password: string }) => unknown;
  loading: boolean;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(UsernamePasswordSignInSchema),
    defaultValues: { username: '', password: '' },
  });

  return (
    <Form {...form}>
      <form className={'w-full space-y-2.5'} onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name={'username'}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>

              <FormControl>
                <Input
                  data-test={'username-only-sign-in-input'}
                  required
                  type="text"
                  placeholder="Your username"
                  className="font-serif"
                  {...field}
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={'password'}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans i18nKey={'common:password'} />
              </FormLabel>

              <FormControl>
                <Input
                  required
                  data-test={'username-only-sign-in-password-input'}
                  type="password"
                  placeholder={''}
                  className="font-serif"
                  {...field}
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          data-test={'username-only-sign-in-submit-button'}
          className={'w-full bg-wine text-parchment hover:bg-wine/90 font-serif'}
          type="submit"
          disabled={loading}
        >
          <If
            condition={loading}
            fallback={
              <>
                Sign in with username
                <ArrowRight
                  className={
                    'zoom-in animate-in slide-in-from-left-2 fill-mode-both h-4 delay-500 duration-500'
                  }
                />
              </>
            }
          >
            <Trans i18nKey={'auth:signingIn'} />
          </If>
        </Button>
      </form>
    </Form>
  );
}
