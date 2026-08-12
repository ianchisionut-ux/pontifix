import { Card, CardInteractive } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'
import ChannelToggle from '@/components/channel-toggle'

const LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp Business',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook Messenger',
  GOOGLE_BUSINESS: 'Google Business Profile',
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success',
  EXPIRING_SOON: 'warning',
  EXPIRED: 'danger',
  DISCONNECTED: 'neutral',
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activ',
  EXPIRING_SOON: 'Expiră curând',
  EXPIRED: 'Expirat',
  DISCONNECTED: 'Deconectat',
}

type Channel = { id: string; type: string; status: string; enabledByOwner: boolean }

export default function ChannelsSection({ channels }: { channels: Channel[] }) {
  const allTypes = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'GOOGLE_BUSINESS'] as const

  return (
    <Card>
      <h2 className="font-medium mb-1">Canale</h2>
      <p className="text-sm text-gray-500 mb-4">
        Poți opri temporar un canal fără să pierzi conexiunea. Conectarea și cheile de acces sunt
        administrate de echipa Pontifix.
      </p>

      <div className="flex flex-col gap-2">
        {allTypes.map((type) => {
          const channel = channels.find((c) => c.type === type)
          return (
            <CardInteractive key={type} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-sm">{LABELS[type]}</p>
                <div className="mt-1">
                  <Pill tone={channel ? STATUS_TONE[channel.status] : 'neutral'}>
                    {channel ? STATUS_LABEL[channel.status] : 'Neconectat de admin'}
                  </Pill>
                </div>
              </div>
              {channel ? (
                <ChannelToggle channelId={channel.id} enabled={channel.enabledByOwner} />
              ) : (
                <span className="text-xs text-gray-400">—</span>
              )}
            </CardInteractive>
          )
        })}
      </div>
    </Card>
  )
}
