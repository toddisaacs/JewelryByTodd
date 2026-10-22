# Jewelry Setting Catalog – Project Instructions

## Purpose
Build a clean, shareable web catalog of handmade jewelry settings (primarily rings) that the user's wife can reference during Whatnot stone sales. Buyers see style options, metal choices, add-ons, and prices for made-to-order settings. No inventory risk.

## Approach
- **Piece-based**: One specific, repeatable style at a time (not fully modular open custom). Start with a single example item to lock the template, then expand.
- **AI-editable**: Prefer plain HTML/CSS (or markdown that generates static HTML) so future changes can be made by pasting files back to an AI and requesting updates.
- **Hosting target**: GitHub Pages (free, version-controlled, simple).
- **Photos**: Use placeholders initially. User will supply real GH5 photos later (main view + detail crops of skirts, shoulders, finishes).

## Required content per item
For every style/item include:

1. **Name / Style title**
2. **Description**
   - Full details the user provides
   - Approximate finished weight in grams
   - Stone size / shape limits and any exceptions (e.g., “best for 8–12 mm round/oval cabs; square stones may need adjustment”)
   - Any other caveats
3. **Photos**
   - Main view(s)
   - Close-ups of distinctive details (skirt, shoulders, finish examples)
4. **Options**
   - Metal: Sterling silver / Gold (note karat or price delta if different)
   - Ring-specific options (example for traditional bezel):
     - Bezel skirt (none / braid-rope / square-twist / etc.)
     - Finish (high polish / antique / satin-scuff)
     - Rhodium plate (available only if finish is not antique)
   - Finger size (required field / note)
   - Any other relevant options
5. **Pricing**
   - Base price (usually silver)
   - Clear add-on prices for each option
   - Example total if useful
6. **Lead time / notes**
   - Made to order once stone is chosen
   - Current lead time
   - Any beta-pricing or pipeline notes if relevant

## Layout goals
- Not dense. Generous whitespace.
- One style clearly separated (card, section, or page).
- Photos prominent and well-sized.
- Options and prices easy to scan (lists or simple table).
- Mobile-friendly.
- Short intro at top: made-to-order, prices for setting only, link/context for Whatnot use.

## Workflow
1. Create the overall page structure and one complete example item.
2. Review and refine the template.
3. Add additional styles one by one using the same pattern.
4. Keep all source files simple so they remain easy for AI to edit later.

## Constraints
- No e-commerce checkout or inventory tracking.
- Focus on clarity and setting expectations.
- Preserve user’s exact pricing and exception language once provided.
- Prefer semantic, maintainable HTML/CSS over complex frameworks unless requested.

## Starting point
Begin with a single example item (user will specify which style or provide details). Use realistic placeholders only where the user has not yet supplied data. Flag anything that needs real photos or confirmed prices.
