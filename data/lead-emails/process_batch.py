#!/usr/bin/env python3
"""Process lead JSON batches: classify emails, dedupe against master registry."""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent
REGISTRY_PATH = ROOT / "master-registry.json"
GOOD_EMAILS_PATH = ROOT / "good-emails.txt"

DISPOSABLE_OR_DEAD_DOMAINS = {
    "webtv.net",
    "excite.com",
    "kittymail.com",
    "netzero.net",
    "in.com",
    "freelancer.com",
}

STUDIO_DOMAINS = {
    "rockstargames.com",
    "naughtydog.com",
    "netherrealm.com",
    "valvesoftware.com",
}

LARGE_CORPORATE_DOMAINS = {
    "att.com",
    "guitarcenter.com",
    "subway.com",
    "kyani.com",
    "universalmusic.com",
    "mine.se",
    "iii.org.tw",
    "awidercircle.org",
    "daycomtech.com",
    "bhcefcu.org",
    "gtf.org",
    "elnk.com",
    "dedeman.ro",
    "keldyn.com",
    "quantam.net",
    "maybank.co.id",
    "renaissance.ie",
    "vianet.ca",
    "music-group.com",
}

GENERIC_LOCAL_PARTS = {"info", "contact", "hello", "admin", "support", "sales"}


def normalize_email(email: str) -> str:
    return email.strip().lower()


def domain(email: str) -> str:
    return email.rsplit("@", 1)[-1].lower()


def local_part(email: str) -> str:
    return email.rsplit("@", 1)[0].lower()


def name_tokens(first: str, last: str, full: str) -> set[str]:
    tokens: set[str] = set()
    for part in (first, last, full):
        for token in re.split(r"[\s._-]+", part.lower()):
            if len(token) >= 3:
                tokens.add(token)
    return tokens


def domain_matches_company(email: str, company_domain: str, company_name: str) -> bool:
    dom = domain(email)
    email_dom_slug = re.sub(r"[^a-z0-9]", "", dom.split(".")[0])

    if company_domain:
        company_domain = company_domain.lower().strip()
        if dom == company_domain or dom.endswith("." + company_domain):
            return True

    company_slug = re.sub(r"[^a-z0-9]", "", company_name.lower())
    dom_compact = dom.replace(".", "")
    if company_slug and len(company_slug) >= 4 and company_slug in dom_compact:
        return True
    if email_dom_slug and len(email_dom_slug) >= 4 and email_dom_slug in company_slug:
        return True
    return False


