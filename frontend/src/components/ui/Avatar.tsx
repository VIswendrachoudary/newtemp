import { forwardRef } from 'react'
import { cn } from '@/utils/cn'
import { HTMLAttributes } from 'react'

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  fallback?: string
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
          className
        )}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            className="aspect-square h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-gray-100 text-gray-600 text-sm font-medium">
            {fallback || children}
          </div>
        )}
      </div>
    )
  }
)

Avatar.displayName = 'Avatar'

export const AvatarImage = forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(
  ({ className, ...props }, ref) => (
    <img
      ref={ref}
      className={cn('aspect-square h-full w-full object-cover', className)}
      {...props}
    />
  )
)

AvatarImage.displayName = 'AvatarImage'

export const AvatarFallback = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-gray-100 text-gray-600 text-sm font-medium',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)

AvatarFallback.displayName = 'AvatarFallback'