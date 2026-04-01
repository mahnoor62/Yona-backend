# Trading App — Backend

Production-ready Node.js + Express backend using Supabase (Auth + Postgres) as the database/auth provider.

---

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Runtime     | Node.js ≥ 18                      |
| Framework   | Express 4                         |
| Database    | Supabase (PostgreSQL)             |
| Auth        | Supabase Auth (Admin API)         |
| Email       | Nodemailer + Gmail SMTP           |
| Security    | Helmet, CORS, express-rate-limit  |

---

## Project Structure

```
src/
  app.js                    Express app setup (middleware, routes)
  server.js                 HTTP server entry point + graceful shutdown
  config/
    env.js                  Env var loading and validation
    supabase.js             Supabase admin + anon clients
    mailer.js               Nodemailer transporter
  routes/
    auth.routes.js          POST /api/auth/*
    avatar.routes.js        GET|PUT /api/avatar/me
    page.routes.js          GET /auth/verify-email, GET /auth/reset-password
  controllers/
    auth.controller.js      Signup, signin, forgot/reset password
    avatar.controller.js    Get / set avatar
    page.controller.js      Server-rendered HTML pages
  middlewares/
    auth.middleware.js      Bearer token verification via Supabase
    error.middleware.js     Centralized error handler
    validate.middleware.js  Input validation factory
  services/
    auth.service.js         Core auth business logic
    token.service.js        Email verification & password reset tokens
    email.service.js        Nodemailer email sending
    user.service.js         Profile DB operations
  utils/
    crypto.js               Secure token generation + SHA-256 hashing
    responses.js            Standard JSON response helpers
    validators.js           Input validation functions
    html.js                 Server-rendered HTML page templates

sql/
  001_init.sql              Full Supabase schema migration
```

---

## 1. Supabase Setup

### 1.1 Create a Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project** and fill in the details.
3. Wait for the project to finish provisioning.

### 1.2 Run the SQL Migration

1. In your Supabase dashboard, go to **SQL Editor**.
2. Click **New query**.
3. Paste the entire contents of `sql/001_init.sql`.
4. Click **Run**.

### 1.3 Get Your API Keys

Go to **Settings → API** and copy:

| Variable                  | Where to find it                        |
|---------------------------|-----------------------------------------|
| `SUPABASE_URL`            | Project URL                             |
| `SUPABASE_ANON_KEY`       | `anon` / `public` key                  |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key (keep secret!)    |

### 1.4 Disable Supabase's Built-in Email Confirmation

Because we handle email verification ourselves, disable Supabase's default confirmation emails to avoid conflicts:

