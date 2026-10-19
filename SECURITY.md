# Security and deployment notes

## NightCoder API

NightCoder now calls the Netlify Function at `/.netlify/functions/nightcoder`. The provider credential must never be stored in browser JavaScript.

1. Revoke the previously exposed Groq API key and create a replacement. Treat any key committed to client-side code as compromised, even if the repository is private.
2. In Netlify, open **Site configuration → Environment variables** and add `GROQ_API_KEY` with the replacement key.
3. Trigger a new deploy after setting the variable.
4. Verify the function in the deployed site. Local static previews will not have the Netlify Function unless run with the Netlify CLI.

The function validates the HTTP method, origin, message roles, message count, and payload size. For a public production service, also configure provider spend limits and add persistent rate limiting / abuse monitoring before sharing the endpoint widely.

## Deployment

This is a static frontend and uses Netlify's standard `netlify/functions` directory for the server-side proxy. Do not add provider credentials to `index.html`, `Extras/Code/*.js`, or any other file delivered to visitors.
