'use client';

import { openExternalCheckout } from '~/lib/capacitor/open-external-checkout';

/**
 * ArtworkLightbox — shown when artwork_click_behavior === 'lightbox'.
 *
 * Full-screen overlay showing the active artwork with:
 *   - Large image filling the screen
 *   - Prev / Next navigation (arrow keys + on-screen buttons)
 *   - Details panel: title, artist, price, dimensions, description
 *   - Inquire + Buy CTAs
 *   - "View full details →" link to /works/[id]
 *   - Backdrop click / Escape key to close
 */

import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSiteArtworkRuntime } from './site-artwork-runtime';
import { submitArtworkInquiry } from '../_actions/submit-artwork-inquiry';

function formatCurrency(amount: number | null | undefined, currency: string | null | undefined) {
  if (amount == null) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency ?? 'usd').toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function ArtworkLightbox() {
  const { artworks, activeId, close, prev, next, accentColor, sellingEnabled } = useSiteArtworkRuntime();

  const artwork = activeId ? artworks.find((a) => a.id === activeId) ?? null : null;
  const activeIdx = activeId ? artworks.findIndex((a) => a.id === activeId) : -1;
  const hasPrev = activeIdx > 0;
  const hasNext = activeIdx >= 0 && activeIdx < artworks.length - 1;

  // Keyboard navigation
  useEffect(() => {
    if (!artwork) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [artwork, close, prev, next]);

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
        background: 'rgba(0,0,0,0.92)',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      {/* Prev button */}
      <button
        type="button"
        onClick={prev}
        disabled={!hasPrev}
        aria-label="Previous artwork"
        style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1,
          background: hasPrev ? 'rgba(255,255,255,0.15)' : 'transparent',
          border: 'none',
          borderRadius: '50%',
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: hasPrev ? 'pointer' : 'default',
          opacity: hasPrev ? 1 : 0.25,
          transition: 'background 0.15s',
        }}
      >
        <ChevronLeft size={22} color="#fff" />
      </button>

      {/* Next button */}
      <button
        type="button"
        onClick={next}
        disabled={!hasNext}
        aria-label="Next artwork"
        style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1,
          background: hasNext ? 'rgba(255,255,255,0.15)' : 'transparent',
          border: 'none',
          borderRadius: '50%',
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: hasNext ? 'pointer' : 'default',
          opacity: hasNext ? 1 : 0.25,
          transition: 'background 0.15s',
        }}
      >
        <ChevronRight size={22} color="#fff" />
      </button>

      {/* Close button */}
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        style={{
          position: 'absolute',
          top: '14px',
          right: '14px',
          zIndex: 2,
          background: 'rgba(255,255,255,0.12)',
          border: 'none',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={16} color="#fff" strokeWidth={2} />
      </button>

      {/* Image area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 80px 60px 80px',
          minWidth: 0,
        }}
        onClick={close}
      >
        {artwork.image_url ? (
          <div
            style={{ position: 'relative', width: '100%', height: '100%', maxWidth: '700px', maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: '400px', aspectRatio: '1', background: '#222' }}>
            <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#666' }}>No image</span>
          </div>
        )}
      </div>

      {/* Details panel */}
      <div
        style={{
          width: '320px',
          flexShrink: 0,
          background: '#111',
          color: '#f0f0f0',
          overflowY: 'auto',
          padding: '60px 28px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Counter */}
        <p style={{ margin: 0, fontFamily: 'system-ui, sans-serif', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#666' }}>
          {activeIdx + 1} / {artworks.length}
        </p>

        {/* Title */}
        <div>
          <h2 style={{ margin: '0 0 4px', fontFamily: 'system-ui, sans-serif', fontSize: '18px', fontWeight: 600, color: '#f0f0f0', lineHeight: 1.3 }}>
            {artwork.title}
          </h2>
          {artwork.artist_name && (
            <p style={{ margin: '2px 0 0', fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#999' }}>
              {artwork.artist_name}
            </p>
          )}
          <p style={{ margin: '2px 0 0', fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#666' }}>
            {new Date(artwork.created_at).getFullYear()}
          </p>
        </div>

        {/* Dimensions */}
        {artwork.dimensions && (
          <div>
            <p style={{ margin: '0 0 3px', fontFamily: 'system-ui, sans-serif', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#555' }}>Dimensions</p>
            <p style={{ margin: 0, fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#bbb' }}>{artwork.dimensions}</p>
          </div>
        )}

        {/* Description */}
        {artwork.description && (
          <div>
            <p style={{ margin: '0 0 3px', fontFamily: 'system-ui, sans-serif', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#555' }}>About</p>
            <p style={{ margin: 0, fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#aaa', lineHeight: 1.6 }}>{artwork.description}</p>
          </div>
        )}

        {/* Price */}
        {showPrice && (
          <div>
            <p style={{ margin: '0 0 3px', fontFamily: 'system-ui, sans-serif', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#555' }}>
              {isSold ? 'Sold' : 'Price'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <p style={{ margin: 0, fontFamily: 'system-ui, sans-serif', fontSize: '18px', fontWeight: 600, color: '#f0f0f0' }}>
                {formattedPrice}
              </p>
              {isSold && (
                <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', background: '#333', color: '#888', padding: '3px 7px', borderRadius: '2px' }}>
                  Sold
                </span>
              )}
            </div>
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto', paddingTop: '8px' }}>
          {showInquireButton && <LightboxInquireButton artworkId={artwork.id} artworkTitle={artwork.title} accentColor={accentColor} />}
          {showBuyButton && formattedPrice && <LightboxBuyButton artworkId={artwork.id} label={`Buy — ${formattedPrice}`} accentColor={accentColor} />}
          <Link
            href={`/works/${artwork.id}`}
            style={{
              display: 'block',
              padding: '11px 16px',
              fontFamily: 'system-ui, sans-serif',
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#aaa',
              textDecoration: 'none',
              border: '1px solid #333',
              borderRadius: '2px',
              textAlign: 'center',
            }}
          >
            View full details →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Inline inquire button for lightbox ──

function LightboxInquireButton({ artworkId, artworkTitle, accentColor }: { artworkId: string; artworkTitle: string; accentColor: string }) {
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
          display: 'block',
          width: '100%',
          padding: '11px 16px',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: accentColor,
          background: 'transparent',
          border: `1px solid ${accentColor}`,
          borderRadius: '2px',
          cursor: 'pointer',
          textAlign: 'center',
        }}
      >
        Inquire
      </button>
    );
  }

  return (
    <div style={{ background: '#1a1a1a', borderRadius: '4px', padding: '14px' }}>
      {submitted ? (
        <p style={{ margin: 0, fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#aaa', textAlign: 'center' }}>
          Thank you — we'll be in touch.
        </p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: '0 0 4px', fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#666' }}>
            Inquire about <em style={{ color: '#aaa' }}>{artworkTitle}</em>
          </p>
          {[
            { placeholder: 'Your name', value: name, onChange: (v: string) => setName(v), type: 'text', required: true },
            { placeholder: 'your@email.com', value: email, onChange: (v: string) => setEmail(v), type: 'email', required: true },
          ].map((f, i) => (
            <input
              key={i}
              type={f.type}
              required={f.required}
              placeholder={f.placeholder}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              style={{ padding: '7px 10px', fontFamily: 'system-ui, sans-serif', fontSize: '12px', border: '1px solid #333', borderRadius: '3px', background: '#222', color: '#ddd' }}
            />
          ))}
          <textarea
            rows={2}
            placeholder="Message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ padding: '7px 10px', fontFamily: 'system-ui, sans-serif', fontSize: '12px', border: '1px solid #333', borderRadius: '3px', background: '#222', color: '#ddd', resize: 'vertical' }}
          />
          {errorMsg && <p style={{ margin: 0, fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#f87' }}>{errorMsg}</p>}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="submit"
              disabled={pending}
              style={{ flex: 1, padding: '8px', fontFamily: 'system-ui, sans-serif', fontSize: '11px', background: pending ? '#555' : accentColor, color: '#fff', border: 'none', borderRadius: '2px', cursor: pending ? 'not-allowed' : 'pointer' }}
            >
              {pending ? 'Sending…' : 'Send'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ padding: '8px 10px', fontFamily: 'system-ui, sans-serif', fontSize: '11px', background: '#2a2a2a', color: '#888', border: 'none', borderRadius: '2px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function LightboxBuyButton({ artworkId, label, accentColor }: { artworkId: string; label: string; accentColor: string }) {
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
          display: 'block',
          width: '100%',
          padding: '11px 16px',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#fff',
          background: accentColor,
          border: `1px solid ${accentColor}`,
          borderRadius: '2px',
          cursor: 'pointer',
          textAlign: 'center',
        }}
      >
        {label}
      </button>
    </form>
  );
}
