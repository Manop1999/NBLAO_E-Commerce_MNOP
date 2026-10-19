Refine the existing NB LAO website header, navigation, search, and language system based on the confirmed UX requirements below.

IMPORTANT:
- Do NOT rebuild the project.
- Do NOT create markdown, text, or other files.
- Directly modify the existing project.
- Preserve the current NB LAO visual identity and all working functionality.
- Implement all confirmed changes in one pass.
- Do not make unrelated redesign changes.

==================================================
1. PRODUCTS NAVIGATION
==================================================

DESKTOP ONLY:

Keep a Products Mega Menu, but make it clean, compact, and easy to scan.

The Desktop Mega Menu must:
- Show a clear Category → Subcategory hierarchy.
- Use a clean multi-column layout.
- Avoid an oversized wall of links.
- Show the most important subcategories only.
- Provide "View All" when a category contains more subcategories.
- Make every Category and Subcategory directly clickable.
- Keep the menu visually aligned with the NB LAO corporate design.
- Prevent the Mega Menu from being clipped at the left or right edge of the viewport.
- Do not allow the Mega Menu to cover or create horizontal page overflow.

DESKTOP PRODUCT MENU EXAMPLE:

Products
    ↓
Product Categories

Electrical Equipment
  Transformers
  Switchgear & Circuit Breakers
  Control Panels & MCC
  Motors & Drives
  Metering & Instrumentation
  View All →

Industrial Machinery
  Compressors
  Pumps & Valves
  Conveyors & Material Handling
  Processing Equipment
  View All →

Power & Energy
  Diesel Generators
  Solar & Renewable
  UPS & Battery Systems
  Power Distribution Units
  View All →

Do not display every subcategory if a category contains a very large number of items.

==================================================
2. MOBILE / TABLET PRODUCTS MUST BE A DIRECT LINK
==================================================

IMPORTANT:
Do NOT make Products a dropdown on Mobile or Tablet.

Do NOT use:
- Products accordion
- Products dropdown
- Products expandable section
- Products drill-down navigation
- Products submenu
- Products arrow indicator
- Products ">" or "→" icon

The Products item must look and behave exactly like a normal direct navigation item.

Example:

Menu
────────────────
Home
Products
Industries
Services
About Us
Brands
Contact
────────────────
Request a Quote

There must be NO arrow beside Products.

When the user taps anywhere on the Products row:
→ immediately navigate to the main Product Listing page
→ close the navigation drawer

The entire Products row must be clickable.

Do not show Product Categories or Product Subcategories inside the Mobile/Tablet navigation drawer.

Category and Subcategory selection must happen ONLY inside the Product Listing page through the existing Product Filter Drawer.

The intended Mobile/Tablet flow is:

Menu
→ Products
→ Product Listing
→ Filters
→ Category
→ Subcategory
→ Product Results

This is intentional.

Do not change this behavior back to a Products dropdown.

==================================================
3. NAVIGATION DRAWER
==================================================

Mobile/Tablet navigation must use a clean Hamburger Navigation Drawer.

The drawer should contain:

Home
Products
Industries
Services
About Us
Brands
Contact

Request a Quote should remain available as a separate CTA at the bottom of the drawer where appropriate.

Products must be a direct link and must NOT contain an arrow.

The Navigation Drawer must:
- Slide smoothly from the right.
- Use transform-based animation.
- Use approximately 300ms smooth ease-out animation.
- Use a subtle backdrop fade.
- Prevent body scrolling while open.
- Close when tapping the backdrop.
- Close with the X button.
- Close with the Escape key where supported.
- Never overlap or conflict with the Product Filter Drawer.

==================================================
4. PRODUCT FILTER DRAWER
==================================================

Keep the Product Filter Drawer completely separate from the Navigation Drawer.

The Product Listing page should use:

[ Filters ] [ Search ] [ Sort ]

The Filter Drawer should contain:

Category
Subcategory
Brand
Price Range
Stock / Availability
Clear All
Apply Filters

On Mobile/Tablet:
- Filters open from the left.
- Navigation opens from the right.
- They must never appear simultaneously.
- Opening one must automatically close the other.
- Use the existing smooth drawer animation system.

Do NOT move Product Filters into the Navigation Drawer.

Do NOT put Product Categories inside the Navigation Drawer.

==================================================
5. LANGUAGE SWITCHER
==================================================

Remove the EN / ລາວ language switcher from the Desktop top blue utility bar.

The Desktop top utility bar should remain focused on:
- Phone
- Email
- Company/location information
- Other utility information if already present

Place the Language Switcher in the main header where the current global "Request a Quote" button is positioned beside Cart.

The header utility area should become:

[ Search Box ] [ Account ] [ Cart ] [ EN / ລາວ ]

The language switcher must be compact and visually consistent with the NB LAO header.

==================================================
6. GLOBAL LANGUAGE SYSTEM
==================================================

The language switcher must work as a REAL global website language system.

Do NOT translate only the navigation.

When the user changes language:

EN ↔ ລາວ

ALL user-facing website text must update to the selected language.

This includes, but is not limited to:

- Header
- Navigation
- Mega Menu
- Search
- Search placeholders
- Product Listing
- Product Categories
- Product Subcategories
- Product Cards
- Product Detail
- Product Specifications
- Product Documents
- Product Filters
- Sort options
- Pagination
- Cart
- Checkout
- Shipping
- Payment
- Order Confirmation
- Orders
- Order Detail
- Quotations
- Quotation Detail
- RFQ
- RFQ forms
- RFQ validation
- Account
- Dashboard
- Wishlist
- Profile
- Login
- Register
- Forgot Password
- Change Password
- Services
- Industries
- About Us
- Brands
- Contact
- Footer
- Buttons
- Labels
- Status messages
- Validation messages
- Empty states
- Error messages
- Success messages
- Modal dialogs
- System UI text

