'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

import { Button } from '@kit/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import { Trans } from '@kit/ui/trans';
import { RefinedPasswordSchema, refineRepeatPassword } from '@kit/auth/schemas/password.schema';
import { TermsAndConditionsFormField } from '@kit/auth/components/terms-and-conditions-form-field';

const CustomPasswordSignUpSchema = z
  .object({
    username: z.string()
      .min(2, 'Username must be at least 2 characters')
      .max(30, 'Username must be less than 30 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
    email: z.string().email(),
    password: RefinedPasswordSchema,
    repeatPassword: RefinedPasswordSchema,
  })
  .superRefine(refineRepeatPassword);

type FormValues = z.infer<typeof CustomPasswordSignUpSchema>;

export function CustomPasswordSignUpForm({
  defaultValues,
  displayTermsCheckbox,
  onSubmit,
  loading,
}: {
  defaultValues?: {
    email: string;
    username?: string;
  };

  displayTermsCheckbox?: boolean;

  onSubmit: (params: {
    username: string;
    email: string;
    password: string;
    repeatPassword: string;
  }) => unknown;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const [usernameStatus, setUsernameStatus] = useState<'checking' | 'available' | 'taken' | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(CustomPasswordSignUpSchema),
    defaultValues: {
      username: defaultValues?.username ?? '',
      email: defaultValues?.email ?? '',
      password: '',
      repeatPassword: '',
    },
  });

  const username = form.watch('username');

  // Check username availability
  useEffect(() => {
    const checkUsername = async () => {
      const usernameValue = username?.trim();
      
      if (!usernameValue || usernameValue.length < 2) {
        setUsernameStatus(null);
        return;
      }

      // Validate format first
      if (!/^[a-zA-Z0-9_-]+$/.test(usernameValue)) {
        setUsernameStatus(null);
        return;
      }

      setUsernameStatus('checking');
      
      try {
        const response = await fetch(`/api/check-username?username=${encodeURIComponent(usernameValue)}`);
        const data = await response.json();
        
        if (data.available) {
          setUsernameStatus('available');
        } else {
          setUsernameStatus('taken');
          form.setError('username', { message: 'Username is already taken' });
        }
      } catch (error) {
        console.error('Error checking username:', error);
        setUsernameStatus(null);
      }
    };

    const timeoutId = setTimeout(checkUsername, 500);
    return () => clearTimeout(timeoutId);
  }, [username, form]);

  return (
    <Form {...form}>
      <form
        className={'w-full space-y-2.5'}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name={'username'}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Username
              </FormLabel>

              <FormControl>
                <div className="relative">
                  <Input
                    data-test={'username-input'}
                    required
                    type="text"
                    placeholder="Choose a username"
                    className="font-serif pr-10"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      setUsernameStatus(null);
                    }}
                  />
                  {usernameStatus === 'checking' && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="h-4 w-4 border-2 border-wine/30 border-t-wine rounded-full animate-spin" />
                    </div>
                  )}
                  {usernameStatus === 'available' && (
                    <CheckCircle2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-600" />
                  )}
                  {usernameStatus === 'taken' && (
                    <XCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-600" />
                  )}
                </div>
              </FormControl>

              <FormMessage />
              <FormDescription className={'text-xs'}>
                Username can only contain letters, numbers, underscores, and hyphens
              </FormDescription>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={'email'}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans i18nKey={'common:emailAddress'} />
              </FormLabel>

              <FormControl>
                <Input
                  data-test={'email-input'}
                  required
                  type="email"
                  placeholder={t('emailPlaceholder')}
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
                  data-test={'password-input'}
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

        <FormField
          control={form.control}
          name={'repeatPassword'}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans i18nKey={'auth:repeatPassword'} />
              </FormLabel>

              <FormControl>
                <Input
                  required
                  data-test={'repeat-password-input'}
                  type="password"
                  placeholder={''}
                  className="font-serif"
                  {...field}
                />
              </FormControl>

              <FormMessage />

              <FormDescription className={'pb-2 text-xs'}>
                <Trans i18nKey={'auth:repeatPasswordHint'} />
              </FormDescription>
            </FormItem>
          )}
        />

        <If condition={displayTermsCheckbox}>
          <TermsAndConditionsFormField />
        </If>

        <Button
          data-test={'auth-submit-button'}
          className={'w-full bg-wine text-parchment hover:bg-wine/90 font-serif'}
          type="submit"
          disabled={loading || usernameStatus === 'taken' || usernameStatus === 'checking'}
        >
          <If
            condition={loading}
            fallback={
              <>
                <Trans i18nKey={'auth:signUpWithEmail'} />

                <ArrowRight
                  className={
                    'zoom-in animate-in slide-in-from-left-2 fill-mode-both h-4 delay-500 duration-500'
                  }
                />
              </>
            }
          >
            <Trans i18nKey={'auth:signingUp'} />
          </If>
        </Button>
      </form>
    </Form>
  );
}

