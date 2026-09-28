"useclient"

import* asReact from"react"
import* asTooltipPrimitive from"@radix-ui/react-tooltip"

import{ cn} from"@/lib/utils"

functionTooltipProvider({
  delayDuration= 0,
  ...props}:React.ComponentProps<typeofTooltipPrimitive.Provider>) {
  return(
    <TooltipPrimitive.Providerdata-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

functionTooltip({
  ...props}:React.ComponentProps<typeofTooltipPrimitive.Root>) {
  return(
    <TooltipProvider>
      <TooltipPrimitive.Rootdata-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

functionTooltipTrigger({
  ...props}:React.ComponentProps<typeofTooltipPrimitive.Trigger>) {
  return<TooltipPrimitive.Triggerdata-slot="tooltip-trigger" {...props} />
}

functionTooltipContent({
  className,
  sideOffset= 0,
  children,
  ...props}:React.ComponentProps<typeofTooltipPrimitive.Content>) {
  return(
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Contentdata-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95data-[state=closed]:animate-outdata-[state=closed]:fade-out-0data-[state=closed]:zoom-out-95data-[side=bottom]:slide-in-from-top-2data-[side=left]:slide-in-from-right-2data-[side=right]:slide-in-from-left-2data-[side=top]:slide-in-from-bottom-2 z-50 w-fitorigin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xstext-balance",
          className)}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="bg-primary fill-primary z-50 size-2.5translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export{ Tooltip, TooltipTrigger, TooltipContent, TooltipProvider}