def classify_lead(lead: dict, segment: str = "") -> tuple[str, str]:
    """Return (quality, reason) where quality is good | maybe | bad."""
    email = (lead.get("email") or "").strip()
    if not email or "@" not in email:
        return "bad", "missing_email"

    status = (lead.get("emailStatus") or "").lower()
    dom = domain(email)
    lp = local_part(email)
    first = lead.get("firstName") or ""
    last = lead.get("lastName") or ""
    full = lead.get("fullName") or ""
    company_domain = lead.get("companyDomain") or ""
    company_name = lead.get("companyName") or ""
    title = (lead.get("title") or "").lower()

    if status == "unavailable":
        return "bad", "source_unavailable"

    if dom in DISPOSABLE_OR_DEAD_DOMAINS:
        return "bad", "dead_or_disposable_domain"

    tokens = name_tokens(first, last, full)
    lp_alnum = re.sub(r"[^a-z0-9]", "", lp)
    name_in_local = any(t in lp_alnum or t in lp for t in tokens if len(t) >= 4)
    wrong_person = bool(tokens) and not name_in_local and lp not in {"info", "mail", "artist", "pr", "cn"}

    # Obvious wrong-person emails (e.g. b.garza28@ for Anna Rdz)
    if wrong_person and dom in {"yahoo.com", "yahoo.co.uk", "yahoo.com.tr", "gmail.com", "hotmail.com"}:
        return "bad", "email_name_mismatch"

    if wrong_person and not domain_matches_company(email, company_domain, company_name):
        return "bad", "email_name_mismatch"

    if wrong_person and dom in DISPOSABLE_OR_DEAD_DOMAINS:
        return "bad", "email_name_mismatch"

    own_domain = domain_matches_company(email, company_domain, company_name)
    email_dom_slug = re.sub(r"[^a-z0-9]", "", dom.split(".")[0])
    full_slug = re.sub(r"[^a-z0-9]", "", full.lower())
    if not own_domain and email_dom_slug and len(email_dom_slug) >= 4 and email_dom_slug in full_slug:
        own_domain = True

    if status == "deliverable":
        if own_domain or dom.endswith(".gov") or dom.endswith(".gov.uk") or dom.endswith(".edu"):
            return "good", "verified_deliverable"
        return "good", "verified_deliverable_personal"

    if own_domain:
        if segment == "artist" and dom in LARGE_CORPORATE_DOMAINS:
            return "maybe", "large_corporate_employee"
        if lp in GENERIC_LOCAL_PARTS:
            return "maybe", "generic_role_own_domain"
        if status == "pattern_match":
            return "good", "own_domain_pattern_match"
        return "good", "own_domain"

    if dom in STUDIO_DOMAINS and name_in_local:
        return "good", "studio_employee_name_match"

    # Institutional emails where source marked pattern_match and address fits the person
    if status == "pattern_match" and dom in {"nga.gov", "musicchoice.com", "music-group.com"}:
        if name_in_local or "." in lp or "_" in lp:
            return "good", "institutional_pattern_match"

    if status == "pattern_match" and dom.endswith((".edu", ".gov", ".gov.uk", ".ac.uk")):
        if name_in_local or "." in lp or "_" in lp:
            return "good", "institutional_pattern_match"
        return "maybe", "institutional_pattern_match_unverified"

    if status == "pattern_match":
        return "bad", "pattern_match_wrong_company"

    if lp in GENERIC_LOCAL_PARTS:
        return "maybe", "generic_role_address"

    if dom in {"gmail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com", "hotmail.co.nz", "yahoo.com.tr"}:
        if name_in_local or any(t in lp for t in tokens):
            return "maybe", "personal_email"
        return "bad", "personal_unverified"

    if dom.endswith(".rr.com") or dom.endswith(".net") or dom.endswith(".ca"):
        return "maybe", "isp_email"

    return "maybe", "unverified"


def load_registry() -> dict:
    if REGISTRY_PATH.exists():
        return json.loads(REGISTRY_PATH.read_text())
    return {"version": 1, "updatedAt": None, "entries": {}}


def save_registry(registry: dict) -> None:
    registry["updatedAt"] = datetime.now(timezone.utc).isoformat()
    REGISTRY_PATH.write_text(json.dumps(registry, indent=2) + "\n")


def save_good_emails(registry: dict) -> None:
    good = sorted(
        e["email"]
        for e in registry["entries"].values()
        if e.get("quality") == "good"
    )
    GOOD_EMAILS_PATH.write_text("\n".join(good) + ("\n" if good else ""))


def process_batch(leads: list[dict], batch_id: str, segment: str) -> dict:
    registry = load_registry()
    entries = registry.setdefault("entries", {})

    summary = {
        "batchId": batch_id,
        "segment": segment,
        "total": len(leads),
        "new": 0,
        "duplicate": 0,
        "good": [],
        "maybe": [],
        "bad": [],
    }

    for lead in leads:
        email = (lead.get("email") or "").strip()
        if not email:
            continue
        key = normalize_email(email)
        quality, reason = classify_lead(lead, segment)

        if key in entries:
            summary["duplicate"] += 1
            continue

        summary["new"] += 1
        entries[key] = {
            "email": email,
            "quality": quality,
            "reason": reason,
            "emailStatus": lead.get("emailStatus") or "",
            "fullName": lead.get("fullName") or "",
            "title": lead.get("title") or "",
            "companyName": lead.get("companyName") or "",
            "companyDomain": lead.get("companyDomain") or "",
            "batchId": batch_id,
            "segment": segment,
            "importedAt": datetime.now(timezone.utc).isoformat(),
        }
        summary[quality].append(email)

    save_registry(registry)
    save_good_emails(registry)
    return summary


def main() -> None:
    if len(sys.argv) < 4:
        print(
            "Usage: process_batch.py <batch-json-file> <batch-id> <segment>\n"
            "  segment: registrar | artist | other",
            file=sys.stderr,
        )
        sys.exit(1)

    batch_path = Path(sys.argv[1])
    batch_id = sys.argv[2]
    segment = sys.argv[3]
    leads = json.loads(batch_path.read_text())
    summary = process_batch(leads, batch_id, segment)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
