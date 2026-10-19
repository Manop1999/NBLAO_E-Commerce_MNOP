NB LAO — PHASE 02
CRITICAL FOUNDATION + LARGE UX/UI IMPROVEMENT BATCH

CONTINUE FROM THE CURRENT NOP PROJECT.

IMPORTANT:
This is an existing NB LAO project.
DO NOT restart the project.
DO NOT rebuild the project from scratch.
DO NOT replace the existing visual identity.
DO NOT create a generic e-commerce template.

The current NOP project is the baseline.

The previous Phase 01 audit identified many issues across authentication, RFQ, cart persistence, customer account, product discovery, B2B functionality, admin operations, responsive behavior, and shared UI components.

Your task is to implement a LARGE, CAREFULLY CONTROLLED improvement batch.

==================================================
GLOBAL RULES
==================================================

1. PRESERVE the current NB LAO visual identity.

2. PRESERVE the existing:
- Header
- Footer
- Homepage visual direction
- Product card visual language
- Product detail visual language
- Cart visual language
- Checkout visual language
- RFQ visual language
- Customer account visual language
- Admin visual language

3. Do not redesign existing screens from scratch.

4. Do not remove working functionality.

5. Do not replace working product/cart/checkout/RFQ logic unnecessarily.

6. Reuse existing components and data structures wherever possible.

7. Prefer small reusable components over duplicated JSX.

8. Do not invent fake products, brands, certifications, customer records, orders, or business claims.

9. Do not invent unsupported business rules.

10. Do not introduce external backend services.

11. Do not pretend that client-side authentication is production-grade security.

12. If the current project is frontend/prototype-only, implement authentication/session behavior as a prototype boundary using the existing architecture, clearly structured so a real backend/API can replace it later.

13. Preserve Lao/English readiness.

14. Keep the existing NB LAO color hierarchy.

15. Do not increase the amount of blue unnecessarily.

16. Do not introduce excessive gradients.

17. Do not turn every section into a card.

18. Maintain:
- premium
- corporate
- industrial
- engineering
- modern
- clean
- trustworthy

19. Do not change the current brand colors unless required for consistency.

20. After every major implementation group, internally verify that existing routes and interactions still work.

==================================================
CURRENT BRAND TOKENS
==================================================

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

Background:
#F5F7FA

White:
#FFFFFF

Secondary Text:
#52677D

Border:
#D9E2EC

Visual balance:
60–70% light surfaces
15–20% blue
10–15% navy
3–5% gold

==================================================
PHASE 02 OBJECTIVE
==================================================

Improve the existing platform substantially in one controlled batch.

Prioritize:

P0 Critical
then
P1 High
then
safe P2 improvements.

Do NOT spend time polishing tiny P3 issues until the critical functionality is stable.

==================================================
PART 1 — AUTHENTICATION FOUNDATION
==================================================

Create the missing customer authentication screens:

/login
/register
/forgot-password

Create a clean authentication flow:

Guest
→ Login
→ Customer Account

Register:
- First Name
- Last Name
- Email
- Phone
- Company
- Password
- Confirm Password

Login:
- Email
- Password
- Remember me
- Forgot password
- Login
- Create account

Forgot password:
- Email
- Submit
- Success state

Add clear validation states.

Add password visibility toggle.

Add loading state.

Add error state.

Add success state.

IMPORTANT:
If no real backend authentication exists, implement this as a structured frontend prototype authentication layer only.

Do NOT claim that client-side auth is secure.

Create a clean abstraction so a real API can replace it later.

Protect:
- /account
- /admin

Unauthenticated users should be redirected to the appropriate login screen.

==================================================
PART 2 — LOGOUT
==================================================

Implement customer logout.

Implement admin logout.

Logout must:
- clear session state
- clear authentication state
- redirect appropriately
- prevent access to protected pages

Do not clear shopping cart unless the existing business logic explicitly requires it.

==================================================
PART 3 — 404 PAGE
==================================================

Create a branded 404 page.

Route:
*

Design:
- NB LAO branding
- clear "Page Not Found"
- short explanation
- Back to Home
- Browse Products

Maintain the existing design system.

==================================================
PART 4 — CART / WISHLIST / RFQ PERSISTENCE
==================================================

