# Provence

## A History-of-Art & Collectibles Platform with AVAX Provenance

**Provence** is a digital platform that blends a historical journal aesthetic with an art & collectibles encyclopedia and crypto-backed provenance verification using Avalanche (AVAX).

### Core Concept
To create a high-trust digital archive where each artwork, artifact, or collectible has:
- Verified provenance entries
- Immutable historical timelines
- Contributor signatures
- High-resolution images
- Market history

**Vibe:** The New Republic meets an art registry meets modern blockchain infrastructure.

### Visual & Brand Style
- **Typography:**
  - Title / Brand: Engravers Roman, Garamond Titling, Bodoni Antique
  - Subtitles & Navigation: Caslon Italic, Garamond Italic
  - Body Text: Garamond, Caslon, Goudy Old Style
- **Color Palette:**
  - Background: Cream parchment (#F5F1E8)
  - Text: Black (#111111)
  - Accents: Deep wine / sepia (#4A2F25)
- **Layout:** Wide margins, thin double border boxes, centered titles, decorative horizontal rules. Minimalistic, classic, trustworthy, scholarly.

### Information Architecture

#### Home Page
- Periodical cover aesthetic
- Masthead: "PROVENCE"
- Subtitle: "A Journal of Art, Objects & Their Histories"

#### Sections
1. **Artworks**: Paintings, sculpture, prints with provenance registry.
2. **Collectibles**: Books, coins, vinyl, toys, instruments, posters.
3. **Provenance Registry (AVAX On-Chain)**: Ownership timeline, doc uploads, certificates of authenticity on Avalanche C-Chain.
4. **Articles & Essays**: Historical narratives, collecting guides, artist profiles.
5. **Market History**: Sales data, valuations.

### AVAX Integration Plan

#### On-Chain Data
- Hashes of provenance documents
- Transfer events
- Authenticity certificate signatures
- Unique asset ID (token)
- Metadata pointer (IPFS)

#### Technical Stack
- **Smart Contracts**: ERC-721/1155 on Avalanche C-Chain. Custom `ProvenanceRecord` contract.
- **Storage**: IPFS / Arweave for images + docs. AVAX for proof.
- **Frontend**: Next.js (React).
- **Backend**: Next.js API routes / Server Actions.
