export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    const v = process.env.VERCEL_URL;
    return v.startsWith('http') ? v : `https://${v}`;
  }
  return 'http://localhost:3000';
}

export function getCertificateClaimUrl(token: string): string {
  const base = getSiteUrl();
  const params = new URLSearchParams({ token });
  return `${base}/claim/certificate?${params.toString()}`;
}
