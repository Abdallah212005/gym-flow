# Gym Flow Logic

**Super Admin:** `aamr222382@gmail.com`

## 1. Super Admin System

The Super Admin has full control over the entire platform.

- Access all registered Gym Owners and their Google accounts.
- View all registered gyms and their systems.
- Enable or disable any gym subscription at any time.
- Set subscription duration, start date, and expiration date.
- Access any gym system for inspection and support.
- View and receive reports submitted by Gym Owners.
- Control each gym's subscription status.

## 2. Authentication System

The system uses two separate authentication methods:

**Google Authentication (Gym Registration)**

- Gym Owner signs in using Google.
- If the Gmail does not exist in the database, a new Gym registration process starts.
- The owner creates an Administration Account using a Username and Password.
- The new Gym is registered with `pending` status.
- Google Authentication is used only to identify the Gym Owner and establish the Gym's existence.

**Normal Database Authentication (System Login)**

- Gym Owners and employees use their Username and Password to access the system.
- The Gym Owner has full control over their gym.
- The Gym Owner can create employee accounts, assign roles, and control which tabs and features each employee can access.

**Google Auth = Gym Identity & Registration**

**Normal Auth = Gym Administration & Employee Accounts**

## 3. Subscription & Access Logic

After Google Authentication and Gym registration, the entire Gym System remains locked until the Super Admin activates the subscription.

- `pending`: Gym registered but not activated. No system access or functionality is allowed.
- `active`: Gym is activated and can use the full system.
- `expired`: Subscription duration has ended and access is automatically blocked.
- `suspended`: Super Admin manually disables the Gym.

There is no Payment Gateway. All payments are handled externally, and the Super Admin manually confirms payment, activates the Gym, and sets its subscription duration.

**Important:** No Gym Owner or employee can access any system functionality before subscription activation. This restriction must be enforced through the backend and database security rules, not just the UI.


## Super User 
Super user main window is saas administration not a normal system 