Persist these states across page refresh:

- cart
- wishlist
- rfqItems
- compare

Use localStorage or the project's existing persistence mechanism.

Requirements:

Add item
→ refresh
→ item remains.

Remove item
→ refresh
→ removed item remains removed.

Update quantity
→ refresh
→ quantity remains.

Do not create duplicate items incorrectly.

Do not corrupt existing cart state.

Handle invalid/stale stored data safely.

==================================================
PART 5 — RFQ CRITICAL FIX
==================================================

Fix the existing RFQ "Add Product" dropdown.

Current behavior:
Product can be selected but clicking Add does not correctly update RFQ state.

Implement:

Select Product
→ Add
→ Product appears in RFQ

Support:
- quantity increment
- quantity decrement
- remove
- multiple products
- duplicate prevention or quantity merging where appropriate

The existing product data must remain the source.

Do not invent products.

==================================================
PART 6 — CART → RFQ
==================================================

Fix "Convert to RFQ".

Expected behavior:

Cart
→ Convert to RFQ
→ RFQ page

All cart products should be transferred correctly.

Preserve:
- product
- SKU
- quantity

Display success feedback.

Prevent duplicate RFQ entries.

==================================================
PART 7 — TOAST / NOTIFICATION SYSTEM
==================================================

Create a reusable global Toast component.

Support:
- success
- error
- warning
- info

Use it for:

Add to cart
Remove from cart
Wishlist
Compare
Convert to RFQ
RFQ product added
Profile saved
Password changed
Quote accepted
Form submitted
Errors

Keep notifications subtle and professional.

Do not overuse animations.

==================================================
PART 8 — MODAL / DIALOG SYSTEM
==================================================

Create a reusable Modal/Dialog component.

Support:
- close button
- ESC
- backdrop click where appropriate
- confirm/cancel
- responsive mobile behavior

Use it for:

Document request
Delete confirmation
Logout confirmation where appropriate
Quote acceptance confirmation
Important warnings

==================================================
PART 9 — PRODUCT DOCUMENT REQUEST
==================================================

Product Detail → Documents tab

The existing "Request" buttons must become functional.

Create a document request modal.

Fields:
- Name
- Email
- Company
- Phone
- Document requested
- Purpose/message

Submit:
→ loading
→ success
→ toast/confirmation

Do not invent actual downloadable documents if they do not exist.

If a real document URL does not exist, keep it as a request workflow rather than a fake download.

==================================================
PART 10 — PRODUCT COMPARE
==================================================

The current store already contains compare state.

Expose it in the UI.

Add:
- Add to Compare
- Remove from Compare
- Compare count
- Compare feedback

Create:

/compare

Maximum:
4 products.

Comparison should focus on technical information.

Display:
- Brand
- Model
- SKU
- Price
- Price unit
- Category
- Subcategory
- Key specifications
- Applications
- Certifications
- Stock
- Lead time where available

Responsive behavior:
Desktop:
side-by-side comparison table.

Mobile:
horizontal scroll with sticky product identity where practical.

Empty state:
"No products selected for comparison."

==================================================
PART 11 — PRODUCT DISCOVERY
==================================================

Improve Products page filters.

Existing filters must remain functional.

Add:

Subcategory filter.

Application / Industry filter.

Do not invent application values.

Use existing product data where available.

Example conceptual structure:

Category
→ Subcategory
→ Brand
→ Application
→ Stock
→ Price

Add active filter chips.

Add:
Clear all filters.

Ensure filtering works together.

Example:

Category + Brand + Subcategory + Application

must produce the correct combined result.

==================================================
PART 12 — PRODUCT SEARCH
==================================================

Improve search.

Support existing:
- product name
- category
- brand

Where data exists, also support:
- SKU
- model
- subcategory
- specification text

Do not create fake search data.

Improve zero-results state.

Display:
- No products found
- Clear filters
- Browse all products
- Related suggestions when actual data allows it

Do not create a separate search route unless it fits the existing routing architecture cleanly.

==================================================
PART 13 — PAGINATION
==================================================

Create a reusable Pagination component.

Use it for Products.

Structure it so it can later be reused by Admin tables.

