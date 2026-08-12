import { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base = variant === 'primary' ? 'btn-primary' : 'btn-secondary'
  return <button className={`${base} ${className}`} {...props} />
}
