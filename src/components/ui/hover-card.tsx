"useclient"

import* asReact from"react"
import* asHoverCardPrimitive from"@radix-ui/react-hover-card"

import{ cn} from"@/lib/utils"

functionHoverCard({
  ...props}:React.ComponentProps<typeofHoverCardPrimitive.Root>) {
  return<HoverCardPrimitive.Rootdata-slot="hover-card" {...props} />
}

functionHoverCardTrigger({
  ...props}:React.ComponentProps<typeofHoverCardPrimitive.Trigger>) {
  return(
    <HoverCardPrimitive.Triggerdata-slot="hover-card-trigger" {...props} />
  )
}

functionHoverCardContent({
  className,
  align= "center",
  sideOffset= 4,
  ...props}:React.ComponentProps<typeofHoverCardPrimitive.Content>) {
  return(
    <HoverCardPrimitive.Portaldata-slot="hover-card-portal">
      <HoverCardPrimitive.Contentdata-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foregrounddata-[state=open]:animate-indata-[state=closed]:animate-outdata-[state=closed]:fade-out-0data-[state=open]:fade-in-0data-[state=closed]:zoom-out-95data-[state=open]:zoom-in-95data-[side=bottom]:slide-in-from-top-2data-[side=left]:slide-in-from-right-2data-[side=right]:slide-in-from-left-2data-[side=top]:slide-in-from-bottom-2 z-50 w-64origin-(--radix-hover-card-content-transform-origin) rounded-md border p-4 shadow-mdoutline-hidden",
          className)}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  )
}

export{ HoverCard, HoverCardTrigger, HoverCardContent}
