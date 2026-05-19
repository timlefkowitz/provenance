#!/usr/bin/env bash
# Smoke-check production sitemap.xml and robots.txt for Search Console.
set -euo pipefail

ORIGIN="${SEO_ORIGIN:-https://www.provenance.guru}"
SITEMAP="${ORIGIN}/sitemap.xml"
ROBOTS="${ORIGIN}/robots.txt"

echo "[verify-seo] sitemap: ${SITEMAP}"
headers="$(curl -sS -D - -o /tmp/provenance-sitemap.xml "${SITEMAP}")"
echo "${headers}" | grep -i '^content-type:' || true

if ! echo "${headers}" | grep -qi 'application/xml'; then
  echo "[verify-seo] FAIL: sitemap Content-Type is not application/xml" >&2
  exit 1
fi

if command -v xmllint >/dev/null 2>&1; then
  xmllint --noout /tmp/provenance-sitemap.xml
else
  echo "[verify-seo] xmllint not installed; skipping XML parse"
fi

if grep -q 'localhost' /tmp/provenance-sitemap.xml; then
  echo "[verify-seo] FAIL: sitemap contains localhost URLs" >&2
  exit 1
fi

url_count="$(grep -c '<loc>' /tmp/provenance-sitemap.xml || true)"
echo "[verify-seo] sitemap URL count: ${url_count}"

echo "[verify-seo] robots: ${ROBOTS}"
robots_body="$(curl -sS "${ROBOTS}")"
echo "${robots_body}"
expected_sitemap="Sitemap: ${ORIGIN}/sitemap.xml"
if ! echo "${robots_body}" | grep -qF "${expected_sitemap}"; then
  echo "[verify-seo] FAIL: robots.txt missing line: ${expected_sitemap}" >&2
  exit 1
fi

echo "[verify-seo] OK"
