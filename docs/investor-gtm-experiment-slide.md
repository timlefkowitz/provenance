# Provenance — Paid Acquisition Experiment Slide

*Fill in values from your ad platform (Meta Ads Manager / Google Ads) and from the Provenance admin funnel panel (/admin). Replace every `[____]` before presenting.*

> **Measurement update:** GTM/GA drive ad-conversion attribution and funnel event tracking. The North Star activation metric is **new user → first published certificate within 24 h**. Optimise paid campaigns to this metric, not raw signups, to get a meaningful CAC signal.
>
> **Pre-condition for scaling paid spend:** activation funnel (onboarding → first certificate) must show ≥ 30% within-24 h completion **before** increasing budgets. Measure this via the admin funnel panel (`signup` → `certificate_created`).

---

## Slide: Early Paid Acquisition Experiments

**Objective:** Test messaging and audience fit; establish baseline CAC before scaling.

---

### Experiment Overview

| | Campaign A | Campaign B | Campaign C |
|---|---|---|---|
| **Audience** | [Artists, 25–45, interest: art] | [Gallery owners / managers] | [Art collectors] |
| **Message / Offer** | ["Free certificate for your first artwork"] | ["Invite artists to your next show"] | ["Own your collection's provenance"] |
| **Landing page** | provenance.guru/lp/artist | provenance.guru/lp/gallery | provenance.guru/lp/collector |
| **Platform** | [Meta / IG] | [Meta / LinkedIn] | [Meta / IG] |
| **Dates** | [____] | [____] | [____] |
| **Spend** | $[___] | $[___] | $[___] |

---

### Funnel Results

| | Campaign A | Campaign B | Campaign C |
|---|---|---|---|
| **Impressions** | [____] | [____] | [____] |
| **Link clicks** | [____] | [____] | [____] |
| **CTR** | [__%] | [__%] | [__%] |
| **CPC** | $[___] | $[___] | $[___] |
| **Signups** | [____] | [____] | [____] |
| **Landing → signup conv.** | [__%] | [__%] | [__%] |
| **Onboarding complete** | [____] | [____] | [____] |
| **First artwork uploaded** | [____] | [____] | [____] |
| **Activated (cert within 24 h)** | [____] | [____] | [____] |
| **Estimated CAC (activation-based)** | $[___] | $[___] | $[___] |

> *Funnel counts come from the Provenance admin panel → "ad_funnel" section. Activation-based CAC = total spend ÷ activated users (those who created a certificate within 24 h of signup).*

---

### Key Learnings

1. **Winner:** [Campaign X] — lowest CAC at $[___], [___]% landing-to-signup conversion.
2. **Insight:** [e.g., "Artist 'free certificate' angle outperformed gallery angle 2:1 on CTR."]
3. **Drop-off point:** [e.g., "Biggest drop is landing page → signup — testing shorter form next."]
4. **Paused:** [Campaign Y] — $[___] CAC with [___]% onboarding completion; not efficient at $10/mo ARPU.

---

### Primary GTM Channel (Not Paid Ads)

| Channel | Users acquired | CAC | Notes |
|---------|---------------|-----|-------|
| Gallery direct outreach | [____] | $0 | [Gallery name] pilot |
| CAM / SXSW events | [____] | $0 | [Event name], [date] |
| Artist referral | [____] | $0 | Word of mouth from [name] |
| Paid Meta (best campaign) | [____] | $[___] | Campaign [X] |

> Organic and event channels outperform paid at this stage — consistent with niche B2B2C dynamics. Paid spend is used to sharpen message, not as primary growth engine.

---

### Next Spend Allocation

| Action | Budget | Goal |
|--------|--------|------|
| Scale Campaign [X] | $[___] | [___] signups at <$[___] CAC |
| Landing page A/B test (shorter form) | — | Improve [__%] → [__%] conversion |
| Retargeting: lp/artist visitors who didn't sign up | $[___] | Recover high-intent traffic |
| [Gallery / event channel] | $[___] | [Specific outcome] |

---

*All data is from live production. Funnel tracked via GTM (`signup`, `trial_started`, `purchase`, `onboarding_complete`, `artwork_created`). Attribution via first-touch UTM cookie (`pv_utm`) captured by `UtmCapture` component.*
