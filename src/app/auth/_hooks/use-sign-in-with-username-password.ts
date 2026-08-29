import { useMutation } from '@tanstack/react-query';

interface Credentials {
  username: string;
  password: string;
}

/**
 * @name useSignInWithUsernamePassword
 * @description Sign in an account that was created via username/password
 * signup (no email involved on the client side).
 */
export function useSignInWithUsernamePassword() {
  const mutationKey = ['auth', 'sign-in-with-username-password'];

  const mutationFn = async (params: Credentials) => {
    const response = await fetch('/api/auth/sign-in-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? 'Could not sign in');
    }

    return data as { success: true };
  };

  return useMutation({
    mutationKey,
    mutationFn,
  });
}
