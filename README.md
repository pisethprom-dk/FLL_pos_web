<!-- v1.0.0 -->

# POS frontend

Angular 22 back office for the POS backend in `../pos_backend`.

## Running it

```bash
nvm use            # Node 22, from .nvmrc
npm install
npm start          # http://localhost:4200
```

Start the backend first (`docker compose up -d` in `../pos_backend`).
`npm start` proxies `/api` and `/media` to it, so the app and the API share one
origin and the login cookie works.

## The API client

`src/app/api/` is generated from the backend's OpenAPI schema. Do not edit it.
With the backend running:

```bash
npm run api
```

Then build: if the backend changed shape, the compiler shows where.

## Checks

```bash
npm test -- --watch=false
npm run build
```
