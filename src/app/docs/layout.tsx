import { DocsSidebar } from './_components/docs-sidebar';
import { docsMainClass, docsShellBg } from './_components/docs-tokens';

export const metadata = {
  title: 'Documentation | Provenance',
  description: 'User guide and developer API reference for Provenance.',
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`flex min-h-screen flex-col md:flex-row ${docsShellBg}`}>
      <DocsSidebar />
      <main className={docsMainClass}>{children}</main>
    </div>
  );
}
