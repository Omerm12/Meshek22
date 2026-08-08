# Administrator portal — one-time setup

The customer-facing site is fully anonymous: guests browse, add to cart and check
out with no account. Supabase Auth is now used **only** for the private
administrator portal.

- Login: `/meshek22-control/login`
- Dashboard: `/meshek22-control`

> The unusual path is an obscurity layer, nothing more. This repository is
> public, so the path is public too. Real protection is server-side:
> `requireAdmin()` guards the protected layout, every mutation Server Action
> re-checks authorisation independently, RLS guards the tables, and the
> privileged RPCs are granted to `service_role` only.

---

## 1. Create the administrator account in Supabase

Do this once, in the Supabase dashboard of the target project.

1. **Authentication → Users → Add user**
   - Email: the address you will map to the username, e.g. `owner@meshek22.co.il`
   - Password: choose a strong password
   - Tick **Auto Confirm User** so no confirmation email is required

2. Copy the new user's UUID from the users table.

3. **SQL Editor** — grant the admin role. Replace the UUID and email:

   ```sql
   -- The profile row is normally created by a signup trigger. This upsert works
   -- whether or not it already exists.
   insert into public.profiles (id, email, full_name, role)
   values ('00000000-0000-0000-0000-000000000000', 'owner@meshek22.co.il', 'מנהל משק 22', 'admin')
   on conflict (id) do update
     set role = 'admin',
         email = excluded.email;
   ```

4. Verify:

   ```sql
   select id, email, role from public.profiles where role = 'admin';
   ```

The password is created, stored and hashed **by Supabase Auth**. It must never be
written into source code, an environment file, the `profiles` table, or any
custom table.

---

## 2. Set the server-only environment variables

Add these to `.env.local` locally, and to the hosting provider's environment
settings in production. None of them may be prefixed `NEXT_PUBLIC_`.

| Variable | Purpose |
| --- | --- |
| `ADMIN_LOGIN_USERNAME` | The username typed into the login form, e.g. `meshek22` |
| `ADMIN_AUTH_EMAIL` | The Supabase Auth email created in step 1 |
| `ADMIN_RATE_LIMIT_SALT` | Any long random string; salts the hashed IPs/usernames in the rate-limit table |

The form asks for **שם משתמש** and **סיסמה**. The server maps the username to
`ADMIN_AUTH_EMAIL` and hands the password to Supabase. The mapping never reaches
the browser.

Generate a salt with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. What the login does

1. Checks the rate limit for this IP **and** this submitted username.
2. Maps username → auth email (an unknown username still performs a real
   password check against a non-existent address, so timing does not differ).
3. Authenticates with Supabase.
4. Reads `profiles.role` for the returned user.
5. If the role is not `admin`, signs the session straight back out.
6. Redirects to `/meshek22-control` **server-side**.

Every failure — unknown username, wrong password, non-admin account — returns the
same Hebrew message: **שם המשתמש או הסיסמה שגויים**. Nothing distinguishes them,
so the form cannot be used to discover which usernames exist.

---

## 4. Rate limiting

Failed attempts are recorded in `admin_login_attempts`:

- 5 failures per identity within a 15-minute window triggers a lockout
- Two independent counters: client IP and submitted username
- Only a **salted SHA-256** of each identity is stored — never a raw IP,
  username or password
- A successful login clears that identity's failures
- Rows older than a day are pruned opportunistically by
  `prune_admin_login_attempts()`
- RLS is enabled with no policies, so only `service_role` can read or write it

If the database is unreachable the limiter fails **open** — a logging outage must
not lock the shop owner out of their own panel, and every other authentication
check still applies.

---

## 5. Logging out

The sidebar's **יציאה** button posts to a Server Action that calls
`supabase.auth.signOut()` and redirects. The session cookie is cleared on the
server; the app never relies on a client-side redirect for this.

---

## 6. The old `/admin` path

`/admin` now returns a plain 404. It does not redirect anywhere revealing, and no
administrator link appears anywhere on the public site.

If you ever need to move the portal again, change `ADMIN_BASE_PATH` in
`src/lib/admin/routes.ts` and rename the `src/app/meshek22-control` directory —
every internal link, redirect and revalidation path derives from that one
constant.
