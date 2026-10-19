NB LAO — MASTER UX/UI SYSTEM BUILD

CONTINUE WORKING ON THE CURRENT NB LAO PROJECT FROM ITS EXISTING STATE.

THIS IS NOT A NEW PROJECT.

The current NOP project is the visual and functional foundation.

Your task is to evolve the current project into a complete professional NB LAO industrial B2B e-commerce UX/UI system.

============================================================
GLOBAL RULES — MUST FOLLOW
============================================================

1. DO NOT restart the project.

2. DO NOT recreate the application from scratch.

3. DO NOT replace the current NOP visual identity.

4. DO NOT redesign the homepage from scratch.

5. DO NOT delete existing working screens.

6. DO NOT remove existing working functionality.

7. DO NOT change backend/API/database/business logic.

8. DO NOT invent fake business rules.

9. DO NOT invent unsupported product data.

10. DO NOT replace working product, cart, checkout, authentication, account, or admin logic.

11. Preserve the existing Lao/English experience.

12. Improve and extend the existing design rather than replacing it.

13. Reuse existing components whenever possible.

14. Create reusable components for new screens.

15. All new screens must look like they belong to the existing NB LAO product.

16. Do not create a generic e-commerce template.

17. Do not use excessive blue backgrounds.

18. Do not overuse gradients.

19. Do not overuse cards.

20. Prioritize clarity, hierarchy, whitespace and usability.

============================================================
BRAND
============================================================

Company:

NB LAO SOLE CO., LTD.

Business:

Industrial
Engineering
Electrical
Construction
Power Plant
Manufacturing
Industrial Maintenance

Primary users:

Engineers
Procurement teams
Contractors
Technicians
Factories
Power plants
Industrial companies
Business customers

Brand personality:

Premium
Corporate
Industrial
Engineering
Modern
Clean
Trustworthy
Professional

============================================================
COLOR SYSTEM
============================================================

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

60–70% White / Light surfaces
15–20% Blue
10–15% Navy
3–5% Gold

Blue = actions / navigation / important UI

Navy = brand / strong hierarchy / footer / admin sidebar

Gold = premium accent / active indicator / highlights

============================================================
EXECUTION STRATEGY
============================================================

Execute the project in the following order.

Do not skip structural phases.

Do not visually improvise between phases.

============================================================
STEP 01 — AUDIT EXISTING PROJECT
============================================================

First inspect the current project.

Identify:

Existing screens
Existing components
Existing navigation
Existing product experience
Existing customer experience
Existing admin experience
Existing responsive behavior
Existing states

Classify existing elements:

KEEP
IMPROVE
EXTEND
REBUILD

Do not rebuild working functionality.

============================================================
STEP 02 — DESIGN SYSTEM
============================================================

Create a reusable NB LAO design system.

FOUNDATIONS:

Colors
Typography
Spacing
Grid
Container
Border Radius
Shadows

COMPONENTS:

Buttons
Inputs
Select
Search
Checkbox
Radio
Textarea
File Upload
Cards
Product Cards
Badges
Tables
Tabs
Pagination
Breadcrumb
Dropdown
Modal
Drawer
Toast
Alert
Tooltip
Skeleton
Empty State
Error State
Success State

NAVIGATION:

Header
Desktop Navigation
Mega Menu
Mobile Header
Mobile Drawer
Footer
Account Navigation
Admin Sidebar

B2B:

RFQ Summary
Quotation Summary
Order Summary
Company Information
Technical Document
Download Item
Order Timeline
Quotation Timeline
Status

All future screens must reuse this system.

============================================================
STEP 03 — INFORMATION ARCHITECTURE
============================================================

Create:

HOME

PRODUCTS
├── All Products
├── Categories
├── Product Listing
├── Search Results
├── Product Detail
├── Compare
└── Wishlist

INDUSTRIES
├── Construction
├── Power Plant
├── Manufacturing
├── Electrical
└── Industrial Maintenance

BRANDS
├── Brand Directory
└── Brand Detail

SERVICES
├── Engineering Support
├── Product Consultation
├── Technical Support
└── After Sales Service

PROJECTS
├── Project List
└── Project Detail

NEWS
├── News List
└── News Detail

ABOUT
├── Company
├── Mission / Vision
├── Partners
└── Certifications

CONTACT

DOWNLOAD CENTER

COMMERCE

CART
CHECKOUT
ORDER CONFIRMATION

RFQ

REQUEST QUOTE
RFQ LIST
RFQ FORM
RFQ REVIEW
RFQ CONFIRMATION
MY QUOTATIONS
QUOTATION DETAIL

CUSTOMER ACCOUNT

DASHBOARD
PROFILE
ADDRESSES
ORDERS
ORDER DETAIL
QUOTATIONS
QUOTATION DETAIL
WISHLIST
LOYALTY / POINTS
CHANGE PASSWORD

ADMIN

DASHBOARD
PRODUCTS
CATEGORIES
BRANDS
INVENTORY
ORDERS
QUOTATIONS
CUSTOMERS
REVIEWS
REPORTS
STAFF
SETTINGS

