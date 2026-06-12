import {
  buildGoogleFontsUrl,
  resolveFontPairing,
} from '../_templates/palette';

type Props = {
  fontPairingKey: string;
};

/**
 * Loads Google Fonts and sets --site-font-heading / --site-font-body CSS vars
 * when the user picks a non-default typography pairing.
 */
export function SiteFontStyles({ fontPairingKey }: Props) {
  const pairing = resolveFontPairing(fontPairingKey);
  const fontsUrl = buildGoogleFontsUrl(pairing.googleFamilies);

  if (!fontsUrl) return null;

  const headingStack = pairing.heading
    ? `"${pairing.heading}", Georgia, "Times New Roman", serif`
    : undefined;
  const bodyStack = pairing.body
    ? `"${pairing.body}", system-ui, -apple-system, sans-serif`
    : undefined;

  return (
    <>
      <link rel="stylesheet" href={fontsUrl} />
      <style>{`
        :root {
          ${headingStack ? `--site-font-heading: ${headingStack};` : ''}
          ${bodyStack ? `--site-font-body: ${bodyStack};` : ''}
        }
        h1, h2, h3, h4 {
          font-family: var(--site-font-heading, inherit);
        }
      `}</style>
    </>
  );
}
