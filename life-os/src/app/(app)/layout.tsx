import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { BottomNav, MobileMenu, Sidebar } from '@/components/nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const pendingApprovals = await prisma.approvalRequest.count({
    where: { userId: user.id, status: 'pending' },
  })

  return (
    <div className="flex min-h-dvh">
      <Sidebar userName={user.name} pendingApprovals={pendingApprovals} />
      <div className="min-w-0 flex-1 pb-20 lg:pb-0">
        <main className="mx-auto w-full max-w-5xl px-4 py-6 lg:px-8 lg:py-10">
          <MobileMenu />
          {children}
        </main>
      </div>
      <BottomNav pendingApprovals={pendingApprovals} />
    </div>
  )
}
