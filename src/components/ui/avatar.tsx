"useclient"

import* asReact from"react"
import* asAvatarPrimitive from"@radix-ui/react-avatar"

import{ cn} from"@/lib/utils"

functionAvatar({
  className,
  ...props}:React.ComponentProps<typeofAvatarPrimitive.Root>) {
  return(
    <AvatarPrimitive.Rootdata-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className)}
      {...props}
    />
  )
}

functionAvatarImage({
  className,
  ...props}:React.ComponentProps<typeofAvatarPrimitive.Image>) {
  return(
    <AvatarPrimitive.Imagedata-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  )
}

functionAvatarFallback({
  className,
  ...props}:React.ComponentProps<typeofAvatarPrimitive.Fallback>) {
  return(
    <AvatarPrimitive.Fallbackdata-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className)}
      {...props}
    />
  )
}

export{ Avatar, AvatarImage, AvatarFallback}
