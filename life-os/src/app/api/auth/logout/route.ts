import { destroySession } from '@/lib/auth'
import { handle, ok } from '@/lib/api'

export async function POST(): Promise<Response> {
  return handle('auth/logout', async () => {
    await destroySession()
    return ok({ loggedOut: true })
  })
}
