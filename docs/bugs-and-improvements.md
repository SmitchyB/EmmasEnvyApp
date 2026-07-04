# Bugs and improvements

Open issues and planned work from QA (Jul 2026). Test coverage: [testing-results.md](testing-results.md).

---

## Open bugs

| ID | Severity | Client | Summary |
|----|----------|--------|---------|
| BUG-002 | High | Both | DOB `YYYY-MM-DD` misparsed → 500. **Workaround:** `01/15/1990` |
| BUG-003 | Low | Web | `/support/create` shows sign-in until auth hydrates |
| BUG-004 | High | Web | Profile photo upload → Internal server error (`/complete-profile`, `/settings`). Likely Multer 2MB limit / unhandled errors |
| BUG-005 | Medium | Both | Customers/guests can't upload device inspo when booking (staff can) |
| BUG-006 | High | Web | Edit appointment inspo → infinite re-render in `PortfolioPickerModal` |
| BUG-007 | High | Both | Settings email/phone/password: unlock doesn't verify password (web unlocks with empty field) |
| BUG-008 | Medium | Web | Support tickets: no photo upload on create or reply (mobile has it) |

**Fixed:** BUG-001 — portfolio gallery `initSharedConfig` race (2026-07-02)

### BUG-002 — DOB format
`normalizeDob()` in `backend/routes/auth.js` treats 8 digits as MMDDYYYY; ISO dates like `1990-01-15` become invalid DB dates.

### BUG-004 — Web profile photo
Fails at `packages/shared/src/api/auth.ts` → `POST /api/auth/profile-photo`. Skip photo on web until fixed.

### BUG-006 — PortfolioPickerModal
Default `initialSelected = []` creates new array each render; `useEffect` deps cause loop when editing inspo on `/appointments`.

### BUG-007 — Settings unlock
Password should be verified on **Unlock**, not only on Save. Web must clear password fields after successful save.

---

## Improvements (before launch)

| ID | Area | Summary |
|----|------|---------|
| IMP-001 | Web | Hydration warning on `/book` in dev |
| IMP-003 | Web | Guest booking without sign-up (parity with mobile) |
| IMP-004 | Both | Enable customer device inspo uploads (or fix copy) |
| IMP-005 | Web | Remove Shipping & Fulfillment policy page |

---

## Planned features (not started)

| ID | Area | Summary |
|----|------|---------|
| IMP-006 | Admin | **Financial manager** — dashboard for admin to view incoming revenue, payments, and financial summaries |
| IMP-007 | Customer | **Invoice history** — dedicated view of paid invoices (appointments already show payment status; evaluate if separate page is needed) |
| IMP-008 | Platform | Finish **mobile POS** (preview, cash, Square) |
| IMP-009 | Platform | Production **email** and **SMS** (OTP, password reset, transactional) |
| IMP-010 | Mobile | **Push notifications** (appointments, support, marketing) |
| IMP-011 | Account | **Newsletter / marketing opt-in** settings |

---

## What works

Sign-up, 2FA, login, booking, appointment lists, staff queue (emma), portfolio, services, rewards, support (text), public site, mobile POS path exists (not fully QA'd). Tested manually as customer and admin across web + mobile.