Do not leave mixed English/Lao text on the same page after switching languages.

Use a centralized translation structure / i18n system instead of duplicating language logic independently inside each component.

The selected language must:
- Persist using localStorage.
- Remain active after navigation.
- Remain active after page refresh.
- Apply consistently across all pages.

Do not hard-code isolated language switches in individual components.

==================================================
7. REQUEST A QUOTE
==================================================

Remove the global Request a Quote button from the main header position beside Cart and replace that position with the Language Switcher.

IMPORTANT:
Do NOT remove Request a Quote functionality from the website.

Keep Request a Quote accessible in appropriate contextual locations, including:

- Product Detail
- Product Cards where appropriate
- Cart / Convert to RFQ
- Products Mega Menu where appropriate
- Navigation Drawer CTA
- Footer
- RFQ page
- Other existing contextual B2B locations

Do not duplicate Request a Quote unnecessarily throughout the interface.

==================================================
8. DESKTOP SEARCH
==================================================

Replace the tiny Search icon in the Desktop header with a properly sized Search Box.

Target width:
approximately 220–280px.

Example:

[ 🔍 Search products... ]

The Search Box must:
- Be clearly visible.
- Have an appropriate height.
- Match the NB LAO design system.
- Remain compact enough not to overcrowd the header.
- Remain fully functional.

Do not remove existing Search functionality.

==================================================
9. MOBILE SEARCH
==================================================

Search must be clearly visible on Mobile.

Use this structure:

[ Logo ] [ Account ] [ Cart ] [ Hamburger ]
[        Search products...        ]

The Search Box should appear directly below the main Mobile Header.

Do NOT hide Search behind an icon-only interaction.

The Mobile Search Box must:
- Be clearly visible.
- Have an appropriate height.
- Have comfortable touch target size.
- Support product search.
- Prevent horizontal overflow.

==================================================
10. MOBILE / TABLET TOP UTILITY BAR
==================================================

Remove the blue Desktop utility/contact bar completely from Mobile and Tablet.

Do NOT show the following on Mobile/Tablet in the top utility bar:

- Phone
- Email
- Language
- Admin
- Industrial Supply text

Keep the blue utility bar for Desktop only.

Mobile should start directly with the main header:

[ Logo ] [ Account ] [ Cart ] [ Hamburger ]

Then:

[ Search products... ]

This should reduce unnecessary vertical space on Mobile.

==================================================
11. MOBILE HEADER
==================================================

Mobile Header structure:

Logo | Account | Cart | Hamburger

Search Box below.

Keep the header:
- Compact
- Clean
- Easy to tap
- Free of horizontal overflow
- Consistent with NB LAO branding

Do not add unnecessary utility elements to Mobile.

==================================================
12. RESPONSIVE BEHAVIOR
==================================================

Verify the new Header, Navigation, Products Menu, Search, Language Switcher, Navigation Drawer and Filter Drawer at:

375px
390px
430px
768px
820px
834px
1024px
1280px
1440px

Check specifically for:

- Horizontal overflow
- Clipped Mega Menu
- Drawer overlap
- Drawer stacking problems
- Incorrect z-index
- Body scrolling behind drawers
- Incorrect touch targets
- Header overcrowding
- Search visibility
- Language Switcher placement
- Products direct-link behavior
- Missing translations
- Mixed English/Lao content
- Footer/header duplication
- Broken navigation routes

==================================================
13. PRESERVE EXISTING FUNCTIONALITY
==================================================

Do NOT break or redesign unrelated working functionality.

Preserve:

- Product Listing
- Product Filters
- Product Pagination
- Product Detail
- Cart
- Checkout
- Shipping
- Payment
- RFQ
- Orders
- Order Detail
- Quotations
- Quotation Detail
- Wishlist
- Customer Account
- Authentication
- Admin
- Existing product data
- Existing routing
- Existing responsive behavior that is already working

Do not change business logic unless required for the confirmed Header, Navigation, Search or Language integration.

==================================================
14. FINAL UX RULES
==================================================

The final behavior must be:

DESKTOP:

Top Utility Bar
→ Phone / Email / Company information

Main Header
→ Logo
→ Home
→ Products
→ Industries
→ Services
→ About Us
→ Brands
→ Contact
→ Search Box
→ Account
→ Cart
→ EN / ລາວ

Products:
→ Compact Desktop Mega Menu
→ Category → Subcategory
→ Direct clickable links

MOBILE / TABLET:

Main Header
→ Logo
→ Account
→ Cart
→ Hamburger

Search
→ Search Box

Navigation Drawer
→ Home
→ Products
→ Industries
→ Services
→ About Us
→ Brands
→ Contact
→ Request a Quote

Products:
→ DIRECT LINK ONLY
→ NO ARROW
→ NO DROPDOWN
→ NO ACCORDION
→ NO SUBMENU
→ Navigate directly to Product Listing

Product Listing:
→ Filters
→ Category
→ Subcategory
→ Brand
→ Price
→ Stock

Language:
→ EN / ລາວ
→ Global translation across the entire website
→ Persist with localStorage

IMPORTANT FINAL INSTRUCTION:

Do not stop after changing only the Header.

Implement and verify ALL confirmed Header, Navigation, Search, Language, Mobile/Tablet and Products navigation requirements above in one pass.

Do not create files.
Do not rebuild the project.
Do not remove existing functionality.
Do not revert Mobile/Tablet Products back to a dropdown or accordion.