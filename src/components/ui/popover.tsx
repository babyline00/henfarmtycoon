"useclient"

import* asReact from"react"
import* asPopoverPrimitive from"@radix-ui/react-popover"

import{ cn} from"@/lib/utils"

functionPopover({
  ...props}:React.ComponentProps<typeofPopoverPrimitive.Root>) {
  return<PopoverPrimitive.Rootdata-slot="popover" {...props} />
}

functionPopoverTrigger({
  ...props}:React.ComponentProps<typeofPopoverPrimitive.Trigger>) {
  return<PopoverPrimitive.Triggerdata-slot="popover-trigger" {...props} />
}

functionPopoverContent({
  className,
  align= "center",
  sideOffset= 4,
  ...props}:React.ComponentProps<typeofPopoverPrimitive.Content>) {
  return(
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Contentdata-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foregrounddata-[state=open]:animate-indata-[state=closed]:animate-outdata-[state=closed]:fade-out-0data-[state=open]:fade-in-0data-[state=closed]:zoom-out-95data-[state=open]:zoom-in-95data-[side=bottom]:slide-in-from-top-2data-[side=left]:slide-in-from-right-2data-[side=right]:slide-in-from-left-2data-[side=top]:slide-in-from-bottom-2 z-50 w-72origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-mdoutline-hidden",
          className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

functionPopoverAnchor({
  ...props}:React.ComponentProps<typeofPopoverPrimitive.Anchor>) {
  return<PopoverPrimitive.Anchordata-slot="popover-anchor" {...props} />
}

export{ Popover, PopoverTrigger, PopoverContent, PopoverAnchor}
