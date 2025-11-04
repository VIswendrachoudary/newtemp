import { cn } from '@/utils/cn'

interface LogoProps {
  className?: string
  variant?: 'full' | 'icon'
}

export function Logo({ className, variant = 'full' }: LogoProps) {
  if (variant === 'icon') {
    return (
      <svg
        className={cn('h-8 w-8', className)}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="2" />
        <path
          d="M8 16C8 12 10 8 16 8C22 8 24 12 24 16C24 20 22 24 16 24C10 24 8 20 8 16Z"
          fill="currentColor"
          opacity="0.2"
        />
        <path
          d="M12 16C12 14 13 12 16 12C19 12 20 14 20 16C20 18 19 20 16 20C13 20 12 18 12 16Z"
          fill="currentColor"
        />
        <circle cx="11" cy="11" r="1.5" fill="currentColor" />
        <circle cx="21" cy="11" r="1.5" fill="currentColor" />
        <circle cx="16" cy="21" r="1.5" fill="currentColor" />
      </svg>
    )
  }

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <svg
        className="h-8 w-8 text-primary-600"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="2" />
        <path
          d="M8 16C8 12 10 8 16 8C22 8 24 12 24 16C24 20 22 24 16 24C10 24 8 20 8 16Z"
          fill="currentColor"
          opacity="0.2"
        />
        <path
          d="M12 16C12 14 13 12 16 12C19 12 20 14 20 16C20 18 19 20 16 20C13 20 12 18 12 16Z"
          fill="currentColor"
        />
        <circle cx="11" cy="11" r="1.5" fill="currentColor" />
        <circle cx="21" cy="11" r="1.5" fill="currentColor" />
        <circle cx="16" cy="21" r="1.5" fill="currentColor" />
      </svg>
      <span className="text-xl font-bold text-gray-900">eDNA</span>
      <span className="text-xl font-light text-gray-600">Platform</span>
    </div>
  )
}