1. Go to **Authentication → Email Templates**.
2. Go to **Authentication → Providers → Email**.
3. Disable **"Confirm email"** (or leave it; our `email_confirm: false` flag in `createUser` means Supabase won't send anything regardless).

> **Important:** The service role key must only ever be used server-side. Never expose it to clients.

---

## 2. Gmail App Password Setup

Standard Gmail passwords do not work with SMTP. You must generate an **App Password**.

1. Go to your Google Account → **Security**.
2. Under "How you sign in to Google", ensure **2-Step Verification** is enabled.
3. Go to **Security → App passwords** (search "App passwords" in the Google Account settings search bar).
4. Select app: **Mail** → Select device: **Other (custom name)** → enter `Trading App`.
5. Click **Generate** and copy the 16-character password.
6. Use this as `SMTP_PASS` in your `.env`.

---

## 3. Local Setup

### 3.1 Install Dependencies

```bash
npm install
```

### 3.2 Configure Environment

```bash
cp .env.example .env
```

Open `.env` and fill in all values:

```env
PORT=3000
NODE_ENV=development
APP_BASE_URL=http://localhost:3000

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
SMTP_FROM=Trading App <your-gmail@gmail.com>

JWT_AUTH_STRATEGY=supabase
```

### 3.3 Run the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server starts at `http://localhost:3000`.

---

## 4. API Reference

All API endpoints return JSON. The standard response envelope is:

```json
{
  "success": true | false,
  "message": "Human-readable message",
  "data": { ... }
}
```

### 4.1 Sign Up

**`POST /api/auth/signup`**

```json
{
  "username": "john123",
  "email": "john@example.com",
  "password": "StrongPass123!"
}
```

Rules:
- `username`: 3–30 chars, lowercase letters / numbers / underscores only.
- `password`: min 8 chars, must include uppercase, lowercase, number, and special character.
- Sends a verification email after successful signup.

**Response `201`:**
```json
{
  "success": true,
  "message": "Signup successful. Please verify your email.",
  "data": {
    "userId": "uuid",
    "email": "john@example.com",
    "username": "john123"
  }
}
```

---

### 4.2 Verify Email

**`GET /auth/verify-email?token=<raw_token>`**

- Opened from the link in the verification email.
- Returns an HTML success or failure page.
- Marks the user as email-confirmed in Supabase Auth.

---

### 4.3 Sign In

**`POST /api/auth/signin`**

```json
{
  "login": "john123",
  "password": "StrongPass123!"
}
```

- `login` can be a username **or** email address.
- Returns 403 if email is not yet verified.

**Response `200`:**
```json
{
  "success": true,
  "message": "Signin successful.",
  "data": {
    "user": {
      "id": "uuid",
      "email": "john@example.com",
      "username": "john123"
    },
    "session": {
      "access_token": "eyJ...",
      "refresh_token": "...",
      "expires_in": 3600,
      "token_type": "bearer"
    }
  }
}
```

---

### 4.4 Forgot Password

**`POST /api/auth/forgot-password`**

```json
{
  "email": "john@example.com"
}
```

- Always returns success to prevent email enumeration.
- Sends a password reset email if the account exists.

**Response `200`:**
```json
{
  "success": true,
  "message": "If the email exists, a password reset link has been sent."
}
```

---

### 4.5 Reset Password Form Page

**`GET /auth/reset-password?token=<raw_token>`**

- Opened from the link in the reset email.
- Returns an HTML form page if the token is valid.
- Returns an HTML error page if the token is invalid or expired.

---

### 4.6 Reset Password (API)

**`POST /api/auth/reset-password`**

Accepts both `application/json` and `application/x-www-form-urlencoded` (from the HTML form).

```json
{
  "token": "<raw_token>",
  "password": "NewStrongPass123!",
  "confirmPassword": "NewStrongPass123!"
}
```

- JSON requests receive a JSON response.
- Form submissions receive an HTML success/failure page.

**Response `200` (JSON):**
```json
{
  "success": true,
  "message": "Password has been reset successfully."
}
```

---

### 4.7 Get Avatar

**`GET /api/avatar/me`**

Requires: `Authorization: Bearer <access_token>`

**Response `200`:**
```json
{
  "success": true,
  "message": "Avatar retrieved.",
  "data": {
    "body": 1,
    "hairstyle": 2,
    "head": 3,
    "top": 4,
    "bottom": 5,
    "shoes": 6
  }
}
```

---

### 4.8 Set Avatar

**`PUT /api/avatar/me`**

Requires: `Authorization: Bearer <access_token>`

```json
{
  "body": 1,
  "hairstyle": 2,
  "head": 3,
  "top": 4,
  "bottom": 5,
  "shoes": 6
}
```

- All 6 fields are required.
- All values must be non-negative integers.

**Response `200`:**
```json
{
  "success": true,
  "message": "Avatar updated.",
  "data": {
    "body": 1,
    "hairstyle": 2,
    "head": 3,
    "top": 4,
    "bottom": 5,
    "shoes": 6
  }
}
```

---

## 5. Postman Collection

Import this JSON directly into Postman:

```json
{
  "info": {
    "name": "Trading App API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    { "key": "base_url", "value": "http://localhost:3000" },
    { "key": "access_token", "value": "" }
  ],
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Sign Up",
          "request": {
            "method": "POST",
            "header": [{ "key": "Content-Type", "value": "application/json" }],
            "url": "{{base_url}}/api/auth/signup",
            "body": {
              "mode": "raw",
              "raw": "{\"username\":\"john123\",\"email\":\"john@example.com\",\"password\":\"StrongPass123!\"}"
            }
          }
        },
        {
          "name": "Sign In",
          "request": {
            "method": "POST",
            "header": [{ "key": "Content-Type", "value": "application/json" }],
            "url": "{{base_url}}/api/auth/signin",
            "body": {
              "mode": "raw",
              "raw": "{\"login\":\"john123\",\"password\":\"StrongPass123!\"}"
            }
          }
        },
        {
          "name": "Forgot Password",
          "request": {
            "method": "POST",
            "header": [{ "key": "Content-Type", "value": "application/json" }],
            "url": "{{base_url}}/api/auth/forgot-password",
            "body": {
              "mode": "raw",
              "raw": "{\"email\":\"john@example.com\"}"
            }
          }
        },
        {
          "name": "Reset Password (API)",
          "request": {
            "method": "POST",
            "header": [{ "key": "Content-Type", "value": "application/json" }],
            "url": "{{base_url}}/api/auth/reset-password",
            "body": {
              "mode": "raw",
              "raw": "{\"token\":\"<paste_raw_token_here>\",\"password\":\"NewStrongPass123!\",\"confirmPassword\":\"NewStrongPass123!\"}"
            }
          }
        }
      ]
    },
    {
      "name": "Avatar",
      "item": [
        {
          "name": "Get Avatar",
          "request": {
            "method": "GET",
            "header": [{ "key": "Authorization", "value": "Bearer {{access_token}}" }],
            "url": "{{base_url}}/api/avatar/me"
          }
        },
        {
          "name": "Set Avatar",
          "request": {
            "method": "PUT",
            "header": [
              { "key": "Content-Type", "value": "application/json" },
              { "key": "Authorization", "value": "Bearer {{access_token}}" }
            ],
            "url": "{{base_url}}/api/avatar/me",
            "body": {
              "mode": "raw",
              "raw": "{\"body\":1,\"hairstyle\":2,\"head\":3,\"top\":4,\"bottom\":5,\"shoes\":6}"
            }
          }
        }
      ]
    }
  ]
}
```

---

## 6. Security Notes

| Concern                    | Implementation                                           |
|----------------------------|----------------------------------------------------------|
| Secrets in DB              | Only SHA-256 hashes of tokens are stored                 |
| Token expiry               | Verification: 24 h · Reset: 1 h                         |
| Token reuse                | Tokens are marked `used_at` after first consumption     |
| Old reset tokens           | All previous unused reset tokens are invalidated on new request |
| Email enumeration          | Forgot-password always returns a generic success message |
| Admin key exposure         | Service role key is server-only, never sent to clients   |
| Rate limiting              | 20 requests / 15 min on all `/api/auth/*` routes         |
| Input validation           | All inputs validated before service layer is reached     |
| Password policy            | Min 8 chars, upper + lower + digit + special char        |
| HTML injection             | All user data escaped before rendering in HTML pages     |

---

## 7. npm Packages

```bash
npm install @supabase/supabase-js cors dotenv express express-rate-limit helmet nodemailer
npm install --save-dev nodemon
```
