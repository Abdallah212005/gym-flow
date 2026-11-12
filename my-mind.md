Front-end : tech-stack (React.js  / next.js)
Back-end : tech-stack (Next.js API routes / Supabase Auth / PostgreSQL)
Deployment : Vercel 


APP (SuperUser = aamr222382@gmail.com)

# GymFlow – Gym Management SaaS

Build a complete, polished Gym Management SaaS application called **GymFlow**.

## 1. Technical Requirements

- Build the frontend with React.js using Next.js.
- Use Node.js for backend/server-side functionality, including Next.js server routes or API endpoints where appropriate.
- Use Supabase Auth for sign-in and Supabase PostgreSQL for persistent application data.
- Use JSON for data exchanged between the frontend and backend endpoints.
- Deploy the application on Vercel and configure Supabase credentials securely.
- No payment gateway.
- Do not use third-party APIs other than the required Supabase services.
- Do not store sensitive credentials or rely on client-side UI checks as the only authorization.
- Use Supabase for persistent application data; reserve LocalStorage for non-sensitive UI preferences only.
- Include realistic initial/seed data for development and demonstration.
- The application must run through the Next.js development server and be deployable to Vercel.

Build a working multi-tenant SaaS MVP, not a static or frontend-only prototype.

## 2. Design Direction

Create a clean, premium, minimalist gym management interface.

Design principles:
- Simple and clear layouts.
- Professional typography.
- Neutral colors: white, off-white, charcoal, and subtle gray.
- One restrained accent color.
- Thin borders and subtle shadows.
- Comfortable spacing.
- Clear hierarchy.
- Consistent icons.
- Elegant tables and forms.
- Responsive design for desktop, tablet, and mobile.

Avoid:
- AI-generated-looking UI.
- Excessive gradients.
- Glassmorphism.
- Excessive rounded cards.
- Neon colors.
- Unnecessary animations.
- Huge dashboard numbers.
- Generic SaaS templates.
- Decorative elements that do not serve a purpose.

The interface should look like a real commercial software product designed by an experienced product designer.

Language: Arabic with full RTL support.

Brand: GymFlow.

## 3. Application Structure

Create the following navigation:

1. Overview
2. Members
3. Memberships
4. Attendance
5. Payments
6. Trainers
7. Expenses
8. Reports
9. Settings

Use a persistent sidebar on desktop and a suitable navigation menu on mobile.

## 4. Dashboard

Create a useful overview dashboard containing:

- Total active members.
- New members this month.
- Expiring memberships.
- Expired memberships.
- Today's attendance.
- Today's revenue.
- Outstanding payments.
- Monthly revenue chart.
- Recent registrations.
- Latest transactions.
- Membership expiration alerts.

All dashboard values must update when demo data changes.

## 5. Members Management

Create a complete members management page.

Member information:
- Full name.
- Phone number.
- Gender.
- Age.
- Registration date.
- Membership status.
- Membership type.
- Membership start date.
- Membership expiration date.
- Payment status.
- Notes.
- Profile image placeholder.

Features:
- Add new member.
- Edit member.
- Delete member with confirmation.
- Search by name or phone.
- Filter by membership status.
- Filter by membership type.
- Open member profile.
- View membership history.
- View attendance history.
- View payment history.

## 6. Membership Management

Support:
- Monthly memberships.
- Quarterly memberships.
- Semiannual memberships.
- Annual memberships.
- Custom-duration memberships.

Each membership plan must have:
- Plan name.
- Duration.
- Price.
- Description.
- Status.

Allow the gym administrator to:
- Create plans.
- Edit plans.
- Activate and deactivate plans.
- Assign plans to members.
- Renew memberships.
- Extend membership expiration dates.
- Freeze memberships.
- Cancel memberships.

Show upcoming expirations and expired memberships.

## 7. Attendance

Create an attendance management page.

Features:
- Register member attendance manually.
- Search member by name or phone.
- Check membership validity before registering attendance.
- Prevent attendance for expired or inactive memberships.
- Display today's attendance.
- Attendance history.
- Filter by date.
- Display entry time.
- Show attendance statistics.

Simulate QR attendance functionality visually, but do not implement actual camera scanning.

## 8. Payments and Financial Management

No online payment integration.

All payments are manually recorded by the gym administrator.

Features:
- Record cash payments.
- Record other offline payment methods.
- Link payments to members.
- Display payment amount.
- Payment date.
- Payment method.
- Remaining balance.
- Outstanding payments.
- Transaction history.
- Daily revenue.
- Monthly revenue.
- Refund and adjustment records.

Persist financial records in Supabase and make it clear when any displayed figures are sample/demo data.

## 9. Trainers and Staff

Create a staff management section.

Features:
- Add trainers and employees.
- Edit employee details.
- Assign roles.
- Record salaries.
- Record commissions.
- Display assigned members.
- Display employee status.

