---
title: Privacy Policy
version: 1.1
effective: 2026-10-11
---
Speech Arena helps you practise speaking by comparing how you deliver a passage with a reference recording. This policy explains what we collect to do that, why, how long we keep it, and what you can do about it. Speech Arena is a hackathon prototype run by the Speech Arena project team, who decide how your data is used.

## Summary

- We collect only what we need to run your account and keep it secure.
- Your recordings are analysed in memory and are never stored.
- There are no ads, no analytics, no tracking cookies, and no third parties that receive your data.
- You can download or delete your data at any time in **Settings**.

## What we collect

| Data | Why | How long |
| --- | --- | --- |
| Email address and display name | To create your account and let you sign in | Until you delete your account |
| Password | To verify it's you. Stored only as a salted scrypt hash; we can't read it | Until you change it or delete your account |
| Sign-in sessions: IP address, browser name, times | To keep you signed in, and so you can see and end sessions on other devices | Deleted as soon as the session ends: when you sign out, after 24 hours without activity, or after 7 days at most |
| Security events: sign-ins, failed attempts, lockouts, password changes, with IP address | To detect and stop attacks on your account | 90 days |
| Agreement records: which version of these terms you accepted, and your storage choices | To show what you agreed to | Until you delete your account |
| Recordings you upload or record | To measure your pacing, pauses, pitch and energy | Not stored. Processed in memory, then discarded |
| Analysis results (scores, flaws, word timings) | To show you your results | 60 minutes in server memory |
| Leaderboard scores, only if you join: your best score on each reference passage | To rank you against others who joined | Until you leave the leaderboard or delete your account |

We don't ask for your date of birth, phone number, location, or anything else not listed here.

Account, agreement and security records are kept in a MongoDB database. Sign-in sessions and leaderboard scores are kept in a Redis database; leaderboard entries are linked to a random account number rather than your name or email. Both run on the Speech Arena server.

## Leaderboards

Leaderboards are off until you turn them on in **Settings** or on the Leaderboard page. When you join, people who are signed in can see your display name and your best score on each reference passage. Only scores from the listed reference passages count; passages you type in yourself are never ranked. When you leave, your name disappears at once and your stored scores are deleted.

## What we don't do

- We don't identify who is speaking from their voice, and we don't infer emotions, personality or health.
- We don't use your recordings to train models.
- We don't sell or share your data, and we don't show advertising.
- We don't use analytics, tracking pixels or third-party cookies.

## Why we're allowed to use it

- **To provide the service you asked for:** your account, sign-in and analyses.
- **Legitimate interest in security:** session records and security events protect your account and the service.
- **Your consent:** saving preferences and analysis history in your browser, and showing your scores on leaderboards. You can withdraw it at any time.

## Who else sees it

Nobody outside the project team. The server downloads speech-model files from Hugging Face the first time they're needed; none of your data is sent with that download. Fonts and all other page files are served by Speech Arena itself. Links to outside websites (for example, the sources of reference recordings) only open when you click them. Administrators can see account details and security events to keep the service running, but they can't see your recordings or results.

## Your browser

With your permission, the app saves your preferences and analysis history in your own browser, separately for each account. See the [Cookie Policy](/cookies) for the full list and how to change your choice.

## Your rights

- **See and download your data:** Settings → Privacy → Download my data.
- **Correct it:** change your display name in Settings. To change your email, contact us.
- **Delete it:** Settings → Privacy → Delete account. This removes your account, sessions, agreement records and leaderboard scores straight away. Security events about your account stay for up to 90 days but no longer name you or show your IP address.
- **Withdraw consent:** change your storage choice in Cookie settings, or leave the leaderboard, at any time.
- **Complain:** you can contact your data protection authority. In India, that's the Data Protection Board of India; in the EU, your national supervisory authority.

These rights reflect India's Digital Personal Data Protection Act, 2023 and the EU General Data Protection Regulation.

## How we protect it

Passwords are hashed with scrypt. Sessions use a random token in a cookie that page scripts can't read, and only a hash of it is stored. Every change request needs a per-session security token. Accounts lock after repeated wrong passwords, and sign-ins are rate-limited.

## Age

You must be at least 16 to use Speech Arena.

## Changes

When this policy changes, we update its version number and ask you to review and accept it before you continue.

## Contact

Contact the Speech Arena project team through the project's [issue tracker](https://github.com/Anwesha-Mondal/ml-speech/issues). Don't post personal details there; ask for a private contact and we'll reply.
