# Testing results

**Last full pass:** July 2026  
**Testers:** Automated agent (Jul 2) + manual end-to-end (Jul 4) as **customer** and **admin (emma)**. IT role not tested separately — same staff permissions as admin except portfolio/services.

**Verdict:** Core flows work on web and mobile (sign-up → book → appointments → support). Open issues are in [bugs-and-improvements.md](bugs-and-improvements.md).

Demo password: `Demo1234!`

---

## Summary by area

| Area | Web | Mobile | Notes |
|------|-----|--------|-------|
| Sign up + 2FA | PASS | PASS | Email path |
| Login / logout | PASS | PASS | TOTP on demo1 verified |
| Complete profile | PARTIAL | PASS | Web: skip photo; DOB use MM/DD/YYYY (BUG-002, BUG-004) |
| Settings / profile edit | PARTIAL | PASS | Web photo upload fails (BUG-004) |
| Book appointment | PASS | PASS | Guest book on mobile |
| View / manage appointments | PARTIAL | PASS | Web edit inspo crashes (BUG-006) |
| Staff workflow (emma) | PASS | PASS | Confirm, queue, portfolio, services |
| Support tickets (text) | PASS | PASS | Web: no photo attachments (BUG-008) |
| Rewards & portfolio | PASS | PASS | |
| Public pages | PASS | — | Home, portfolio, policies |
| POS | — | NOT TESTED | Not finished — see planned work |
| Build (`website`) | PASS | — | Agent verified |

---

## Detailed results

### Smoke & auth

| Test | Result | Notes |
|------|--------|-------|
| API health ping | PASS | |
| Web/mobile login | PASS | |
| Sign up (email) | PASS | Both clients |
| Complete profile | PARTIAL | BUG-002 DOB; BUG-004 web photo |
| 2FA TOTP re-login | PASS | demo1 |
| Settings password lock | FAIL | BUG-007 |
| Profile photo upload | FAIL (web) / PASS (mobile) | BUG-004 |
| Forgot password | NOT TESTED | OTP in backend console |

### Booking & appointments

| Test | Result | Notes |
|------|--------|-------|
| View services & availability | PASS | |
| Book appointment | PASS | |
| Guest book (no account) | PASS (mobile) | Web guest flow incomplete (IMP-003) |
| Customer inspo — device photos | FAIL | BUG-005 (staff OK) |
| Edit inspo on existing appt | FAIL (web) | BUG-006 |
| Staff confirm / status flow | PASS | emma |
| Cancel / reschedule / promo | NOT TESTED | |
| POS payment | NOT TESTED | |

### Support

| Test | Result | Notes |
|------|--------|-------|
| View tickets | PASS | |
| Create ticket | PASS | Web: text only, no images |
| Reply (customer) | PASS | Web: no attachments (BUG-008) |
| Staff reply | PASS | emma |
| IT queue | NOT TESTED | Assumed same as admin for support |

### Staff admin (emma)

| Test | Result | Notes |
|------|--------|-------|
| Appointments queue | PASS | |
| Portfolio / services pages | PASS | |
| Newsletters & promos pages | PASS | CRUD not fully exercised |
| Rewards admin | PASS | |
| Support queue | PASS | |

### Not tested this pass

Phone sign-up · forgot password · account delete/export · cancel/reschedule · promo at checkout · POS/Square · cross-client sync verification · IT-specific portfolio restriction

---

## Workarounds used during QA

- Complete profile on web: DOB as `01/15/1990`; do not select profile photo
- Booking inspo (customers): portfolio picker only

---

## Bug reference

| ID | Summary | Status |
|----|---------|--------|
| BUG-001 | Portfolio gallery init race | Fixed |
| BUG-002 | DOB YYYY-MM-DD misparsed | Open |
| BUG-003 | Support create auth race | Open |
| BUG-004 | Web profile photo upload 500 | Open |
| BUG-005 | Customer/guest no device inspo | Open |
| BUG-006 | Web edit inspo modal loop | Open |
| BUG-007 | Settings unlock bypasses password | Open |
| BUG-008 | Web support no attachments | Open |

Full details: [bugs-and-improvements.md](bugs-and-improvements.md)
