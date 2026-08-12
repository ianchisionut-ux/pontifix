import { HTMLAttributes } from 'react'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card p-5 ${className}`} {...props} />
}

export function CardInteractive({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card card-interactive p-5 ${className}`} {...props} />
}
