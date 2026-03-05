import { InvestorsNav } from './_components/investors-nav';

export default function InvestorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-parchment text-ink">
      <InvestorsNav />
      {children}
    </div>
  );
}
