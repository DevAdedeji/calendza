import { useEnv } from '@@/server/config/env'

export default defineEventHandler((event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  return { mode: useEnv().billingMode }
})
