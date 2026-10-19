NB LAO — MASTER UX/UI AUDIT + RESPONSIVE FIX + CONSISTENCY PASS

IMPORTANT:
This is a comprehensive QA, UX/UI refinement and responsive-fix pass for the EXISTING NB LAO project.

DO NOT create a new project.
DO NOT rebuild the website from scratch.
DO NOT replace the current design system.
DO NOT replace the existing NB LAO visual identity.
DO NOT remove working features.
DO NOT change business logic unnecessarily.
DO NOT change backend/API/database logic unless absolutely required to fix an existing UI state or broken prototype flow.
DO NOT replace existing working screens with generic templates.

The current project is already substantially built.

Your responsibility is to AUDIT THE ENTIRE EXISTING WEBSITE and fix confirmed UX/UI, responsive, layout, visual consistency, interaction-state and prototype-flow problems in ONE comprehensive pass.

==================================================
01 — CORE OBJECTIVE
==================================================

Audit and refine the entire NB LAO website from:

HOME
→ PRODUCT CATEGORIES
→ PRODUCT LISTING
→ SEARCH
→ FILTERS
→ PRODUCT DETAIL
→ CART
→ CHECKOUT
→ ORDER CONFIRMATION
→ CUSTOMER ACCOUNT
→ DASHBOARD
→ MY ORDERS
→ ORDER DETAIL
→ QUOTATIONS
→ QUOTATION DETAIL
→ WISHLIST
→ PROFILE
→ CHANGE PASSWORD
→ LOGIN
→ REGISTER
→ FORGOT PASSWORD
→ CORPORATE PAGES
→ INDUSTRIES
→ SERVICES
→ ABOUT
→ CONTACT
→ BRANDS
→ FOOTER

Also audit:
- Desktop
- Tablet
- Mobile
- Navigation
- Header
- Footer
- Modals
- Drawers
- Forms
- Buttons
- Empty states
- Error states
- Success states
- Loading states
- Responsive behavior
- Prototype navigation
- Visual consistency

The goal is to make the entire website feel like ONE professional NB LAO industrial B2B e-commerce platform.

==================================================
02 — EXISTING DESIGN MUST BE PRESERVED
==================================================

Preserve the existing NB LAO design language.

Brand personality:
- Premium
- Corporate
- Industrial
- Engineering
- Modern
- Clean
- Trustworthy
- Professional

Color system:

Navy:
#082E61

Primary Blue:
#0099FF

Secondary Blue:
#007ACC

Gold:
#D4AF37

Deep Gold:
#B8941E

Page Background:
#F5F7FA

White:
#FFFFFF

Secondary Text:
#52677D

Border:
#D9E2EC

Do not introduce random new colors.

Avoid:
- excessive blue backgrounds
- excessive gradients
- excessive shadows
- excessive rounded cards
- generic SaaS UI
- generic consumer shopping UI
- oversized empty spaces
- unnecessary decorative elements

Maintain the existing NB LAO industrial/corporate appearance.

==================================================
03 — FIRST: AUDIT BEFORE MODIFYING
==================================================

Before changing anything:

Review the existing implementation and identify:

KEEP
- already correct screens
- already correct layouts
- already correct functionality

IMPROVE
- visually inconsistent areas
- spacing problems
- typography problems
- responsive problems

FIX
- broken layouts
- broken navigation
- broken states
- broken image rendering
- incorrect mobile layouts
- incorrect prototype links

DO NOT MODIFY
- working functionality
- correct desktop layouts
- correct checkout behavior
- correct payment behavior
- correct shipping/delivery behavior
- correct business logic

Do not create fake problems.

Only make changes where an actual issue exists or where a clear responsive/UX improvement is necessary.

==================================================
04 — GLOBAL HEADER / NAVIGATION
==================================================

Audit header across desktop, tablet and mobile.

Desktop:
- preserve existing top information bar
- preserve NB LAO logo
- preserve main navigation
- preserve search
- account
- cart
- Request a Quote CTA

Mobile:
- preserve compact header
- logo must remain readable
- account icon
- cart icon
- hamburger menu
- navigation drawer

Verify:
- no overlap
- no clipping
- no horizontal overflow
- correct touch targets
- correct active states
- correct navigation behavior

Do not redesign the header unnecessarily.

==================================================
05 — HOME PAGE
==================================================

Audit the Home Page from top to bottom.

Sections include:
- Hero
- Product Range / Categories
- Featured Products
- Industries We Serve
- Brand Partners
- About NB LAO
- CTA / Request Quote
- Footer