Support:
- current page
- next
- previous
- page numbers
- items per page where appropriate

Do not break existing filtering and sorting.

==================================================
PART 14 — PRODUCT B2B INFORMATION
==================================================

Improve Product Detail to support B2B procurement.

Where existing data is available, display:

SKU
Model
Brand
Category
Subcategory
Price
Price Unit
MOQ
Stock
Lead Time
Applications
Specifications
Certifications
Documents
Related Products
Accessories

IMPORTANT:
Do not invent values.

If the data field does not exist yet, create the UI/data structure so it can be populated later.

Use safe empty states such as:
"Contact Sales for availability"

rather than fake values.

==================================================
PART 15 — PRICE UNIT
==================================================

Introduce a structured priceUnit concept.

Examples:
- per unit
- per set
- per meter
- per piece

Do not assume all products are per unit.

Display price unit clearly on:
- Product Card where appropriate
- Product Detail
- Cart
- RFQ

==================================================
PART 16 — MOQ
==================================================

Introduce MOQ support in the product data structure.

Display:
Minimum order quantity

Only show when a real value exists.

Do not invent MOQ values.

==================================================
PART 17 — BULK PRICING FOUNDATION
==================================================

Create a reusable quantity pricing structure.

Example structure only:

1–9
10–99
100+

Do not invent actual prices.

If no pricing tiers exist:
display a clear:
"Contact Sales for volume pricing"

Design the component so real pricing tiers can be connected later.

==================================================
PART 18 — LEAD TIME
==================================================

Add leadTime support.

Display where data exists:

Lead Time:
4–6 weeks

or:

Contact Sales for lead time

Do not invent lead-time values.

Use a subtle B2B status component.

==================================================
PART 19 — STOCK STATES
==================================================

Create reusable stock states:

In Stock
Low Stock
Out of Stock
Limited Availability

Do not change existing stock logic incorrectly.

For Out of Stock:
disable Add to Cart.

Show:
Request Availability

or:
Contact Sales

Do not remove the RFQ path.

==================================================
PART 20 — CUSTOMER ACCOUNT
==================================================

Improve /account.

Dashboard:
- Total Orders
- Active Quotations
- Wishlist Items
- Loyalty Points if actual state exists

IMPORTANT:
Wishlist count must use actual wishlist length.

Do not hardcode 0.

Customer navigation:

Dashboard
Orders
Quotations
Wishlist
Profile
Addresses
Password
Logout

==================================================
PART 21 — ORDER DETAIL
==================================================

Create:

/account/orders/:id

Include:

Order number
Order date
Status
Items
Quantity
Unit price
Subtotal
Shipping
Tax
Total
Delivery information
Customer information
Order timeline
Contact support

Add:
Back to Orders

Do not invent tracking numbers.

If tracking data does not exist:
display:
"Tracking information will appear when available."

==================================================
PART 22 — QUOTATION DETAIL
==================================================

Create:

/account/quotations/:id

Include:

Quotation number
Date
Expiry
Status
Customer/company
Products
Quantity
Unit price
Subtotal
Discount if available
Tax if available
Total
Terms
Notes

Actions:
Accept Quote
Reject Quote
Contact Sales

Accept Quote:
→ confirmation modal
→ success
→ update local prototype state
→ clear feedback

Do not pretend this is a real server-side transaction.

Structure the logic so it can later connect to API.

==================================================
PART 23 — SAVED ADDRESSES
==================================================

Create:

/account/addresses

Support:
- Add address
- Edit address
- Delete address
- Set default

Fields:
- Name
- Company
- Phone
- Address
- District
- Province
- Postal Code
- Country

Use the existing project data model where possible.

Allow Checkout to select a saved address when authenticated.

==================================================
PART 24 — CHECKOUT VALIDATION
==================================================

Fix required phone validation.

Required:
First Name
Last Name
Email
Phone

Add inline field errors.

Do not allow progression when required fields are invalid.

Show clear error messages.

Add loading state.

Prevent double submission.

==================================================
PART 25 — ADMIN AUTH FOUNDATION
==================================================

Create:

/admin/login

Protect all /admin routes.

Admin session must be separate from customer session.

Admin logout must work.

