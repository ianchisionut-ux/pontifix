export const CONNECTION_STATUSES = ['DOSAR_APROBAT', 'DOCUMENTATIE', 'PROGRAMAT', 'IN_EXECUTIE', 'FINALIZAT', 'SUSPENDAT'] as const

export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number]

export const CONNECTION_STATUS_META: Record<ConnectionStatus, { label: string; progress: number; color: string }> = {
  DOSAR_APROBAT: { label: 'Dosar aprobat', progress: 15, color: '#64748b' },
  DOCUMENTATIE: { label: 'Documentație în lucru', progress: 35, color: '#f59e0b' },
  PROGRAMAT: { label: 'Programat pentru execuție', progress: 55, color: '#8b5cf6' },
  IN_EXECUTIE: { label: 'În execuție', progress: 80, color: '#197fb5' },
  FINALIZAT: { label: 'Finalizat', progress: 100, color: '#22c55e' },
  SUSPENDAT: { label: 'Suspendat', progress: 10, color: '#ef4444' },
}

export function isConnectionStatus(value: unknown): value is ConnectionStatus {
  return typeof value === 'string' && CONNECTION_STATUSES.includes(value as ConnectionStatus)
}
