/**
 * Layout for the site preview route. Inherits the root <html>/<body>,
 * but the navbar already excludes /profile/site/preview via its pathname check.
 *
 * We add a body class so global container/padding utilities don't apply.
 */
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <div className="site-preview-root">{children}</div>;
}
