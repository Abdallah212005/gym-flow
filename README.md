This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Supabase setup

The app uses Supabase Auth for Google OAuth and username/password sign-in, and Supabase Postgres for gym, member, staff, and support-session data. Server-side API routes use the service-role key; browser clients never receive it. Row-level security is enabled without public policies.

1. Create a Supabase project and run [`supabase/migrations/20261112000000_initial_schema.sql`](./supabase/migrations/20261112000000_initial_schema.sql) in the Supabase SQL Editor.
2. In **Authentication → Providers**, enable Google and Email/Password, then configure the Google OAuth client. Add the Supabase callback URL shown by the provider setup to the Google OAuth client's authorized redirect URIs.
3. In **Authentication → URL Configuration**, set the site URL to your Vercel deployment and add `https://YOUR-DOMAIN/api/auth/callback` to the allowed redirect URLs. Add `http://localhost:3000/api/auth/callback` for local development.
4. Copy `.env.example` to `.env.local`. Set the Supabase project URL, anon key, and service-role key from **Project Settings → API**. Keep the service-role key private and never prefix it with `NEXT_PUBLIC_`.
5. Add those same three variables to the Vercel project's environment variables, then deploy the Next.js app normally. The `/api/*` routes run as Vercel functions.
6. Install dependencies and run the app:

   ```sh
   npm install
   npm run dev
   ```

New club registrations require Google verification and remain `pending` until the platform administrator activates them. Platform administration is restricted to `aamr222382@gmail.com`. Employees sign in with the username and password created by the club owner and receive only the selected permissions.

Existing authentication accounts and stored records are not copied automatically. Export and migrate them before switching production traffic. Never commit `.env.local` or service-role credentials.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