If there is no real backend:
implement structured prototype session behavior only.

Do not claim production security.

==================================================
PART 26 — ADMIN PRODUCTS
==================================================

Make Admin Products substantially more functional.

Create:
- Product list
- Search
- Filter
- Add Product
- Edit Product
- View Product
- Delete confirmation

Product form should support existing product fields.

Where applicable:
- Name
- Brand
- Category
- Subcategory
- SKU
- Model
- Price
- Price Unit
- Stock
- MOQ
- Lead Time
- Description
- Specifications
- Applications
- Certifications
- Images

Do not invent data.

Use the existing data structure.

==================================================
PART 27 — ADMIN INVENTORY
==================================================

Inventory must no longer be a duplicate Products panel.

Create a dedicated Inventory interface.

Display:
- Product
- SKU
- Current Stock
- Stock Status
- MOQ if available
- Low Stock state

Support stock editing in prototype state.

Add:
Low Stock filter.

Add:
Out of Stock filter.

Do not invent warehouse logic that does not exist.

==================================================
PART 28 — ADMIN ORDERS
==================================================

Create Order Detail / Manage Order UI.

Admin should be able to view:

Order number
Customer
Products
Quantities
Totals
Delivery information
Status

Status options should be structured.

Use existing order statuses if available.

Example:
Pending
Processing
Shipped
Delivered
Cancelled

Do not introduce conflicting statuses if the current data already defines them.

==================================================
PART 29 — ADMIN QUOTATIONS
==================================================

Create a real prototype quotation workflow:

RFQ
→ Review customer requirements
→ Review products
→ Enter pricing
→ Add notes/terms
→ Create quotation
→ Preview
→ Mark as sent

Do not send real email unless an actual email service exists.

Represent "Send" as a prototype state/action.

==================================================
PART 30 — ADMIN CUSTOMER DETAIL
==================================================

Create customer detail view.

Display where data exists:

Customer information
Orders
Quotations
Wishlist summary
Contact information

Do not invent credit limits or financial information.

==================================================
PART 31 — ADMIN RESPONSIVE
==================================================

Fix admin responsive behavior.

Desktop:
fixed sidebar.

Tablet:
collapsible sidebar.

Mobile:
drawer sidebar.

Tables:
wrap in horizontal scrolling containers where tables are appropriate.

Do not allow the sidebar to crush the content area.

==================================================
PART 32 — ADMIN PAGINATION
==================================================

Add reusable pagination to:
- Products
- Orders
- Quotations
- Customers
- Inventory

Keep table layouts clean.

==================================================
PART 33 — LOADING STATES
==================================================

Create reusable loading components.

Add:
- skeleton
- spinner
- button loading
- page loading where necessary

Do not show fake delays unless the existing prototype intentionally simulates a request.

Prevent double-submit.

==================================================
PART 34 — ERROR STATES
==================================================

Create reusable error UI.

Support:
- form error
- network-style error
- failed submission
- failed load
- broken image fallback

Do not expose technical stack traces to users.

==================================================
PART 35 — EMPTY STATES
==================================================

Create consistent empty states for:

No products
No search results
Empty cart
Empty wishlist
No quotations
No orders
No comparison products
No documents
No addresses
No RFQ products

Each should provide a useful next action.

==================================================
PART 36 — MOBILE UX
==================================================

Improve mobile behavior without redesigning desktop.

Products:
- filter button
- filter drawer
- search remains accessible
- sort remains accessible

Cart:
Use labeled mobile item layout.

Example:
Qty: 2
Unit Price: $X
Subtotal: $Y

RFQ:
Make step navigation readable at medium widths.

Header:
Add Account/User access to mobile actions alongside Cart.

Admin:
Use responsive drawer.

==================================================
PART 37 — INDUSTRIES NAVIGATION
==================================================

The current Industries submenu routes multiple industries to the same destination.

Do not create fake pages.

Use the existing product application data where possible.

Create a scalable structure for:

Power Plants
Manufacturing
Construction
Industrial Facilities

If the data supports it:
link to filtered Products results.

Otherwise:
link to a structured Industries section.

==================================================
PART 38 — SERVICES
==================================================

Create /services.

