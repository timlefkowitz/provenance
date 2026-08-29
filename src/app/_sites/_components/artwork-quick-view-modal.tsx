'use client';

import { openExternalCheckout } from '~/lib/capacitor/open-external-checkout';

/**
 * ArtworkQuickViewModal — shown when artwork_click_behavior === 'modal'.
 *
 * Displays a centered overlay with:
 *   - Large artwork image
 *   - Title, artist, year, dimensions, description
 *   - Price / sold badge
 *   - Inquire + Buy CTAs (when available)
 *   - "View full details →" link to /works/[id]
 *   - Backdrop click / Escape key to close
 */

import { useEffect, useRef, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useSiteArtworkRuntime } from './site-artwork-runtime';
import { submitArtworkInquiry } from '../_actions/submit-artwork-inquiry';
import { useState } from 'react';

function formatCurrency(amount: number | null | undefined, currency: string | null | undefined) {
  if (amount == null) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency ?? 'usd').toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function ArtworkQuickViewModal() {
  const { artworks, activeId, close, accentColor, sellingEnabled } = useSiteArtworkRuntime();

  const artwork = activeId ? artworks.find((a) => a.id === activeId) ?? null : null;

  // Close on Escape
  useEffect(() => {
    if (!artwork) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [artwork, close]);

  // Lock body scroll while open
  useEffect(() => {
    if (artwork) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [artwork]);

  if (!artwork) return null;

  const isSold = !!artwork.sold_at;
  const formattedPrice = formatCurrency(artwork.sale_price, artwork.sale_currency);
  const showPrice = formattedPrice && (artwork.for_sale || isSold);
  const showBuyButton = sellingEnabled && !!artwork.stripe_price_id && artwork.for_sale && !isSold;
  const showInquireButton = artwork.inquire_enabled && !isSold;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={artwork.title}
        style={{
          background: '#fff',
          borderRadius: '6px',
          width: '100%',
          maxWidth: '840px',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            zIndex: 1,
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid #e5e5e5',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={14} strokeWidth={2} color="#444" />
        </button>

        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', minHeight: 0 }}>
          {/* Image */}
          <div style={{ flex: '0 0 auto', width: 'min(360px, 100%)', background: '#f8f8f8' }}>
            {artwork.image_url ? (
              <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1' }}>
                <Image
                  src={artwork.image_url}
                  alt={artwork.title}
                  fill
                  style={{ objectFit: 'contain' }}
                  unoptimized
                  priority
                />
              </div>
            ) : (
              <div style={{ width: '100%', aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#bbb' }}>No image</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div style={{ flex: 1, padding: '32px 28px', minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Title + artist */}
            <div>
              <h2 style={{ margin: 0, fontFamily: 'system-ui, sans-serif', fontSize: '20px', fontWeight: 600, color: '#111', lineHeight: 1.3 }}>
                {artwork.title}
              </h2>
              {artwork.artist_name && (
                <p style={{ margin: '4px 0 0', fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#666' }}>
                  {artwork.artist_name}
                </p>
              )}
              <p style={{ margin: '4px 0 0', fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#aaa' }}>
                {new Date(artwork.created_at).getFullYear()}
              </p>
            </div>

            {/* Dimensions */}
            {artwork.dimensions && (
              <div>
                <p style={{ margin: '0 0 4px', fontFamily: 'system-ui, sans-serif', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa' }}>Dimensions</p>
                <p style={{ margin: 0, fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#444' }}>{artwork.dimensions}</p>
              </div>
            )}

            {/* Description */}
            {artwork.description && (
              <div>
                <p style={{ margin: '0 0 4px', fontFamily: 'system-ui, sans-serif', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa' }}>About this work</p>
                <p style={{ margin: 0, fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#555', lineHeight: 1.6 }}>{artwork.description}</p>
              </div>
            )}

            {/* Price */}
            {showPrice && (
              <div>
                <p style={{ margin: '0 0 4px', fontFamily: 'system-ui, sans-serif', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa' }}>
                  {isSold ? 'Sold' : 'Price'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p style={{ margin: 0, fontFamily: 'system-ui, sans-serif', fontSize: '18px', fontWeight: 600, color: '#111' }}>
                    {formattedPrice}
                  </p>
                  {isSold && (
                    <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', background: '#f0f0f0', color: '#888', padding: '3px 8px', borderRadius: '2px' }}>
                      Sold
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* CTAs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: 'auto', paddingTop: '8px' }}>
              {showInquireButton && <QuickInquireButton artworkId={artwork.id} artworkTitle={artwork.title} accentColor={accentColor} />}
              {showBuyButton && formattedPrice && (
                <BuyButton artworkId={artwork.id} label={`Buy — ${formattedPrice}`} accentColor={accentColor} />
              )}
              <Link
                href={`/works/${artwork.id}`}
                style={{
                  display: 'inline-block',
                  padding: '12px 20px',
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: '12px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: accentColor,
                  textDecoration: 'none',
                  border: `1px solid ${accentColor}`,
                  borderRadius: '2px',
                }}
              >
                View full details →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Inline inquire button (doesn't rely on ArtworkInquireModal's trigger) ──

function QuickInquireButton({ artworkId, artworkTitle, accentColor }: { artworkId: string; artworkTitle: string; accentColor: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    startTransition(async () => {
      const result = await submitArtworkInquiry({ artworkId, ownerAccountId: '', name, email, message });
      if (result.success) {
        setSubmitted(true);
      } else {
        setErrorMsg(result.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: '12px 20px',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: accentColor,
          background: 'transparent',
          border: `1px solid ${accentColor}`,
          borderRadius: '2px',
          cursor: 'pointer',
        }}
      >
        Inquire
      </button>
    );
  }

  return (
    <div style={{ width: '100%', border: `1px solid ${accentColor}20`, borderRadius: '4px', padding: '16px', background: '#fafafa' }}>
      {submitted ? (
        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#444', textAlign: 'center', margin: 0 }}>
          Thank you — we'll be in touch.
        </p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: '0 0 4px', fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#666' }}>
            Inquire about <em>{artworkTitle}</em>
          </p>
          <input
            type="text"
            required
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: '8px 10px', fontFamily: 'system-ui, sans-serif', fontSize: '13px', border: '1px solid #ddd', borderRadius: '3px' }}
          />
          <input
            type="email"
            required
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '8px 10px', fontFamily: 'system-ui, sans-serif', fontSize: '13px', border: '1px solid #ddd', borderRadius: '3px' }}
          />
          <textarea
            rows={2}
            placeholder="Message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ padding: '8px 10px', fontFamily: 'system-ui, sans-serif', fontSize: '13px', border: '1px solid #ddd', borderRadius: '3px', resize: 'vertical' }}
          />
          {errorMsg && <p style={{ margin: 0, fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#c00' }}>{errorMsg}</p>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              disabled={pending}
              style={{ flex: 1, padding: '10px', fontFamily: 'system-ui, sans-serif', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', background: pending ? '#999' : accentColor, color: '#fff', border: 'none', borderRadius: '2px', cursor: pending ? 'not-allowed' : 'pointer' }}
            >
              {pending ? 'Sending…' : 'Send'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ padding: '10px 14px', fontFamily: 'system-ui, sans-serif', fontSize: '12px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: '2px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function BuyButton({ artworkId, label, accentColor }: { artworkId: string; label: string; accentColor: string }) {
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/stripe/create-artwork-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artworkId }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.url) {
      await openExternalCheckout(data.url);
    } else {
      alert(data.error ?? 'Unable to start checkout. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <button
        type="submit"
        style={{
          padding: '12px 20px',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#fff',
          background: accentColor,
          border: `1px solid ${accentColor}`,
          borderRadius: '2px',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    </form>
  );
}
