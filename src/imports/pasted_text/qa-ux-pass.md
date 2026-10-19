Perform a SECOND comprehensive QA, UX/UI, responsive and navigation fix pass on the existing NB LAO project.

IMPORTANT:
Do NOT rebuild the project from scratch.
Do NOT redesign the entire website.
Do NOT replace the existing visual identity.
Do NOT remove working functionality.
Do NOT change working Checkout, Shipping, Payment, RFQ business flow, or other confirmed-working features unless a confirmed issue requires it.

The previous Master QA pass did NOT fully resolve several confirmed issues.

This pass must specifically address ALL confirmed issues below in ONE comprehensive implementation pass.

==================================================
1. PRODUCT IMAGES — CRITICAL
==================================================

The Product Listing still has broken/raw image URL behavior.

Current problem:
Some product cards display raw Unsplash/image URLs or fail to render the actual product image.

Fix the actual rendering logic.

Requirements:
- Product cards must render actual images, not raw URL text.
- Never display an image URL as visible product content.
- If an image fails to load, show a proper visual fallback.
- Preserve the existing product data structure where possible.
- Do not simply hide the image.
- Verify image rendering in Grid View and List View.
- Verify image rendering on Desktop, Tablet/iPad and Mobile.

Test at:
375px, 390px, 430px, 768px, 820px, 834px, 1024px, 1280px, 1440px.

==================================================
2. PRODUCT LISTING — MOBILE SPACE / OVERFLOW
==================================================

The Product Listing currently uses too much horizontal and vertical space on Mobile.

There are also problems where Grid View / List View controls and related information extend outside the Mobile viewport.

Fix the responsive layout.

Requirements:
- Keep Grid View and List View controls fully inside the viewport.
- Prevent horizontal page overflow.
- Compact the toolbar and controls on Mobile.
- Do not allow sort/filter/view controls to push beyond the screen.
- Product cards should use efficient mobile spacing.
- Avoid excessive padding, gaps and empty space.
- Preserve readable typography and touch-friendly controls.
- Do not make the interface so compact that usability is reduced.

Mobile priorities:
1. Product image
2. Brand
3. Product name
4. Short description
5. Price / stock
6. Add to Cart
7. Request Quote / secondary actions

Move lower-priority information into Product Detail where appropriate instead of creating excessively tall cards.

==================================================
3. PRODUCT DETAIL — SPECIFICATIONS / DOCUMENTS
==================================================

There is a confirmed responsive issue in Product Detail.

The Specifications section/table can become wider than the Mobile viewport.

The Documents / Technical Documents content can disappear from the visible layout or move outside the viewport because of horizontal overflow.

Fix this without removing the Documents functionality.

Requirements:
- Specifications must remain readable on Mobile.
- Documents / Technical Documents must remain visible and accessible.
- Documents must NOT disappear.
- Documents must NOT be pushed outside the viewport.
- Prevent the entire page from horizontal scrolling.
- If a table genuinely requires horizontal scrolling, contain the scroll INSIDE the table/container only.
- Do not allow the entire page to overflow horizontally.
- Preserve Overview, Specifications, Applications and Documents sections.
- Preserve document actions such as Preview / Download / Request where already implemented.

Verify on:
375px, 390px, 430px, 768px, 820px, 834px.

==================================================
4. MY ORDERS → ORDER DETAIL — CRITICAL
==================================================

There is still a confirmed navigation/data lookup bug.

Current behavior:
My Orders → View Details → Order Not Found

This happens for an Order that exists in the My Orders list.

Fix the valid Order navigation and lookup.

Requirements:
- Clicking View Details for an existing Order must open the correct Order Detail page.
- The Order ID/reference used by the list must match the Order Detail lookup.
- Preserve the existing Not Found state for genuinely invalid Order IDs.
- Do NOT remove the Not Found page.
- Do NOT hard-code one special button to bypass the problem.
- Fix the underlying route/state/mock-data lookup relationship.

Order Detail should contain the existing/intended information such as:
- Order number
- Order date
- Order status
- Payment status
- Order progress
- Products
- SKU
- Quantity
- Unit price
- Total
- Delivery information
- Payment information
- Subtotal
- Delivery/shipping
- VAT/tax where applicable
- Grand total
- Existing actions such as invoice/reorder/contact sales where implemented

