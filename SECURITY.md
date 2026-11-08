# Security Policy

OpenQnt can hold broker credentials and place real orders, so we take security
reports seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Instead, either:

- use GitHub's [private vulnerability reporting](https://github.com/sinatooor/openqnt/security/advisories/new), or
- email **hello@sinalytica.com** with "SECURITY" in the subject line.

Include what you found, how to reproduce it and what an attacker could do with
it. We aim to acknowledge reports within 3 business days and will keep you
updated until the issue is fixed. We are happy to credit you once a fix ships.

## Supported versions

Only the latest release and the `main` branch receive security fixes.

## Running OpenQnt safely

- Keep `.env` out of version control and use paper trading until you trust a
  strategy.
- Set a strong `JWT_SECRET` before exposing the backend beyond `localhost`.
- The agent code sandbox is a guard rail, not a hard security boundary. Do
  not run untrusted strategies against a live brokerage account.
