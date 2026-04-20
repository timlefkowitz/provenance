import {
  ExternalLink,
  Facebook,
  Github,
  Globe,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
} from 'lucide-react';
import type { ComponentType } from 'react';

interface PlatformInfo {
  Icon: ComponentType<{ className?: string }>;
  label: string;
  color: string;
}

/** Normalise a raw URL string so URL() can parse it. */
function ensureProtocol(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

/**
 * Extract a clean path segment, stripping leading slash and trailing slash/query.
 * e.g. "/flightgallery/?hl=en" → "flightgallery"
 */
function firstPathSegment(pathname: string): string {
  return pathname.replace(/^\//, '').split('/')[0]?.replace(/\?.*$/, '') ?? '';
}

function detectPlatform(url: URL): PlatformInfo {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const seg = firstPathSegment(url.pathname);

  if (host === 'instagram.com') {
    return {
      Icon: Instagram,
      label: seg ? `@${seg}` : 'Instagram',
      color: 'text-[#E1306C]',
    };
  }
  if (host === 'twitter.com' || host === 'x.com') {
    const handle = seg.startsWith('@') ? seg : seg ? `@${seg}` : 'X / Twitter';
    return { Icon: Twitter, label: handle, color: 'text-[#1DA1F2]' };
  }
  if (host === 'linkedin.com') {
    const parts = url.pathname.replace(/^\//, '').split('/').filter(Boolean);
    const name = parts[1] ?? parts[0] ?? 'LinkedIn';
    return { Icon: Linkedin, label: name, color: 'text-[#0A66C2]' };
  }
  if (host === 'youtube.com' || host === 'youtu.be') {
    const name = seg.startsWith('@') ? seg : seg ? `@${seg}` : 'YouTube';
    return { Icon: Youtube, label: name, color: 'text-[#FF0000]' };
  }
  if (host === 'facebook.com' || host === 'fb.com') {
    return { Icon: Facebook, label: seg || 'Facebook', color: 'text-[#1877F2]' };
  }
  if (host === 'github.com') {
    return { Icon: Github, label: seg || 'GitHub', color: 'text-ink' };
  }
  // Generic — show hostname without www.
  return { Icon: Globe, label: host || url.href, color: 'text-wine' };
}

interface SocialLinkItemProps {
  url: string;
}

export function SocialLinkItem({ url }: SocialLinkItemProps) {
  let parsed: URL | null = null;
  try {
    parsed = new URL(ensureProtocol(url));
  } catch {
    // Unparseable — fall back to raw display
  }

  const href = parsed ? parsed.href : ensureProtocol(url);

  if (!parsed) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 text-wine hover:text-wine/80 hover:underline font-serif text-sm"
      >
        <ExternalLink className="h-4 w-4 shrink-0" />
        <span className="truncate">{url}</span>
      </a>
    );
  }

  const { Icon, label, color } = detectPlatform(parsed);

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2.5 group font-serif text-sm text-ink hover:text-wine transition-colors"
    >
      <Icon className={`h-4 w-4 shrink-0 ${color} group-hover:opacity-80 transition-opacity`} />
      <span className="truncate group-hover:underline">{label}</span>
    </a>
  );
}
