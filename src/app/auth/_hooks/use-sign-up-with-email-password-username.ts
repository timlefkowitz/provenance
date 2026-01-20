import { useMutation } from '@tanstack/react-query';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';

interface Credentials {
  username: string;
  email: string;
  password: string;
  emailRedirectTo: string;
}

/**
 * @name useSignUpWithEmailPasswordAndUsername
 * @description Use Supabase to sign up a user with email, password, and username
 */
export function useSignUpWithEmailPasswordAndUsername() {
  const client = useSupabase();
  const mutationKey = ['auth', 'sign-up-with-email-password-username'];

  const mutationFn = async (params: Credentials) => {
    const { username, emailRedirectTo, ...credentials } = params;
    const trimmedUsername = username.trim();

    // Check if username is already taken (case-insensitive)
    const { data: existingAccounts } = await client
      .from('accounts')
      .select('id')
      .ilike('name', trimmedUsername)
      .limit(1);

    if (existingAccounts && existingAccounts.length > 0) {
      throw new Error('Username is already taken');
    }

    const response = await client.auth.signUp({
      ...credentials,
      options: {
        emailRedirectTo,
        data: {
          name: trimmedUsername, // Store username in user metadata so it gets saved to account name
        },
      },
    });

    if (response.error) {
      throw response.error.message;
    }

    const user = response.data?.user;
    const identities = user?.identities ?? [];

    // if the user has no identities, it means that the email is taken
    if (identities.length === 0) {
      throw new Error('User already registered');
    }

    // Update the account name with the username if account was created
    if (user?.id) {
      try {
        await client
          .from('accounts')
          .update({ name: trimmedUsername })
          .eq('id', user.id);
      } catch (error) {
        console.error('Error updating account name:', error);
        // Don't throw - account creation succeeded, name update is secondary
      }
    }

    return response.data;
  };

  return useMutation({
    mutationKey,
    mutationFn,
  });
}

