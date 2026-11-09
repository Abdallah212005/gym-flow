This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Firebase setup

The app uses Firebase Authentication for Google owner verification and username/password sessions, and Cloud Firestore through the Firebase Admin SDK for server-side data access. Firestore client access is denied by default; do not loosen these rules because the app's API enforces account, subscription, and role permissions.

1. In Firebase project `gym-flow-928d9`, register a Web App and copy its API key and App ID.
2. In **Authentication → Sign-in method**, enable Google and Email/Password.
3. Create a service account with access to Firebase Authentication and Firestore. Keep its private key secret.
4. Copy `.env.example` to `.env.local` and fill the Web App values plus `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`. For a private key with newlines, use escaped `\n` sequences in the environment value.
5. Add the same environment variables to the deployment provider. The `NEXT_PUBLIC_*` values are public Firebase Web App configuration; never expose the Admin service-account key.
6. Deploy the locked Firestore rules with the Firebase CLI while authenticated to the intended project:

   ```sh
   firebase use gym-flow-928d9
   firebase deploy --only firestore:rules
   ```

7. Install dependencies and run the app:

   ```sh
   npm install
   npm run dev
   ```

New club registrations require Google verification and remain `pending` until the platform administrator activates them. Platform administration is restricted to `aamr222382@gmail.com`. Employees sign in with the username and password created by the club owner and receive only the selected permissions.

The service-account credentials must be provisioned outside Git (for example, in the deployment provider's encrypted environment variables). Never commit `.env.local`, downloaded service-account JSON, or private keys.

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
