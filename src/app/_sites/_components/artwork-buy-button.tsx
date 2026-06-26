'use client';

type Props = {
  artworkId: string;
  label: string;
  accentColor: string;
};

export function ArtworkBuyButton({ artworkId, label, accentColor }: Props) {
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/stripe/create-artwork-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artworkId }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert(data.error ?? 'Unable to start checkout. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <button
        type="submit"
        style={{
          display: 'inline-block',
          padding: '12px 28px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '13px',
          letterSpacing: '0.1em',
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
