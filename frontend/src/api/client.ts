import createClient from 'openapi-fetch'

import type { paths } from './schema'

// Typed HTTP client for the backend. `paths` is generated from the backend's
// OpenAPI spec (`npm run gen:api`), so TypeScript catches URL, parameter and
// response mismatches. The base URL is empty because Vite forwards /api to the
// backend (see vite.config.ts).
export const client = createClient<paths>({ baseUrl: '' })

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, detail: unknown) {
    super(typeof detail === 'string' ? detail : `Request failed with status ${status}`)
    this.status = status
  }
}
