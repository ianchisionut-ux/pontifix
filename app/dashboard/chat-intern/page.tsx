import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function InternalChatPage() {
  redirect('https://chat.elmont.ro/chat')
}
