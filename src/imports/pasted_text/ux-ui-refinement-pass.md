Perform a focused UX/UI refinement pass on the existing NB LAO project based on the confirmed issues below.

Do NOT rebuild the project.
Do NOT redesign the entire website.
Do NOT change the NB LAO visual identity.
Do NOT modify working Checkout, RFQ, Order Confirmation, or other confirmed-working business flows.

This pass is specifically about:
1. Mobile information hierarchy
2. Mobile space efficiency
3. Responsive layout quality
4. Product content visibility
5. Reducing excessive whitespace and unnecessary scrolling

IMPORTANT:
Do not solve overflow problems simply by hiding content with overflow-x:hidden.
Fix the actual layout structure and content hierarchy.

==================================================
1. PRODUCTS — MOBILE LIST VIEW
==================================================

The current Mobile List View still overflows horizontally and the product information hierarchy is poorly organized.

Create a dedicated responsive Mobile List View layout instead of squeezing the desktop layout into Mobile.

Requirements:
- No horizontal page overflow.
- Everything must remain inside the viewport at 375px, 390px and 430px.
- Product image must have a controlled fixed/responsive width.
- Text content must use min-width: 0 and appropriate truncation/wrapping.
- Long product names must wrap or line-clamp instead of pushing the layout wider.
- Buttons must remain inside the card.
- Do not allow price, stock, actions or product text to extend outside the card.

Mobile List View information hierarchy:

Priority 1:
- Product image
- Brand
- Product name

Priority 2:
- SKU
- Short description
- Price
- Stock status

Priority 3:
- Add to Cart
- Request Quote

Secondary actions such as Compare should not consume primary space on Mobile.

Use a clean compact structure similar to:

[IMAGE]  BRAND
         PRODUCT NAME
         SKU
         SHORT DESCRIPTION
         PRICE · STOCK
         [ADD TO CART] [RFQ]

Do not simply shrink every existing element.
Reorganize the Mobile List View specifically for Mobile usability.

==================================================
2. PRODUCTS — MOBILE GRID VIEW
==================================================

The current Mobile Grid View is too compact in the wrong areas and does not show enough essential product information.

The goal is NOT simply to make the cards smaller.

Ensure the following essential information is visible:

Priority 1:
- Product image
- Brand
- Product name

Priority 2:
- Short description or key product identifier
- Price
- Stock status

Priority 3:
- Add to Cart
- Request Quote

Do not allow secondary actions to take space away from essential product information.

Keep the card compact, but readable.

Avoid:
- Excessive whitespace
- Oversized image area
- Tiny unreadable text
- Hidden product name
- Hidden price
- Hidden stock status
- Overloaded action areas

Verify at:
375px
390px
430px

==================================================
3. PRODUCT DETAIL — MOBILE PRODUCT IMAGE
==================================================

The Product Detail product image is currently too large and consumes excessive vertical space.

Reduce the image area on Mobile while keeping the product visually prominent.

Requirements:
- Product image must remain high quality.
- Do not stretch or distort the image.
- Reduce excessive empty image container height.
- Keep the image centered.
- Make the image area responsive.
- Ensure product name, SKU, price, stock and purchase/RFQ actions appear earlier in the viewport.

The goal is:
Product image = prominent but efficient.

Do not allow the image gallery to dominate the entire Mobile viewport.

Verify at:
375px
390px
430px

==================================================
4. HOME PAGE — PRODUCT SECTIONS
==================================================

The Home Page currently uses excessive vertical space, especially in product-related sections such as Featured Products.

Review the Home Page specifically for Mobile space efficiency.

Audit:
- Browse by Category
- Featured Products
- Industries
- Brand Partners
- About NB LAO
- CTA
- Footer

For product sections:
- Reduce unnecessary card height.
- Reduce excessive image container height.
- Reduce excessive vertical gaps.
- Keep product name, price and important product information visible.
- Avoid oversized cards that require excessive scrolling.

Do NOT remove important content.

Do NOT redesign the Home Page.

The goal is to make the existing Home Page more compact, polished and information-efficient while preserving its current visual identity.

==================================================
5. HOME PAGE — SECTION SPACING
==================================================

Review excessive vertical spacing between sections.

Reduce unnecessary:
- padding-top
- padding-bottom
- large empty gaps
- oversized headings
- oversized section containers

Maintain visual breathing room and hierarchy.

Do not make sections visually cramped.

Use responsive spacing:
- Mobile: compact
- Tablet: moderate
- Desktop: comfortable

==================================================
6. FOOTER — SPACE OPTIMIZATION
==================================================

The Footer currently consumes too much vertical space, especially on Mobile.

Optimize the existing Footer without removing important information.

Requirements:
- Reduce excessive padding.
- Reduce unnecessary gaps between footer groups.
- Keep company information readable.
- Keep navigation links accessible.
- Keep contact information.
- Keep social links where already implemented.
- Keep copyright/footer bottom area.

Avoid excessively tall stacked sections.

The Footer should feel compact and professional.

Verify:
375px
390px
430px
768px
1024px
1280px
1440px

==================================================
7. GLOBAL RESPONSIVE SPACE AUDIT
==================================================

After making the changes above, perform a responsive space-efficiency audit.

Check for:
- Horizontal overflow
- Excessive vertical whitespace
- Oversized cards
- Oversized image containers
- Excessive section padding
- Buttons extending outside containers
- Long text expanding layouts
- Content disappearing because of overflow rules
- Poor information hierarchy

Test:
375px
390px
430px
768px
820px
834px
1024px
1280px
1440px

IMPORTANT:
Do not use overflow:hidden as a substitute for fixing layout problems.

==================================================
8. PRESERVE WORKING AREAS
==================================================

Do NOT unnecessarily modify:
- Checkout
- Shipping / Delivery
- Payment
- RFQ flow
- Order Confirmation
- Order Detail navigation
- Quotation Detail navigation
- Admin functionality
- Existing visual identity

Only modify these areas if a real responsive regression is discovered.

==================================================
9. QUALITY STANDARD
==================================================

The final result should feel:

- More compact
- More organized
- Easier to scan
- More product-focused
- Less wasteful with screen space
- Fully responsive
- Professional B2B industrial e-commerce UX

Do not simply make everything smaller.

Use proper information hierarchy and responsive layout structures.

After implementation, verify the affected pages and report:
- What was changed
- Which responsive sizes were checked
- Any remaining issue that could not be verified

Do not claim something was tested if it was not actually tested.