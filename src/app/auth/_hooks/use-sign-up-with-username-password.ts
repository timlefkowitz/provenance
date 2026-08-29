import { useMutation } from '@tanstack/react-query';

interface Credentials {
  username: string;
  password: string;
}

interface SignUpResponse {
  success: true;
  userId: string;
}

/**
 * @name useSignUpWithUsernamePassword
 * @description Sign up with just a username and password, no email required.
 * The server mints a placeholder address behind the scenes and signs the
 * browser in immediately since there's no confirmation email to send.
 */
export function useSignUpWithUsernamePassword() {
  const mutationKey = ['auth', 'sign-up-with-username-password'];

  const mutationFn = async (params: Credentials) => {
    const response = await fetch('/api/auth/sign-up-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? 'Could not create account');
    }

    return data as SignUpResponse;
  };

  return useMutation({
    mutationKey,
    mutationFn,
  });
}