Preserve the existing visual direction.

Improve only:
- spacing
- typography
- responsive sizing
- image rendering
- button alignment
- section hierarchy
- mobile scrolling behavior
- tablet layout
- inconsistent spacing

Mobile Home must be comfortable to scroll.

Hero:
- text must remain readable
- CTA buttons must remain accessible
- statistics must not overflow
- background image must render correctly
- no text clipping

==================================================
06 — PRODUCT CATEGORY
==================================================

Audit category sections and category pages.

Check:
- category cards
- images
- SKU count
- category descriptions
- arrows
- spacing
- mobile stacking
- tablet grid

Make sure cards remain readable at:
375px
390px
430px
768px
1024px
1280px+
1440px

==================================================
07 — PRODUCT LISTING
==================================================

Audit:
- All Products
- Category listing
- Search Results
- Filter
- Sort
- Grid/List switch
- Product cards

IMPORTANT:
There are currently mobile/product-listing screenshots where product images appear as raw Unsplash URL text instead of actual images.

FIX THIS.

Product images must render as actual images.

Never display raw image URLs as visible product content.

Check:
- image source
- image loading
- object-fit
- aspect ratio
- fallback image
- broken image state

Product cards must preserve:
- brand
- product name
- SKU
- specification summary
- price
- stock status
- Add to Cart
- RFQ
- Wishlist
- Compare / Details where already supported

Do not remove existing functionality.

==================================================
08 — PRODUCT FILTER MOBILE
==================================================

Mobile filters should remain compact and usable.

Preferred pattern:

[ Filters ]   [ Sort ]

When Filters is opened:
- use a mobile drawer/panel
- preserve existing filter logic
- Category
- Subcategory
- Brand
- Stock
- Price Range

Do not invent unsupported filters.

Filter panel must:
- fit mobile screen
- scroll internally when necessary
- have clear close action
- have Clear All Filters
- not create horizontal overflow

After applying filters:
- show active filter chips
- allow removing individual filters
- preserve results

==================================================
09 — PRODUCT DETAIL
==================================================

Audit Product Detail carefully.

Check:
- breadcrumb
- product image
- thumbnails
- brand
- certification badges
- product name
- model
- SKU
- description
- price
- stock
- quantity
- Add to Cart
- Request Quote
- Wishlist
- Contact Sales
- benefits
- tabs

Tabs:
- Overview
- Specifications
- Applications
- Technical Documents / existing supported tab

Check mobile layout carefully.

Product information must not become unnecessarily tall.

Controls must remain accessible.

Technical specifications must remain readable on mobile.

==================================================
10 — CART
==================================================

IMPORTANT:
This is one of the confirmed areas requiring improvement.

Desktop Cart:
DO NOT unnecessarily redesign it.

Mobile Cart:
FIX the excessive vertical height of each product card.

CURRENT PROBLEM:
Product
↓
Quantity
↓
Price
↓
Another Price
↓
Delete

creates excessive vertical spacing.

REQUIRED:
1 product = 1 compact card.

Recommended mobile structure:

[IMAGE] Product Name
        Brand / SKU
        Price

        Qty [-] [1] [+]     Delete

Use compact spacing.

Requirements:
- show price only once
- compact quantity stepper
- compact remove/delete action
- product image on left
- product information on right
- no excessive vertical gaps
- no unnecessary duplicate information
- no cramped controls
- touch-friendly controls

Target:
375px
390px
430px

The Order Summary should appear significantly earlier after compacting product cards.

Order Summary:
- Subtotal
- Shipping / Delivery
- Tax if applicable
- Total
- Proceed to Checkout

Do not change cart business logic.

==================================================
11 — CHECKOUT
==================================================

The existing Checkout has already been visually reviewed.

Do NOT redesign it unnecessarily.

Preserve:
- Shipping / Delivery
- Payment
- Order information
- existing desktop layout
- existing mobile layout

Only fix if the audit finds:
- actual overflow
- broken alignment
- clipped content
- broken controls
- incorrect responsive behavior

Do not introduce new checkout logic.

==================================================
12 — ORDER CONFIRMATION
==================================================

Audit the successful order confirmation page.

Preserve:
- success indicator
- Thank You message
- Order Number
- Customer
- Company
- Payment
- View My Orders
- Continue Shopping

Check:
- mobile spacing
- button stacking
- readability
- alignment
- responsive layout

==================================================
13 — CUSTOMER DASHBOARD
==================================================

Audit:
- Account header
- Sidebar
- Dashboard statistics
- Recent Orders
- Quick actions

