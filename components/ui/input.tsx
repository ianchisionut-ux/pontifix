import { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input-field w-full ${props.className ?? ''}`} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input-field w-full ${props.className ?? ''}`} />
}

const STATUS_STYLES: Record<string, string> = {
  success: 'bg-green-50 text-green-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  neutral: 'bg-gray-100 text-gray-600',
  accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: keyof typeof STATUS_STYLES
}) {
  return (
    <span className={`pill inline-flex items-center px-3 py-1 text-xs font-medium ${STATUS_STYLES[tone]}`}>
      {children}
    </span>
  )
}