## 10. Expenses

Features:
- Add expense.
- Expense category.
- Amount.
- Date.
- Description.
- Monthly expense report.
- Revenue versus expenses.
- Net profit calculation.

## 11. Reports

Provide:
- Member growth.
- Membership renewals.
- Membership expiration.
- Attendance statistics.
- Revenue reports.
- Expense reports.
- Most popular membership plans.

Include date filters and export-to-CSV functionality.

## 12. Settings

Allow the gym administrator to configure:
- Gym name.
- Gym logo.
- Phone number.
- Address.
- Currency (EGP by default).
- Business hours.
- Membership expiration notification preferences.
- Application appearance.

## 13. MOST IMPORTANT: SaaS Owner Control Panel

This is a critical requirement.

Create a separate interface called:

**Platform Owner – GymFlow Administration**

This interface is intended for the GymFlow platform owner, not ordinary gym administrators.

Add a dedicated owner sign-in and access flow.

The platform owner must have complete visual control over gym accounts and their subscriptions.

### Gym Accounts Management

Display all registered gyms with:

- Gym name.
- Owner name.
- Phone number.
- Email.
- Registration date.
- Current subscription plan.
- Subscription start date.
- Subscription expiration date.
- Account status.
- Internal notes.

### Subscription Control

The platform owner must be able to:

1. Create a gym account.
2. Edit gym account details.
3. Assign any subscription plan manually.
4. Change a gym's subscription plan at any time.
5. Set a custom subscription price.
6. Set subscription start date.
7. Set subscription expiration date.
8. Extend subscriptions manually.
9. Shorten subscriptions manually.
10. Activate a gym account.
11. Suspend a gym account immediately.
12. Reactivate a suspended account.
13. Permanently deactivate a gym account.
14. Add internal notes.
15. View subscription history.

### Subscription Status Logic

Support these states:

- Active: account has valid access.
- Trial: temporary trial access.
- Expired: subscription period has ended.
- Suspended: platform owner manually blocked access.
- Pending: account awaits activation.

Important business rules:

- No payment gateway exists.
- Never automatically charge a gym.
- Never activate a paid subscription automatically.
- The platform owner manually controls subscription activation.
- The platform owner manually controls the expiration date.
- The platform owner can override the subscription status.
- If a subscription expires, the gym dashboard must display an access-restricted screen.
- Suspended accounts must not access the gym management interface.
- Only the platform owner can restore access.

### Owner Dashboard

Display:
- Total registered gyms.
- Active gyms.
- Trial gyms.
- Expired gyms.
- Suspended gyms.
- Monthly recurring revenue (calculated from manually assigned subscription prices).
- Recently registered gyms.
- Upcoming subscription expirations.
- Latest account status changes.

### Important Separation

There are two different subscription systems:

A. GymFlow subscription:
The subscription paid by the gym owner to use GymFlow. Controlled exclusively by the platform owner.

B. Gym member membership:
The membership purchased by an individual to use the gym. Controlled by the gym administrator.

Never mix these two systems.

## 14. Authentication and Role-Based Access

Implement authentication with Supabase Auth and enforce role-based access in both the interface and protected server-side operations.

Support these roles:

- Platform Owner.
- Gym Administrator.
- Receptionist.
- Trainer.

Each role should see an appropriate interface.

Platform Owner must be able to access the SaaS Owner Control Panel.

Gym employees must not see or access platform owner controls through the normal UI.

Do not present authentication as a local simulation or rely on hiding controls in the UI for security. Protect platform-owner and gym data access with appropriate authorization checks.

## 15. Data and Interaction Requirements

- All buttons must perform meaningful actions.
- All forms must validate inputs.
- All tables must support search and filtering.
- Use confirmation dialogs for destructive actions.
- Use toast notifications for successful operations.
- Persist application data in Supabase PostgreSQL.
- Add realistic seed data for development/demo use.
- Include a reset-demo-data option that is restricted to the appropriate authorized environment and role.
- Ensure dashboard statistics update automatically.
- Ensure subscription expiration logic works using the browser's current date.
- Include empty states.
- Include loading-like transitions only where useful.

## 16. Final Quality Requirements

Before finishing:

- Verify all navigation items.
- Verify all buttons and forms.
- Verify the owner subscription management flow.
- Verify suspension and reactivation.
- Verify expired accounts cannot enter the gym dashboard.
- Verify the distinction between GymFlow subscriptions and gym member memberships.
- Verify Supabase-backed data persistence after page refresh and across authenticated sessions.
- Verify RTL layout.
- Verify mobile responsiveness.
- Verify the Next.js application is ready for deployment on Vercel.

Do not deliver a static mockup.

Deliver a fully interactive SaaS application with realistic workflows and polished UI.

**Final instruction:** Prioritize usability, clarity, commercial readiness, and a professional minimalist design over visual effects.