Check mobile behavior carefully.

Desktop sidebar may remain.

On mobile:
- avoid oversized sidebar
- use appropriate responsive navigation
- prevent excessive vertical spacing
- maintain active state

Statistics should remain readable and compact.

==================================================
14 — MY ORDERS
==================================================

Audit order list.

Check:
- order number
- date
- items
- total
- status
- order preview
- View Details

Responsive behavior:
Desktop:
table/list style is acceptable.

Mobile:
convert into compact readable order cards/list rows where necessary.

Do not create horizontal scrolling unless absolutely necessary.

==================================================
15 — ORDER DETAIL
==================================================

IMPORTANT:

The current prototype has shown an "Order Not Found" state when attempting to open a known example order.

Audit this carefully.

If the problem is caused by a mismatch between:
- displayed order ID
- route parameter
- mock data
- lookup logic
- state
- navigation

FIX THE PROTOTYPE FLOW.

The known order displayed in My Orders should open its corresponding Order Detail screen.

Do not simply remove the "Not Found" state.

The Not Found state must remain available for genuinely invalid order IDs.

Required states:
1. Valid Order → Order Detail
2. Invalid Order → Order Not Found

==================================================
16 — QUOTATIONS
==================================================

Audit:
- My Quotations
- quotation list
- quotation status
- quotation total
- View Quotation
- Accept Quote
- Request Revision

Keep the existing B2B RFQ/quotation workflow.

==================================================
17 — QUOTATION DETAIL
==================================================

IMPORTANT:

The current prototype has shown:

"Quotation Not Found"

when opening a quotation that is visibly present in My Quotations.

Audit:
- quotation ID
- route
- mock data
- lookup
- navigation
- state

If it is a prototype data/route mismatch, fix it.

Valid quotation:
→ Quotation Detail

Invalid quotation:
→ Quotation Not Found

Do not remove the error state.

==================================================
18 — WISHLIST
==================================================

Audit:
- product cards
- images
- price
- Add to Cart
- Remove
- mobile layout
- desktop layout

Keep the current functionality.

Make mobile cards compact and consistent with Product Listing.

==================================================
19 — MY PROFILE
==================================================

Audit:
- profile information
- first name
- last name
- email
- phone
- company
- Save Changes

Check:
- form spacing
- mobile stacking
- input width
- button placement
- validation states

==================================================
20 — CHANGE PASSWORD
==================================================

Audit:
- Current Password
- New Password
- Confirm New Password
- Update Password

Add/retain appropriate UI states:
- validation
- mismatch
- success
- error

Do not change authentication architecture.

==================================================
21 — SIGN OUT MODAL
==================================================

Preserve the existing confirmation modal.

Check:
- mobile width
- buttons
- close action
- Cancel
- Sign Out

No overflow.

==================================================
22 — LOGIN / REGISTER / FORGOT PASSWORD
==================================================

Audit authentication screens.

Check:
- desktop
- mobile
- input sizing
- password visibility
- remember me
- forgot password
- validation
- error states
- success states
- navigation back to website

Preserve the existing visual identity.

==================================================
23 — CORPORATE PAGES
==================================================

Audit:
- About
- Industries
- Services
- Contact
- Brands
- Projects
- News if already present

Keep the same NB LAO design system.

Do not turn these into generic content pages.

==================================================
24 — FOOTER
==================================================

Audit footer across desktop and mobile.

Check:
- company information
- address
- phone
- email
- products
- company links
- quick access
- RFQ CTA
- copyright
- privacy
- terms

Mobile footer should stack logically.

Avoid excessive empty vertical spacing.

Ensure all links fit within viewport width.

==================================================
25 — RESPONSIVE SYSTEM
==================================================

Perform a complete responsive audit.

Required widths:

Mobile:
375px
390px
430px

Tablet:
768px
1024px

Desktop:
1280px
1440px

At every breakpoint verify:

- no horizontal overflow
- no clipped text
- no overlapping elements
- no broken grids
- no broken images
- no excessively tall cards
- no excessive whitespace
- buttons remain accessible
- forms remain usable
- navigation remains usable
- footer remains readable

IMPORTANT:
Do not solve mobile problems by simply shrinking desktop layouts.

Use appropriate responsive layout behavior.

==================================================
26 — IMAGES
==================================================

Audit ALL product and content images.

Problems to check:
- broken images
- raw URL text
- wrong aspect ratio
- stretched images
- cropped important content
- missing fallback
- inconsistent object-fit

All product images must render as actual images.

Never expose raw image URLs in the UI.

