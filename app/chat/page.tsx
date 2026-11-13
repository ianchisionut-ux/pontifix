import { redirect } from 'next/navigation'
import { InternalChatManager } from '@/components/internal-chat/internal-chat-manager'
import { InternalChatNotifier } from '@/components/internal-chat/internal-chat-notifier'
import { ChatAppToolbar } from '@/components/internal-chat/chat-app-toolbar'
import { loadInternalChatPageData } from '@/lib/internal-chat-page-data'

export const dynamic = 'force-dynamic'

export default async function ChatPage() {
  const initialData = await loadInternalChatPageData()
  if (!initialData) redirect('/login')
  return <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f3f8fc]"><ChatAppToolbar/><div className="min-h-0 flex-1"><InternalChatManager initialData={initialData} embedded/></div><InternalChatNotifier/></main>
}
