"useclient"

import* asReact from"react"
import* asSheetPrimitive from"@radix-ui/react-dialog"
import{ XIcon} from"lucide-react"

import{ cn} from"@/lib/utils"

functionSheet({ ...props}:React.ComponentProps<typeofSheetPrimitive.Root>) {
  return<SheetPrimitive.Rootdata-slot="sheet" {...props} />
}

functionSheetTrigger({
  ...props}:React.ComponentProps<typeofSheetPrimitive.Trigger>) {
  return<SheetPrimitive.Triggerdata-slot="sheet-trigger" {...props} />
}

functionSheetClose({
  ...props}:React.ComponentProps<typeofSheetPrimitive.Close>) {
  return<SheetPrimitive.Closedata-slot="sheet-close" {...props} />
}

functionSheetPortal({
  ...props}:React.ComponentProps<typeofSheetPrimitive.Portal>) {
  return<SheetPrimitive.Portaldata-slot="sheet-portal" {...props} />
}

functionSheetOverlay({
  className,
  ...props}:React.ComponentProps<typeofSheetPrimitive.Overlay>) {
  return(
    <SheetPrimitive.Overlaydata-slot="sheet-overlay"
      className={cn(
        "data-[state=open]:animate-indata-[state=closed]:animate-outdata-[state=closed]:fade-out-0data-[state=open]:fade-in-0 fixed inset-0 z-50bg-black/50",
        className)}
      {...props}
    />
  )
}

functionSheetContent({
  className,
  children,
  side= "right",
  ...props}:React.ComponentProps<typeofSheetPrimitive.Content> & {
  side?:"top" | "right" | "bottom" | "left"
}) {
  return(
    <SheetPortal>
      <SheetOverlay/>
      <SheetPrimitive.Contentdata-slot="sheet-content"
        className={cn(
          "bg-backgrounddata-[state=open]:animate-indata-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-outdata-[state=closed]:duration-300data-[state=open]:duration-500",
          side=== "right" &&
            "data-[state=closed]:slide-out-to-rightdata-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-lsm:max-w-sm",
          side=== "left" &&
            "data-[state=closed]:slide-out-to-leftdata-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-rsm:max-w-sm",
          side=== "top" &&
            "data-[state=closed]:slide-out-to-topdata-[state=open]:slide-in-from-top inset-x-0 top-0 h-autoborder-b",
          side=== "bottom" &&
            "data-[state=closed]:slide-out-to-bottomdata-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-autoborder-t",
          className)}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="ring-offset-background focus:ring-ringdata-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hiddendisabled:pointer-events-none">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

functionSheetHeader({ className, ...props}:React.ComponentProps<"div">) {
  return(
    <divdata-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

functionSheetFooter({ className, ...props}:React.ComponentProps<"div">) {
  return(
    <divdata-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

functionSheetTitle({
  className,
  ...props}:React.ComponentProps<typeofSheetPrimitive.Title>) {
  return(
    <SheetPrimitive.Titledata-slot="sheet-title"
      className={cn("text-foregroundfont-semibold", className)}
      {...props}
    />
  )
}

functionSheetDescription({
  className,
  ...props}:React.ComponentProps<typeofSheetPrimitive.Description>) {
  return(
    <SheetPrimitive.Descriptiondata-slot="sheet-description"
      className={cn("text-muted-foregroundtext-sm", className)}
      {...props}
    />
  )
}

export{
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