============================================================
STEP 04 — GLOBAL NAVIGATION
============================================================

Preserve the existing header direction.

Desktop:

Logo
Search
Main Navigation
Language
Account
Cart

Mobile:

Logo
Account
Cart
Menu

Mobile navigation should use the existing drawer pattern.

Use expandable navigation for nested sections.

Do not create excessively deep menus.

Use breadcrumbs consistently on internal pages.

============================================================
STEP 05 — HOMEPAGE
============================================================

Preserve the current homepage.

Do not rebuild it.

Refine only where necessary.

Recommended hierarchy:

Header
Hero
Primary CTA
Product Categories
Featured Products
Industries
Brands
Services
How to Order
CTA
Footer

Primary CTA:

Shop Products

Secondary CTA:

Request a Quote

Supporting CTA:

Contact Sales

The homepage must clearly communicate:

What NB LAO sells
Who NB LAO serves
How customers find products
How customers purchase
How customers request quotations
How customers contact sales

============================================================
STEP 06 — PRODUCT EXPERIENCE
============================================================

Create a complete consistent product experience.

PRODUCT LISTING

Breadcrumb
Page Title
Result Count
Search
Filters
Sort
Product Grid
Pagination

DESKTOP:

Persistent filter area where appropriate.

MOBILE:

Compact filter button
Filter drawer
Apply
Clear

Do not permanently display large filters on mobile.

PRODUCT CARD:

Image
Brand
SKU
Product Name
Model
Short Specification
Price
Stock
Wishlist
Compare
Add to Cart
Request Quote

Keep cards clean.

PRODUCT DETAIL:

Breadcrumb
Brand
Product Image Gallery
Product Name
Model
SKU
Price
Stock
Quantity
Add to Cart
Request Quote
Wishlist
Compare
Contact Sales
Download Datasheet

Sections:

Overview
Specifications
Documents
Applications
Related Products
Recommended Products

Technical specifications must be easy to scan.

============================================================
STEP 07 — PRODUCT COMPARE
============================================================

Create a professional product comparison experience.

Show:

Products
Images
Brand
Model
SKU
Price
Availability
Technical Specifications

Highlight differences clearly.

Support removing products from comparison.

Maintain responsive behavior.

============================================================
STEP 08 — CART
============================================================

Preserve existing cart functionality.

Improve visual hierarchy.

Show:

Product
SKU
Quantity
Unit Price
Subtotal
Availability
Remove

Summary:

Subtotal
Shipping
Discount / Points if supported
Total

Primary:

Proceed to Checkout

Secondary:

Continue Shopping

Create a proper Empty Cart state.

============================================================
STEP 09 — CHECKOUT
============================================================

Preserve existing checkout logic.

Create clear structure:

Customer
Delivery
Payment / Order Information
Review
Confirmation

Use only fields supported by the existing application.

Prefill customer information when available.

Before final submission show:

Products
Quantity
Pricing
Delivery
Total
Customer information

Create:

Validation
Loading
Error
Success

After success:

Order Number
Order Summary
View Order
Continue Shopping

============================================================
STEP 10 — B2B RFQ
============================================================

Create a professional B2B Request for Quotation experience.

ENTRY:

Product Detail
Product Card
Cart

FLOW:

Product
↓
Request Quote
↓
RFQ List
↓
Quantity
↓
Delivery Location
↓
Required Date
↓
Company Information
↓
Contact Person
↓
Additional Requirements
↓
Attachments
↓
Review
↓
Submit
↓
Confirmation

Do not make RFQ look like a generic contact form.

============================================================
STEP 11 — QUOTATION
============================================================

Create:

My Quotations
Quotation List
Quotation Detail

Quotation Detail:

Quotation Number
Date
Valid Until
Customer
Products
Quantity
Unit Price
Subtotal
Total
Terms if supported

Statuses:

Pending
Reviewing
Quoted
Accepted
Rejected
Expired

Only use statuses supported by the existing application.

============================================================
STEP 12 — CUSTOMER ACCOUNT
============================================================

Preserve the existing account architecture.

Dashboard:

Orders
Pending Orders
Quotations
Pending Quotations
Wishlist
Points / Loyalty if supported

Navigation:

My Profile
Address Book
Order History
Quote History
Wishlist
Loyalty
Change Password
Logout

Order Detail:

Order Number
Status
Timeline
Customer
Delivery
Products
Totals

Quotation Detail:

Quotation Number
Status
Products
Totals
Valid Until

============================================================
STEP 13 — CORPORATE CONTENT
============================================================

Create complete professional pages.

ABOUT US

Company
Mission
Vision
Capabilities
Industries
Partners
Certifications
CTA

SERVICES

Service List
Service Detail

INDUSTRIES

Industry List
Industry Detail
Relevant Products
Services
Projects
CTA

BRANDS

Brand Directory
Brand Detail
Brand Products

PROJECTS

Project List
Project Detail

