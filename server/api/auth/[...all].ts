import { useAuth } from '@@/server/services/auth'

export default defineEventHandler(event => useAuth().handler(toWebRequest(event)))