Test:
My Orders → View Details → valid Order Detail

Also test:
invalid Order ID → Order Not Found

==================================================
5. MY QUOTATIONS → QUOTATION DETAIL — CRITICAL
==================================================

There is still a confirmed navigation/data lookup bug.

Current behavior:
My Quotations → View Quotation → Quotation Not Found

This happens for a Quotation that exists in the My Quotations list.

Fix the valid Quotation navigation and lookup.

Requirements:
- Clicking View Quotation for an existing quotation must open the correct Quotation Detail page.
- The quotation ID/reference used by the list must match the detail lookup.
- Preserve the existing Not Found state for genuinely invalid quotation IDs.
- Do NOT hard-code a single quotation.
- Fix the underlying route/state/mock-data lookup relationship.

Quotation Detail should preserve the existing/intended information:
- Quotation / RFQ reference
- Company
- Contact
- Products
- SKU
- Quantity
- Quoted price
- Status
- Valid until
- Terms
- Existing actions such as Accept Quote / Request Revision where implemented

Test:
My Quotations → View Quotation → valid Quotation Detail

Also test:
invalid quotation ID → Quotation Not Found

==================================================
6. MY ACCOUNT — NAVIGATION UX
==================================================

The current My Account navigation is too long and difficult to use.

Current structure is similar to:
Dashboard → My Orders → Quotations → Wishlist → My Profile → Change Password → Log Out

Do NOT simply keep presenting all options as a long horizontal navigation row.

Redesign ONLY the navigation structure for better usability while preserving all destinations and functionality.

Preferred behavior:
- Desktop: use a compact, structured Account sidebar/navigation area.
- Tablet: adapt the navigation so it does not consume excessive width.
- Mobile: use a compact Account navigation pattern such as a menu/select/drawer/stacked navigation that is easy to scan and does not create a long horizontal overflow.
- Clearly indicate the active section.
- Keep Log Out visually separated from normal navigation where appropriate.
- Do not remove any existing Account destinations.

Account destinations that must remain accessible:
- Dashboard
- My Orders
- My Quotations
- Wishlist
- My Profile
- Change Password
- Log Out

==================================================
7. MY ORDERS — MOBILE SPACE
==================================================

My Orders currently uses too much space on Mobile.

Optimize the mobile layout.

Requirements:
- Reduce excessive padding and empty space.
- Make each order card/list item compact but readable.
- Keep the most important information visible:
  Order Number
  Date
  Status
  Total
  View Details
- Keep touch targets usable.
- Avoid excessive vertical spacing.
- Do not remove important information.
- Do not change the underlying order functionality.

==================================================
8. MY QUOTATIONS — DESKTOP / TABLET / MOBILE SPACE
==================================================

The Quotations page currently uses too much space across:
- Desktop
- Tablet/iPad
- Mobile

Optimize the layout responsively.

Requirements:
- Reduce excessive whitespace.
- Make quotation cards/list/table more information-dense.
- Maintain clear hierarchy.
- Keep quotation reference, date/status, value/summary and actions visible.
- Make View Quotation easy to find.
- Make Accept Quote / Request Revision available where already implemented.
- Prevent unnecessary oversized cards.
- Ensure the layout adapts correctly to Desktop, iPad/Tablet and Mobile.
- Do not remove quotation functionality.

==================================================
9. WISHLIST — PRODUCT CARD SIZE
==================================================

Wishlist product cards are currently too large and waste screen space.

Optimize the Wishlist layout.

Requirements:
- Reduce unnecessary card height and width.
- Use a more compact product card.
- Preserve product image, name, price and important status information.
- Keep Add to Cart / Remove / View Product actions accessible where already implemented.
- Avoid excessive whitespace.
- Maintain consistent styling with Product Listing.
- Make the layout responsive across Desktop, Tablet/iPad and Mobile.

==================================================
10. CUSTOMER RESPONSIVE AUDIT
==================================================

Perform a complete responsive audit of the Customer-facing website after implementing the fixes.

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

