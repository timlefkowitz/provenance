export const metadata = {
  title: 'Provenance Verification API',
  description: 'Unified asset verification API for all Provenance planets',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
