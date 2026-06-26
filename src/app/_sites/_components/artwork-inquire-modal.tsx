'use client';

import { useState, useTransition } from 'react';
import { submitArtworkInquiry } from '../_actions/submit-artwork-inquiry';

type Props = {
  artworkId: string;
  ownerAccountId: string;
  artworkTitle: string;
  accentColor?: string;
};

export function ArtworkInquireModal({
  artworkId,
  ownerAccountId,
  artworkTitle,
  accentColor = '#4A2F25',
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpen() {
    setOpen(true);
    setSubmitted(false);
    setError(null);
  }

  function handleClose() {
    setOpen(false);
    setName('');
    setEmail('');
    setMessage('');
    setError(null);
    setSubmitted(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitArtworkInquiry({
        artworkId,
        ownerAccountId,
        name,
        email,
        message,
      });
      if (result.success) {
        setSubmitted(true);
      } else {
        setError(result.error);
      }
    });
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#888',
    marginBottom: '6px',
  };

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        style={{
          display: 'inline-block',
          padding: '12px 28px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '13px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: accentColor,
          background: 'transparent',
          border: `1px solid ${accentColor}`,
          borderRadius: '2px',
          cursor: 'pointer',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = accentColor;
          (e.currentTarget as HTMLButtonElement).style.color = '#fff';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = accentColor;
        }}
      >
        Inquire
      </button>

      {/* Backdrop + dialog */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '4px',
              width: '100%',
              maxWidth: '440px',
              padding: '36px',
              position: 'relative',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            {/* Close */}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                color: '#999',
                lineHeight: 1,
              }}
            >
              ×
            </button>

            {submitted ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <p
                  style={{
                    fontFamily: 'system-ui, sans-serif',
                    fontSize: '16px',
                    color: '#111',
                    marginBottom: '8px',
                  }}
                >
                  Thank you for your inquiry.
                </p>
                <p
                  style={{
                    fontFamily: 'system-ui, sans-serif',
                    fontSize: '13px',
                    color: '#666',
                  }}
                >
                  We will be in touch shortly.
                </p>
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    marginTop: '24px',
                    padding: '10px 24px',
                    fontFamily: 'system-ui, sans-serif',
                    fontSize: '12px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    background: accentColor,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '2px',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <h2
                  style={{
                    fontFamily: 'system-ui, sans-serif',
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#111',
                    marginTop: 0,
                    marginBottom: '4px',
                  }}
                >
                  Inquire about this work
                </h2>
                <p
                  style={{
                    fontFamily: 'system-ui, sans-serif',
                    fontSize: '13px',
                    color: '#666',
                    marginBottom: '24px',
                  }}
                >
                  {artworkTitle}
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label htmlFor="inq-name" style={labelStyle}>Name *</label>
                    <input
                      id="inq-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label htmlFor="inq-email" style={labelStyle}>Email *</label>
                    <input
                      id="inq-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label htmlFor="inq-message" style={labelStyle}>Message</label>
                    <textarea
                      id="inq-message"
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Any questions or specific interest..."
                      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'system-ui, sans-serif' }}
                    />
                  </div>

                  {error && (
                    <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#c00' }}>
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={pending}
                    style={{
                      padding: '12px 24px',
                      fontFamily: 'system-ui, sans-serif',
                      fontSize: '13px',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      background: pending ? '#999' : accentColor,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '2px',
                      cursor: pending ? 'not-allowed' : 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    {pending ? 'Sending…' : 'Send Inquiry'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
