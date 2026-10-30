# Profile templates: mobile, artwork cropping, saved template

Status: DRAFT, under /plan-design-review (2026-10-19). Items marked **[PENDING]** have no approved fix yet.

## Problem (from Tim)

1. Some profiles and templates look bad on mobile.
2. Some templates crop artworks by forcing them into squares.
3. When a user picks a template, the public must see that template.

## Two template systems (both in scope)

| System | Where it renders | Templates | Where the choice is stored | How it saves |
|---|---|---|---|---|
| Artist profile templates | `/artists/[id]` (`src/app/artists/[id]/page.tsx`) | 6 in `_components/artist-templates.tsx`: manifesto, darkroom, archive, kinetic, broadsheet, void, plus "Default" (no template) | `accounts.public_data.template` | Immediately on click, via `updateArtistTemplate` (fixed in 20fff16) |
| Profile sites | `/_sites/[handle]` + custom domains | 22 in `src/app/_sites/_templates/` | `profile_sites.template_id` | Only when the owner clicks "Save & refresh preview" in `/profile/site` |

## Findings from the code audit

### A. Template persistence

- **A1. Site editor: picking a template does not save it.** `site-editor.tsx:792` sets local state and calls `markUnsaved()`, which only flips `saveStatus` from `saved` to `idle`. The preview iframe already shows the new template, so the owner believes it is done. No unsaved badge, no `beforeunload` guard. If they leave, the public site keeps the old template. Most likely cause of the reported bug. **[PENDING]**
- **A2. Artist templates only apply when the page resolves as an artist.** `page.tsx:697` ignores the saved template unless `userRole === artist`. An artist whose primary role is collector, or a link with `?role=gallery`, shows the default layout to the public even though the owner picked a template. **[PENDING]**
- **A3. `?template=` overrides the saved choice for everyone.** `page.tsx:698`. Useful for previews, but a link copied while previewing shows visitors a template the artist never chose. **[PENDING]**
- **A4. Save failures are silent.** `template-switcher.tsx:31` only `console.error`s. The owner sees nothing and the template does not change. **[PENDING]**
- **A5. No proof that the visitor view matches.** Neither system shows the owner "this is what visitors see". **[PENDING]**

### B. Artwork cropping

Every artwork image uses a fixed-ratio box plus `object-cover`, so anything not matching the box is cut off. Square boxes are the worst for tall or wide work. Inventory:

- Square: `annum.tsx:107`, `chronicle.tsx:103`, `concrete.tsx:58`, `lightbox.tsx:42`, `shopfront.tsx:95`, `ledger.tsx:133`, `artist-templates.tsx:859` (Kinetic hero), `:1118` (Void)
- Fixed rows: `salon.tsx:67` (`auto-rows-[140px]`), `billboard.tsx:81`
- 4/5, 3/4, 5/6: atelier, broadside, cabinet, folio, marginalia, noir, whitecube, artist Archive and Void
- 16/9 or video: `manifesto.tsx:90`, `noir.tsx:54` (full-bleed), `artist-templates.tsx:1034` (Broadsheet)
- Already safe (`object-contain` or masonry): vitrine, artist Darkroom masonry (`columns-*`) still uses `object-cover` inside

Artworks do not store image width/height, so templates cannot size boxes to the real ratio today. **[PENDING: approach]**

### C. Mobile layout

- **C1.** Archive header (`artist-templates.tsx:653`): 12-col grid with the name at `text-4xl uppercase` in `col-span-10`. Long names overflow at 375px. **[PENDING]**
- **C2.** Chronicle (`chronicle.tsx:101`): 4 columns on phones, about 85px thumbnails. **[PENDING]**
- **C3.** folio, lightbox, whitecube, index have zero responsive classes; concrete has 2. Unaudited at 375px. **[PENDING]**
- **C4.** The floating template switcher (`template-switcher.tsx:56`) sits bottom-right over artwork on phones. **[PENDING]**
- **C5.** Site editor template picker (`template-picker.tsx:203`) is 1 column on phones with abstract thumbnails, so choosing means scrolling 22 cards with no real preview. **[PENDING]**

## Out of scope

- New templates. Template visual redesigns beyond cropping and mobile fixes.
- Unifying the two template systems into one (worth a separate decision).
