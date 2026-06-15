# Artworks & collection

Artworks are the core records in Provenance. Each artwork can have images, provenance metadata, tags, and an associated certificate.

## Browse artworks

The public **Artworks** feed (`/artworks`) shows verified certificates of authenticity from artists who have made their work public. Use the search bar to filter by title or artist.

## Your collection

Go to **Collection** (`/artworks/my`) to see all artworks you own or manage. From here you can:

- View artwork details and certificate status
- Edit provenance fields
- Toggle public visibility
- Delete artworks you created

## Adding artworks

### Single artwork

1. Click **Add artwork** in the navigation (or go to `/artworks/add`).
2. Upload one or more images (JPEG, PNG, HEIC supported).
3. Fill in title, medium, dimensions, year, and other metadata.
4. Save — the artwork appears in your collection.

### Batch upload

Use the batch upload flow on `/artworks/add` to upload multiple images at once. Each image becomes a separate artwork draft you can edit individually.

## Editing provenance

Provenance fields capture the history and context of an artwork:

- **Creation details** — date, location, medium
- **Exhibition history** — where the work has been shown
- **Ownership chain** — previous owners and transfers
- **Condition notes** — conservation and condition reports

Edit a single artwork at `/artworks/[id]/edit`, or use the bulk editor at `/artworks/edit-provenance` to update many records at once.

## Visibility

Each artwork can be **public** or **private**:

- **Public** artworks appear in the browse feed and on your creator website.
- **Private** artworks are visible only to you (and gallery team members with access).

Toggle visibility from the artwork edit page or collection list.

## Tags

Organize artworks with custom tags at `/artworks/tags`. Tags help filter your collection and can appear on your public site.

## Favorites & following

From the Portal or artwork pages, you can **favorite** artworks and **follow** artists to stay updated on their activity.
