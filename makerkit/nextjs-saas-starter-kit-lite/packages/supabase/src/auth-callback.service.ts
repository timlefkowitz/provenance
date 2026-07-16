import 'server-only';

import {
  AuthError,
  type EmailOtpType,
  SupabaseClient,
} from '@supabase/supabase-js';

/**
 * @name createAuthCallbackService
 * @description Creates an instance of the AuthCallbackService
 * @param client
 */
export function createAuthCallbackService(client: SupabaseClient) {
  return new AuthCallbackService(client);
}

/**
 * @name AuthCallbackService
 * @description Service for handling auth callbacks in Supabase
 *
 * This service handles a variety of situations and edge cases in Supabase Auth.
 *
 */
class AuthCallbackService {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * @name verifyTokenHash
   * @description Verifies the token hash and type and redirects the user to the next page
   * This should be used when using a token hash to verify the user's email
   * @param request
   * @param params
   */
  async verifyTokenHash(
    request: Request,
    params: {
      redirectPath: string;
      errorPath?: string;
    },
  ): Promise<URL> {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const host = request.headers.get('host');

    // set the host to the request host since outside of Vercel it gets set as "localhost"
    if (url.host.includes('localhost:') && !host?.includes('localhost')) {
      url.host = host as string;
      url.port = '';
    }

    url.pathname = params.redirectPath;

    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type') as EmailOtpType | null;
    const callbackParam =
      searchParams.get('next') ?? searchParams.get('callback');

    let nextPath: string | null = null;

    if (callbackParam) {
      if (
        callbackParam.startsWith('/') &&
        !callbackParam.startsWith('//') &&
        !callbackParam.startsWith('/\\')
      ) {
        // Relative same-origin path (e.g. /update-password or /auth/callback?next=…).
        // new URL('/path') throws without a base, so parse with a dummy base to
        // safely extract a nested ?next param (password-reset PKCE redirect path).
        try {
          const asUrl = new URL(callbackParam, 'https://x');
          const innerNext = asUrl.searchParams.get('next');
          nextPath = innerNext ?? asUrl.pathname;
        } catch {
          nextPath = callbackParam;
        }
      } else {
        // Absolute URL — parse normally; ignore on failure.
        try {
          const callbackUrl = new URL(callbackParam);
          const callbackNextPath = callbackUrl.searchParams.get('next');
          nextPath = callbackNextPath ?? callbackUrl.pathname;
        } catch {
          // invalid or unsafe URL — ignore and keep default redirectPath
        }
      }
    }

    const errorPath = params.errorPath ?? '/auth/callback/error';

    // remove the query params from the url
    searchParams.delete('token_hash');
    searchParams.delete('type');
    searchParams.delete('next');

    // if we have a next path, we redirect to that path
    if (nextPath) {
      url.pathname = nextPath;
    }

    if (token_hash && type) {
      const { error } = await this.client.auth.verifyOtp({
        type,
        token_hash,
      });

      if (!error) {
        return url;
      }

      if (error.code) {
        url.searchParams.set('code', error.code);
      }

      const errorMessage = getAuthErrorMessage({
        error: error.message,
        code: error.code,
      });

      url.searchParams.set('error', errorMessage);
    }

    // return the user to an error page with some instructions
    url.pathname = errorPath;

    return url;
  }

  /**
   * @name exchangeCodeForSession
   * @description Exchanges the auth code for a session and redirects the user to the next page or an error page
   * @param request
   * @param params
   */
  async exchangeCodeForSession(
    request: Request,
    params: {
      redirectPath: string;
      errorPath?: string;
    },
  ): Promise<{
    nextPath: string;
  }> {
    const requestUrl = new URL(request.url);
    const searchParams = requestUrl.searchParams;

    const authCode = searchParams.get('code');
    const error = searchParams.get('error');
    const nextUrlPathFromParams = searchParams.get('next');
    const errorPath = params.errorPath ?? '/auth/callback/error';

    const nextUrl = nextUrlPathFromParams ?? params.redirectPath;

    if (authCode) {
      console.log('[Auth/Callback] exchangeCodeForSession starting', {
        authCodeLength: authCode.length,
        nextUrl,
      });

      try {
        const { error, data } =
          await this.client.auth.exchangeCodeForSession(authCode);

        // if we have an error, we redirect to the error page
        if (error) {
          console.error('[Auth/Callback] exchangeCodeForSession failed', {
            errorMessage: error.message,
            errorCode: error.code,
            errorStatus: error.status,
            name: 'auth.callback',
          });

          return onError({
            code: error.code,
            error: error.message,
            path: errorPath,
          });
        }

        console.log('[Auth/Callback] exchangeCodeForSession succeeded', {
          userId: data?.user?.id,
          provider: data?.user?.app_metadata?.provider,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        console.error('[Auth/Callback] exchangeCodeForSession threw', {
          errorMessage: message,
          errorCode: (error as AuthError)?.code,
          name: 'auth.callback',
        });

        return onError({
          code: (error as AuthError)?.code,
          error: message,
          path: errorPath,
        });
      }
    } else {
      console.log('[Auth/Callback] no auth code present', {
        hasError: !!error,
        nextUrl,
      });
    }

    if (error) {
      console.error('[Auth/Callback] error param from OAuth provider', {
        error,
        name: 'auth.callback',
      });

      return onError({
        error,
        path: errorPath,
      });
    }

    return {
      nextPath: nextUrl,
    };
  }
}

function onError({
  error,
  path,
  code,
}: {
  error: string;
  path: string;
  code?: string;
}) {
  const errorMessage = getAuthErrorMessage({ error, code });

  const searchParams = new URLSearchParams({
    error: errorMessage,
    code: code ?? '',
    // Include the raw Supabase error message so it appears in the URL for
    // easy diagnostics without needing Vercel logs.
    raw: error,
  });

  const nextPath = `${path}?${searchParams.toString()}`;

  return {
    nextPath,
  };
}

/**
 * Checks if the given error message indicates a PKCE verifier error.
 * Multiple Supabase error message variants are checked because the exact
 * wording has changed across Supabase versions and edge cases (e.g. empty
 * verifier vs verifier mismatch vs missing verifier).
 */
function isVerifierError(error: string) {
  const lower = error.toLowerCase();
  return (
    lower.includes('both auth code and code verifier should be non-empty') ||
    lower.includes('code verifier') ||
    lower.includes('pkce') ||
    lower.includes('code_verifier')
  );
}

/**
 * @name getAuthErrorMessage
 * @description Get the auth error message from the error code
 * @param params
 */
function getAuthErrorMessage(params: { error: string; code?: string }) {
  // this error arises when the user tries to sign in with an expired email link
  if (params.code) {
    if (params.code === 'otp_expired') {
      return 'auth:errors.otp_expired';
    }
  }

  // this error arises when the user is trying to sign in with a different
  // browser than the one they used to request the sign in link
  if (isVerifierError(params.error)) {
    return 'auth:errors.codeVerifierMismatch';
  }

  // fallback to the default error message
  return `auth:authenticationErrorAlertBody`;
}
