import { isNativePlatform } from '~/lib/capacitor/is-native';
import { canPrintNatively, NativePrint } from '~/lib/capacitor/print';

/**
 * In-page print preview, used where a print pop-up can't open: the iOS app
 * (its WKWebView refuses window.open) and browsers that block pop-ups.
 *
 * The document is written into a full-screen iframe so it renders exactly as
 * it would in the pop-up. Print hands the finished HTML to the native print
 * sheet in the app, or prints the iframe in a browser.
 *
 * `prepare` runs against the iframe's window after the HTML is written (book
 * catalogs are laid out there).
 */
export function openPrintPreview(html: string, prepare?: (win: Window) => void): void {
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Print preview');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483000',
    display: 'flex',
    flexDirection: 'column',
    background: '#f4f1ea',
  } satisfies Partial<CSSStyleDeclaration>);

  const bar = document.createElement('div');
  Object.assign(bar.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: 'calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px',
    background: '#1a1209',
    color: '#fff',
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    flex: '0 0 auto',
  } satisfies Partial<CSSStyleDeclaration>);

  const makeButton = (label: string, primary: boolean) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    Object.assign(b.style, {
      minHeight: '40px',
      padding: '0 16px',
      borderRadius: '6px',
      border: primary ? 'none' : '1px solid rgba(255,255,255,0.4)',
      background: primary ? '#fff' : 'transparent',
      color: primary ? '#1a1209' : '#fff',
      font: 'inherit',
      cursor: 'pointer',
    } satisfies Partial<CSSStyleDeclaration>);
    return b;
  };

  const closeBtn = makeButton('Close', false);
  const title = document.createElement('span');
  title.textContent = 'Print preview';
  Object.assign(title.style, { flex: '1', textAlign: 'center', opacity: '0.8' });
  const printBtn = makeButton('Print', true);
  bar.append(closeBtn, title, printBtn);

  // iOS Safari sizes iframes to their content; the wrapper does the scrolling.
  const scroller = document.createElement('div');
  Object.assign(scroller.style, {
    flex: '1 1 auto',
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  } as Partial<CSSStyleDeclaration>);

  const frame = document.createElement('iframe');
  frame.title = 'Print preview';
  Object.assign(frame.style, { width: '100%', height: '100%', border: '0', background: '#fff', display: 'block' });
  scroller.append(frame);
  overlay.append(bar, scroller);
  document.body.append(overlay);

  const win = frame.contentWindow;
  const doc = frame.contentDocument;
  if (!win || !doc) {
    console.error('[Print] Preview iframe has no document');
    overlay.remove();
    document.body.style.overflow = previousOverflow;
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  prepare?.(win);

  const close = () => {
    overlay.remove();
    document.body.style.overflow = previousOverflow;
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  closeBtn.addEventListener('click', close);

  printBtn.addEventListener('click', async () => {
    if (canPrintNatively()) {
      printBtn.disabled = true;
      printBtn.textContent = 'Opening…';
      try {
        // Serialised after layout, so book catalogs print already imposed.
        const finished = `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
        await NativePrint.printHtml({ html: finished, baseUrl: window.location.origin, jobName: doc.title || 'Provenance' });
      } catch (err) {
        console.error('[Print] Native print failed', err);
        alert('Could not open the print sheet. Please try again.');
      } finally {
        printBtn.disabled = false;
        printBtn.textContent = 'Print';
      }
      return;
    }
    if (isNativePlatform()) {
      // App builds from before PrintPlugin: WKWebView ignores window.print().
      alert('Printing from the app needs the latest app update. You can also print from provenance.guru in Safari.');
      return;
    }
    try {
      win.focus();
      win.print();
    } catch (err) {
      console.error('[Print] Preview print failed', err);
      window.print();
    }
  });

  console.log('[Print] Opened in-page print preview', { native: isNativePlatform() });
}