Specifically check:
- Header
- Navigation
- Mobile menu
- Product Listing
- Search
- Filters
- Sort
- Grid/List controls
- Product cards
- Product Detail
- Specifications
- Documents
- Cart
- Checkout
- Order Confirmation
- My Account
- My Orders
- Order Detail
- My Quotations
- Quotation Detail
- Wishlist
- Profile
- Change Password
- Modals
- Footer

Primary rule:
No unintended horizontal page overflow.

==================================================
11. ADMIN — RESPONSIVE AUDIT IS REQUIRED
==================================================

IMPORTANT:
The Admin area must ALSO be included in this QA pass.

Do NOT redesign the Admin system from scratch.

Audit the existing Admin UI for responsive behavior, usability, spacing, overflow and navigation.

Test Admin at:

Desktop:
1440px
1280px
1024px

Tablet / iPad:
768px
820px
834px
1024px

Mobile:
375px
390px
430px

Audit existing Admin screens including, where present:
- Admin Login
- Dashboard
- Products
- Add Product
- Edit Product
- Product Detail
- Categories
- Brands
- Inventory
- Orders
- Order Detail
- Quotations
- Quotation Detail
- Customers
- Reviews
- Reports
- Staff
- Settings

Check:
- Sidebar behavior
- Mobile navigation
- Dashboard cards
- Tables
- Forms
- Search
- Filters
- Dropdowns
- Modals
- Pagination
- Action buttons
- Long text
- Long product names
- Long order numbers
- Long quotation references
- Table overflow
- Horizontal page overflow
- Vertical spacing
- Touch targets
- Readability

For wide Admin tables:
Do NOT force every column into a tiny Mobile screen.

If a table is genuinely too wide:
- contain horizontal scrolling inside the table container
- keep the page itself from horizontal overflow
- preserve important columns
- maintain usable row actions

Preserve the existing Admin information architecture and functionality.

==================================================
12. DO NOT BREAK WORKING FEATURES
==================================================

The following areas have previously been checked and should be preserved unless a real regression is discovered:

- Home content and structure
- Checkout
- Shipping / Delivery
- Payment
- RFQ flow
- Order Confirmation
- Existing visual identity
- Existing business-oriented B2B UX

Do not change these unnecessarily.

==================================================
13. VISUAL CONSISTENCY
==================================================

Preserve the existing NB LAO visual identity.

Continue using the existing:
- Navy
- Blue
- Gold
- White / light surfaces
- Typography
- Buttons
- Cards
- Borders
- Existing visual language

Do not introduce an unrelated design system.

The goal is:
MORE COMPACT + MORE USABLE + MORE RESPONSIVE

NOT:
A completely different design.

==================================================
14. REGRESSION TEST — REQUIRED
==================================================

After implementation, perform a full regression pass.

Test these customer flows:

FLOW A:
Home
→ Products
→ Product Detail
→ Add to Cart
→ Cart
→ Checkout
→ Order Confirmation

FLOW B:
Product Detail
→ Request Quote
→ Company Information
→ Project Requirements
→ Review
→ Submit RFQ
→ My Quotations
→ View Quotation
→ Quotation Detail

FLOW C:
Login
→ Dashboard
→ My Orders
→ View Details
→ Order Detail

FLOW D:
Dashboard
→ Wishlist
→ Profile
→ Change Password
→ Log Out

Also verify:
- valid Order → Order Detail
- invalid Order → Order Not Found
- valid Quotation → Quotation Detail
- invalid Quotation → Quotation Not Found

Then verify Admin navigation and responsive behavior.

==================================================
15. FINAL IMPLEMENTATION RULE
==================================================

Do not stop after fixing only one or two issues.

Complete ALL confirmed issues listed in this specification in one comprehensive pass.

Before finishing:
1. Audit
2. Implement fixes
3. Check responsive layouts
4. Check navigation/data lookup
5. Check horizontal overflow
6. Check visual consistency
7. Perform regression flows
8. Confirm that previously working functionality remains intact

At the end, provide a concise implementation summary containing:
- Issues fixed
- Responsive areas checked
- Customer flows tested
- Admin areas checked
- Any issue that could NOT be verified or fixed
- Any remaining limitation

Do not claim something was tested if it was not actually tested.