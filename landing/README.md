# Luna Landing

Standalone marketing + legal + auth entry landing site.

Pages:

- `/` marketing landing
- `/terms.html` terms of use
- `/privacy.html` privacy notice
- `/cookies.html` cookie policy

## Environment

Copy `.env.example` to `.env` and set:

`VITE_FRONTEND_APP_URL` - base URL of the frontend app (used for Sign in/Register links).

Example:

```
VITE_FRONTEND_APP_URL=https://app.lunabms.com
```

## Run

```
npm install
npm run dev
```

## Build

```
npm run build
```
