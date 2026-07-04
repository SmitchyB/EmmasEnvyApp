# API overview

Lightweight reference for the Express API mounted at `/api`. All routes return JSON unless noted.

Base URL (local): `http://localhost:5000`

Authentication: `Authorization: Bearer <token>` for protected routes.

---

## Auth — `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/ping` | — | Health check |
| POST | `/register` | — | Create account |
| POST | `/login` | — | Login (may require 2FA) |
| POST | `/verify-2fa` | — | Complete 2FA challenge |
| POST | `/forgot-password` | — | Request reset code (logged to console in dev) |
| POST | `/verify-forgot-code` | — | Verify reset code |
| POST | `/complete-forgot-password` | — | Set new password |
| POST | `/logout` | User | End session |
| GET | `/me` | User | Current user profile |
| PATCH | `/me` | User | Update profile fields |
| PATCH | `/me/2fa` | User | Enable/disable 2FA |
| POST | `/profile-photo` | User | Upload profile photo (multipart) |
| PATCH | `/account` | User | Update account credentials |
| POST | `/complete-profile` | User / temp 2FA | Finish signup profile |
| GET | `/sessions` | User | List active sessions |
| DELETE | `/sessions/:id` | User | Revoke session |
| PATCH | `/sessions/:id/untrust` | User | Untrust device |

---

## Appointments — `/api/appointments`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/availability` | Optional | Available time slots |
| GET | `/` | User | List appointments |
| GET | `/:id` | User | Appointment detail |
| POST | `/` | Optional | Create appointment |
| PATCH | `/:id` | User | Update status, reschedule, etc. |
| POST | `/:id/cancel` | User | Cancel appointment |
| POST | `/:id/finished-photo` | User | Upload completed-visit photo |

---

## Service types — `/api/service-types`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/public` | — | Public service list |
| GET | `/` | User | Staff service list |
| POST | `/` | User | Create service |
| PUT | `/:id` | User | Update service |
| DELETE | `/:id` | User | Delete service |

---

## Portfolios — `/api/portfolios`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/primary` | — | Public primary portfolio |
| GET | `/me` | Staff | Own portfolio |
| POST | `/me` | Staff | Create/update own portfolio |
| POST | `/me/photos` | Staff | Upload photo (multipart) |
| PATCH | `/me/photos/:photoId` | Staff | Update photo metadata |
| DELETE | `/me/photos/:photoId` | Staff | Delete photo |
| PATCH | `/:id` | Admin | Update portfolio by id |
| POST | `/:id/photos` | Admin | Upload to portfolio |
| PATCH | `/:id/photos/:photoId` | Admin | Update photo |
| DELETE | `/:id/photos/:photoId` | Admin | Delete photo |

---

## POS — `/api/pos`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/preview` | User | Preview checkout totals |
| POST | `/complete-card` | User | Complete card payment (Square) |
| POST | `/charge-card-api` | User | Charge card via API |
| POST | `/record-payment` | User | Record cash or manual payment |

---

## Invoices — `/api/invoices`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/rewards` | User | Reward-related invoice data |
| GET | `/` | User | List invoices |
| GET | `/:id` | User | Invoice detail |

---

## Support tickets — `/api/support-tickets`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/issue-types` | — | Issue type options |
| GET | `/staff` | Staff | Staff queue |
| GET | `/` | User | My tickets |
| POST | `/` | User | Create ticket |
| GET | `/:id` | User | Ticket detail |
| PATCH | `/:id` | Staff | Update ticket (assign, status) |
| POST | `/:id/close` | User | Close ticket |
| POST | `/:id/messages` | User | Post message (+ attachments) |

---

## Reward offerings — `/api/reward-offerings`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/customer-eligible` | User | Offers customer can redeem |
| GET | `/available` | — | Public available offers |
| GET | `/` | Staff | Admin list |
| POST | `/` | Staff | Create offering |
| PATCH | `/:id` | Staff | Update offering |
| DELETE | `/:id` | Staff | Delete offering |

---

## Promo codes — `/api/promo-codes`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Staff | List promos |
| GET | `/validate` | User | Validate code |
| POST | `/` | Staff | Create promo |
| PATCH | `/:id` | Staff | Update promo |
| DELETE | `/:id` | Staff | Delete promo |

---

## Newsletters — `/api/newsletters`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Staff | List newsletters |
| POST | `/` | Staff | Create draft |
| PATCH | `/:id` | Staff | Update draft |
| POST | `/:id/send` | Staff | Mark sent |
| DELETE | `/:id` | Staff | Delete draft |

---

## Site settings — `/api/site-settings`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | — | Public site settings |
| PATCH | `/` | Admin | Update settings |
| POST | `/home-hero` | Admin | Upload home hero image |

---

## Data privacy — `/api/data-privacy`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/request-data-export` | User | Request data export |
| POST | `/delete-account` | User | Delete account |

---

## Static uploads

Uploaded files are served from `backend/uploads/` (profile photos, portfolio, appointments, support).

Client apps resolve URLs via `uploadsUrl()` from `@emmasenvy/shared`.

---

## Shared client

TypeScript API functions live in `packages/shared/src/api/`. Both `website` and `mobile_app` import from `@emmasenvy/shared` instead of duplicating fetch logic.