NEWS

News List
News Detail

CONTACT

Office
Phone
Email
Sales
Technical Support
Contact Form if supported

DOWNLOAD CENTER

Datasheets
Catalogs
Manuals
Technical Documents

Do not invent documents.

============================================================
STEP 14 — ADMIN PLATFORM
============================================================

Create a professional admin operations interface.

Admin should prioritize:

Data density
Speed
Search
Filtering
Bulk actions
Status visibility
Operational clarity

NAVIGATION:

Dashboard
Products
Categories
Brands
Inventory
Orders
Quotations
Customers
Reviews
Reports
Staff
Settings

DASHBOARD:

Orders
Pending Orders
RFQs
Pending Quotations
Customers
Products
Inventory Alerts
Recent Orders
Recent RFQs

PRODUCT MANAGEMENT:

Product List
Add Product
Edit Product
Product Detail

Product table:

Image
SKU
Product
Brand
Category
Price
Stock
Status
Updated
Actions

ORDER MANAGEMENT:

Order List
Order Detail
Customer
Products
Delivery
Payment
Totals
Status Timeline

RFQ MANAGEMENT:

RFQ List
RFQ Detail
Customer
Products
Quantity
Requirements
Attachments
Quotation

CUSTOMERS:

Customer List
Customer Detail
Profile
Company
Orders
Quotations
Addresses

Use tables for data-heavy admin screens.

Do not turn every data view into cards.

============================================================
STEP 15 — UI STATES
============================================================

Create appropriate states for every major screen.

Global:

Default
Loading
Empty
Error
Success
Disabled
Focus
Validation Error
Unauthorized
Session Expired

Products:

Loading
Products Found
No Products
No Search Results
Out of Stock
API Error

Cart:

Empty
Loading
Updating
Error

Checkout:

Loading
Validation Error
Submitting
Error
Success

RFQ:

Empty
Draft
Submitting
Error
Submitted

Quotation:

Pending
Reviewing
Quoted
Accepted
Rejected
Expired

Orders:

Processing
Confirmed
Preparing
Shipped
Delivered
Cancelled

Use only business statuses supported by the existing system.

============================================================
STEP 16 — RESPONSIVE
============================================================

Create responsive behavior for all important screens.

Desktop:

1440
1280

Tablet:

1024
768

Mobile:

390
375

Do not simply shrink desktop.

Adapt:

Header
Navigation
Search
Mega Menu
Product Grid
Filters
Tables
Forms
Checkout
RFQ
Account
Admin Sidebar
Dialogs
Buttons
Typography
Spacing

Mobile priorities:

Readable
Fast
Touch-friendly
Simple
Minimal horizontal scrolling

============================================================
STEP 17 — PROTOTYPE CONNECTIONS
============================================================

Create a coherent clickable prototype.

CUSTOMER FLOW:

Home
→ Products
→ Product Detail
→ Add to Cart
→ Cart
→ Checkout
→ Confirmation
→ My Orders
→ Order Detail

RFQ FLOW:

Home
→ Product
→ Request Quote
→ RFQ
→ Review
→ Submit
→ Confirmation
→ My Quotations
→ Quotation Detail

SEARCH FLOW:

Home
→ Search
→ Search Results
→ Filter
→ Product Detail

ACCOUNT FLOW:

Login
→ Dashboard
→ Orders
→ Order Detail

ADMIN FLOW:

Admin Login
→ Dashboard
→ Products
→ Product Detail/Edit
→ Orders
→ Order Detail
→ Quotations
→ RFQ Detail
→ Customers

Connect relevant buttons and navigation elements.

Do not create dead-end prototype screens when a logical destination exists.

============================================================
STEP 18 — FINAL UX/UI AUDIT
============================================================

After completing the design, perform a complete consistency audit.

Check:

Visual consistency
Color
Typography
Spacing
Components
Navigation
Product UX
Cart
Checkout
RFQ
Quotation
Account
Admin
Responsive
Accessibility
States
Prototype connections

Look specifically for:

Duplicate components
Inconsistent buttons
Inconsistent spacing
Inconsistent typography
Broken hierarchy
Missing states
Missing navigation
Dead-end flows
Mobile overflow
Overuse of blue
Overuse of cards
Missing B2B actions

Fix only necessary UX/UI issues.

============================================================
FINAL QUALITY STANDARD
============================================================

The final result should feel like one complete NB LAO digital platform.

NOT:

A collection of unrelated pages.

It should feel like:

ONE DESIGN SYSTEM
+
ONE INFORMATION ARCHITECTURE
+
ONE CUSTOMER EXPERIENCE
+
ONE B2B COMMERCE EXPERIENCE
+
ONE RFQ EXPERIENCE
+
ONE CUSTOMER PORTAL
+
ONE ADMIN PLATFORM

Maintain the existing NOP visual quality throughout.

Do not sacrifice existing working functionality for visual changes.

Do not stop after creating only the homepage.

Complete the full UX/UI system and connect the important prototype flows.