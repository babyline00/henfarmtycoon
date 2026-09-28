"useclient"

import* asReact from"react"
import* asScrollAreaPrimitive from"@radix-ui/react-scroll-area"

import{ cn} from"@/lib/utils"

functionScrollArea({
  className,
  children,
  ...props}:React.ComponentProps<typeofScrollAreaPrimitive.Root>) {
  return(
    <ScrollAreaPrimitive.Rootdata-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewportdata-slot="scroll-area-viewport"
        className="focus-visible:ring-ring/50 size-full rounded-[inherit]transition-[color,box-shadow] outline-none focus-visible:ring-[3px]focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar/>
      <ScrollAreaPrimitive.Corner/>
    </ScrollAreaPrimitive.Root>
  )
}

functionScrollBar({
  className,
  orientation= "vertical",
  ...props}:React.ComponentProps<typeofScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return(
    <ScrollAreaPrimitive.ScrollAreaScrollbardata-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none",
        orientation=== "vertical" &&
          "h-full w-2.5 border-lborder-l-transparent",
        orientation=== "horizontal" &&
          "h-2.5 flex-col border-tborder-t-transparent",
        className)}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumbdata-slot="scroll-area-thumb"
        className="bg-border relative flex-1 rounded-full"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export{ ScrollArea, ScrollBar}
