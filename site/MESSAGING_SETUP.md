# Messaging setup for CEASER AI

## Important distinction

SMTP is for sending email. An SMTP app password cannot send SMS messages directly. The current CEASER AI frontend calls email-verification endpoints (`/api/auth/verify-email` and `/api/auth/resend-verification`), so an SMTP provider is appropriate if OTP codes are delivered to email.

## Gmail SMTP app password

For a Gmail or Google Workspace mailbox, turn on 2-Step Verification for the sending account first. Then open the [Google Account App passwords page](https://myaccount.google.com/apppasswords), choose **App passwords**, create a new password for a mail app/device (for example, `CEASER AI SMTP`), and copy the generated 16-character password once. Use that generated password as the SMTP password, not the normal Google account password. Google says the option may be unavailable when the account is restricted to security keys, uses Advanced Protection, or belongs to a work/school organization with a policy restriction. See [Google’s official app-password guidance](https://support.google.com/accounts/answer/185833?hl=en).

Typical SMTP settings are `smtp.gmail.com`, port `587` with STARTTLS, the full Gmail address as the username, and the generated app password as the password. Keep these values server-side in environment variables or project secrets; never place them in `app.js` or other browser-delivered files.

## SMS OTP

For phone-number OTP, use an SMS provider such as Twilio, Vonage, MessageBird, or another provider available in your region. Twilio’s [Verify SMS documentation](https://www.twilio.com/docs/verify/sms) shows the separate flow: start an SMS verification for a phone number, then call the verification-check endpoint when the user enters the code. Store that provider's account ID, sender number or messaging service, and API token as server-side secrets. Add a backend SMS-send endpoint and change the verification record to track a phone destination. Do not put SMS provider credentials in the frontend.
