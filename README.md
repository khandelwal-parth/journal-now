# 📔 journal-now.

> a quiet space to write freely — one day at a time.

A full stack personal journal with real accounts, real database, and real privacy. Your entries are yours — tied to your account, stored securely, accessible from any device, anywhere.

Live at → **[journal-now.vercel.app](https://journal-now.vercel.app)**

---

## ✨ features

- **signup & login** — your own private account, nobody else can see your stuff
- **write for today** — one click and you're writing
- **multiple entries per day** — thoughts don't follow a schedule
- **rich text editor** — bold, italic, headings, quotes, lists, colors, font sizes
- **images** — paste from clipboard, drag & drop, or upload
- **calendar view** — browse your entries by month, see which days you wrote
- **search** — instantly find anything you've written
- **auto-save** — toggle it on and forget about it
- **export** — download any entry as a `.txt` file
- **100% private** — entries are tied to your account via user ID, nobody else can read them

---

## 🛠️ built with

| Tech | Purpose |
|---|---|
| **Next.js 14** | Frontend + API routes |
| **PostgreSQL (Neon)** | Database |
| **bcryptjs** | Password hashing |
| **JWT + httpOnly cookies** | Authentication |
| **Vercel** | Deployment |

---

## 🔒 how auth works

1. **Signup** — password is hashed with bcrypt (never stored plain text) and saved to Postgres
2. **Login** — password is compared against the hash, if valid a JWT token is created
3. **JWT** — stored in an httpOnly cookie (JS can't read it, only the server can)
4. **Every request** — server reads the cookie, verifies the token, identifies the user
5. **Every DB query** — filtered by `user_id` so you only ever see your own data

---

## 🚀 run it locally

```bash
git clone https://github.com/khandelwal-parth/journal-now.git
cd journal-now
npm install
```

Create a `.env.local` file:
```
DATABASE_URL=your_neon_postgres_url
JWT_SECRET=any_long_random_string
```

Then:
```bash
npm run dev
```

Open `http://localhost:3000`, sign up, and start writing.

---

## 📁 project structure

```
journal-now/
├── app/
│   ├── page.js              # main journal UI
│   ├── layout.js            # root layout
│   ├── login/page.js        # login page
│   ├── signup/page.js       # signup page
│   └── api/
│       ├── entries/         # GET, POST, DELETE entries
│       └── auth/
│           ├── login/       # POST — login
│           ├── signup/      # POST — create account
│           ├── logout/      # POST — clear cookie
│           └── me/          # GET — current user
├── lib/
│   ├── db.js                # Neon postgres connection
│   └── auth.js              # JWT helpers
└── .env.local               # secrets (not in repo)
```

---

## ⌨️ shortcuts

| shortcut | action |
|---|---|
| `Ctrl + S` | save entry |
| `Ctrl + B` | bold |
| `Ctrl + I` | italic |
| `Ctrl + U` | underline |

---

## 🧠 what i learned building this

- Full stack Next.js with API routes
- PostgreSQL schema design and SQL queries
- Password hashing with bcrypt
- JWT authentication with httpOnly cookies
- Optimistic UI updates for a smooth feel
- Deploying to Vercel with environment variables
- Debugging hydration errors, middleware issues, and cold starts
- Why you should never use the latest framework version in production 😭

---

*MIT license — do whatever you want with it.*