Use the existing NB LAO business positioning.

Possible service categories only if supported by current project content:

Engineering Support
Installation
Commissioning
Maintenance
Technical Support
Procurement Support

Do not invent unsupported certifications or capabilities.

Use existing visual language.

==================================================
PART 39 — LEGAL FOOTER
==================================================

Create placeholder-ready routes:

/privacy
/terms

Do not invent detailed legal claims.

Use professional placeholder structure so actual legal content can be inserted later.

Replace:
href="#"

with proper routes.

==================================================
PART 40 — CONTACT SALES
==================================================

Product Detail "Contact Sales" should not rely only on tel: on desktop.

Create a product enquiry route or modal.

Pre-fill where possible:
Product
SKU
Model

Allow:
Name
Company
Email
Phone
Message

Do not remove phone contact.

Provide both:
Contact Form
Call Sales

==================================================
PART 41 — FOOTER
==================================================

Replace hardcoded copyright year.

Use dynamic current year.

Keep existing footer visual design.

==================================================
PART 42 — SHARED COMPONENT REFACTOR
==================================================

Only after functionality is stable:

Extract reusable components where clearly duplicated:

Breadcrumb
FormInput
StatusBadge
StockBadge
Toast
Modal
Pagination
Loading
EmptyState
ErrorState

Create a shared theme/token source if appropriate.

Do not perform a massive unnecessary refactor.

Do not change behavior while extracting components.

==================================================
PART 43 — DESIGN TOKEN CONSISTENCY
==================================================

Align existing CSS tokens with the current NB LAO colors.

Avoid local duplicated color constants where a shared token is appropriate.

Do not change the visual result.

The goal is maintainability, not redesign.

==================================================
PART 44 — DATA INTEGRITY
==================================================

Do NOT fabricate:

- products
- prices
- stock
- brands
- customers
- orders
- quotations
- certifications
- documents
- lead times
- MOQ
- bulk prices

When data is unavailable:
show a safe empty state or "Contact Sales".

==================================================
PART 45 — REGRESSION PROTECTION
==================================================

Before considering this task complete, verify these existing flows:

1. Home → Products
2. Products → Product Detail
3. Product → Add to Cart
4. Cart → Checkout
5. Checkout steps
6. Product → RFQ
7. RFQ product quantity
8. RFQ submit flow
9. Header search
10. Category filtering
11. Brand filtering
12. Sorting
13. Wishlist
14. Account
15. Admin
16. Mobile navigation

Do not remove existing working behavior.

==================================================
PART 46 — FINAL QUALITY CHECK
==================================================

Perform an internal audit after implementation.

Check:

- no broken routes
- no blank screens
- no obvious console errors
- no broken imports
- no duplicate React keys
- no invalid JSX
- no dead buttons among the newly implemented actions
- no broken navigation
- no obvious horizontal overflow
- mobile layouts remain usable
- existing product cards remain intact
- cart remains functional
- checkout remains functional
- RFQ remains functional
- account remains functional
- admin remains accessible only through the intended prototype auth flow

==================================================
IMPORTANT IMPLEMENTATION STRATEGY
==================================================

Do NOT try to perfect every tiny issue.

Priority:

1. Critical functionality
2. Customer account
3. RFQ
4. Cart persistence
5. Product discovery
6. B2B product information
7. Admin operations
8. Responsive behavior
9. Shared components
10. Minor polish

If a requested feature cannot be implemented safely because the necessary backend/data does not exist:

DO NOT fake a production implementation.

Instead:
- create the correct UI
- create the correct state structure
- use clearly separated prototype behavior
- leave a clean integration boundary for future API/backend work

==================================================
FINAL OUTPUT
==================================================

After implementation, provide a concise report containing:

1. What was implemented
2. What existing functionality was preserved
3. What routes were added
4. What components were added
5. What bugs were fixed
6. What remains intentionally prototype-only
7. Any implementation limitations
8. Any issues that still require backend/API integration

IMPORTANT:
Do not redesign the entire project.
Do not delete working screens.
Do not replace the current NB LAO visual identity.
Do not generate fake business data.
Do not claim backend functionality that does not exist.

IMPLEMENT THE ABOVE CAREFULLY.