==================================================
27 — TYPOGRAPHY
==================================================

Maintain the existing NB LAO typography system.

Check:
- heading hierarchy
- body text
- metadata
- labels
- buttons
- tables
- mobile text size
- line height

Avoid:
- oversized headings
- tiny unreadable mobile text
- excessive letter spacing
- inconsistent font sizes

==================================================
28 — SPACING
==================================================

Perform a spacing consistency audit.

Fix:
- excessive vertical gaps
- inconsistent card padding
- inconsistent section spacing
- buttons with inconsistent height
- inconsistent form spacing

Use a consistent spacing system.

Do not randomly change spacing everywhere.

==================================================
29 — UI STATES
==================================================

Verify that existing components support appropriate:

Loading
Empty
No Results
Error
Success
Validation
Disabled
Hover
Active
Focus

Do not remove existing states.

Do not create fake business behavior.

==================================================
30 — PROTOTYPE NAVIGATION
==================================================

Audit every important CTA and link.

Examples:

Home
→ Products

Products
→ Product Detail

Product Detail
→ Add to Cart
→ Request Quote
→ Wishlist

Cart
→ Checkout

Checkout
→ Order Confirmation

Order Confirmation
→ My Orders

My Orders
→ Valid Order Detail

Quotations
→ Valid Quotation Detail

Wishlist
→ Product / Add to Cart

Account
→ Dashboard / Orders / Quotations / Wishlist / Profile

Invalid IDs
→ Not Found states

Do not remove Not Found states.
Fix valid navigation instead.

==================================================
31 — ACCESSIBILITY / USABILITY
==================================================

Check:
- button touch targets
- form labels
- focus states
- readable contrast
- keyboard usability where applicable
- icon buttons with accessible labels
- image alt text
- logical interaction hierarchy

Do not sacrifice usability for visual effects.

==================================================
32 — B2B INDUSTRIAL UX
==================================================

The website is an INDUSTRIAL B2B E-COMMERCE PLATFORM.

Prioritize:
- Product specifications
- SKU
- Brand
- Stock
- Technical documents
- Request Quote
- Contact Sales
- Applications
- Technical specifications
- Order status
- Quotations

Do not make it feel like a fashion or consumer shopping website.

==================================================
33 — DO NOT CHANGE THESE WITHOUT A REAL ISSUE
==================================================

Do NOT unnecessarily change:

- Existing Home visual identity
- Existing desktop Product Listing
- Existing desktop Product Detail
- Existing Checkout
- Shipping / Delivery
- Payment
- Existing business logic
- Existing product data
- Existing category data
- Existing quotation data
- Existing order data
- Existing authentication behavior

Preserve anything that is already correct.

==================================================
34 — FINAL REGRESSION CHECK
==================================================

After implementing all fixes, perform a final pass across:

HOME
PRODUCT CATEGORIES
PRODUCT LISTING
SEARCH
FILTERS
PRODUCT DETAIL
CART
CHECKOUT
ORDER CONFIRMATION
ACCOUNT DASHBOARD
MY ORDERS
ORDER DETAIL
QUOTATIONS
QUOTATION DETAIL
WISHLIST
PROFILE
CHANGE PASSWORD
LOGIN
REGISTER
FORGOT PASSWORD
CORPORATE PAGES
FOOTER

Test responsive behavior at:

375px
390px
430px
768px
1024px
1280px
1440px

Verify:

- no horizontal overflow
- no broken images
- no raw image URLs
- no broken navigation
- no unnecessary Not Found states
- valid Order opens Order Detail
- valid Quotation opens Quotation Detail
- invalid Order still shows Not Found
- invalid Quotation still shows Not Found
- mobile Cart is compact
- Order Summary appears earlier
- Checkout remains intact
- desktop layout remains intact
- mobile navigation works
- buttons remain usable
- forms remain usable

==================================================
35 — IMPORTANT IMPLEMENTATION RULE
==================================================

Do not make dozens of unrelated visual changes.

Prioritize confirmed problems first.

For each area:

AUDIT
→ IDENTIFY
→ FIX
→ VERIFY

Do not "improve" something simply because you personally prefer another design.

The objective is:

A COMPLETE, CONSISTENT, PROFESSIONAL NB LAO INDUSTRIAL B2B E-COMMERCE EXPERIENCE.

The final result should feel like one coherent production-ready product, not a collection of independently generated pages.

IMPORTANT:
Preserve working functionality.
Preserve working screens.
Preserve the current NB LAO visual identity.
Fix confirmed issues comprehensively in this single pass.