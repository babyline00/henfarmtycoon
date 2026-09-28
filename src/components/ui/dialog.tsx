"useclient"

import* asReact from"react"
import* asDialogPrimitive from"@radix-ui/react-dialog"
import{ XIcon} from"lucide-react"

import{ cn} from"@/lib/utils"

functionDialog({
  ...props}:React.ComponentProps<typeofDialogPrimitive.Root>) {
  return<DialogPrimitive.Rootdata-slot="dialog" {...props} />
}

functionDialogTrigger({
  ...props}:React.ComponentProps<typeofDialogPrimitive.Trigger>) {
  return<DialogPrimitive.Triggerdata-slot="dialog-trigger" {...props} />
}

functionDialogPortal({
  ...props}:React.ComponentProps<typeofDialogPrimitive.Portal>) {
  return<DialogPrimitive.Portaldata-slot="dialog-portal" {...props} />
}

functionDialogClose({
  ...props}:React.ComponentProps<typeofDialogPrimitive.Close>) {
  return<DialogPrimitive.Closedata-slot="dialog-close" {...props} />
}

functionDialogOverlay({
  className,
  ...props}:React.ComponentProps<typeofDialogPrimitive.Overlay>) {
  return(
    <DialogPrimitive.Overlaydata-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-indata-[state=closed]:animate-outdata-[state=closed]:fade-out-0data-[state=open]:fade-in-0 fixed inset-0 z-50bg-black/50",
        className)}
      {...props}
    />
  )
}

functionDialogContent({
  className,
  children,
  showCloseButton= true,
  ...props}:React.ComponentProps<typeofDialogPrimitive.Content> & {
  showCloseButton?: boolean}) {
  return(
    <DialogPortaldata-slot="dialog-portal">
      <DialogOverlay/>
      <DialogPrimitive.Contentdata-slot="dialog-content"
        className={cn(
          "bg-backgrounddata-[state=open]:animate-indata-[state=closed]:animate-outdata-[state=closed]:fade-out-0data-[state=open]:fade-in-0data-[state=closed]:zoom-out-95data-[state=open]:zoom-in-95 fixedtop-[50%]left-[50%] z-50 grid w-fullmax-w-[calc(100%-2rem)]translate-x-[-50%]translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200sm:max-w-lg",
          className)}
        {...props}
      >
        {children}
        {showCloseButton&& (
          <DialogPrimitive.Closedata-slot="dialog-close"
            className="ring-offset-background focus:ring-ringdata-[state=open]:bg-accentdata-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none[&_svg]:pointer-events-none[&_svg]:shrink-0[&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon/>
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

functionDialogHeader({ className, ...props}:React.ComponentProps<"div">) {
  return(
    <divdata-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-centersm:text-left", className)}
      {...props}
    />
  )
}

functionDialogFooter({ className, ...props}:React.ComponentProps<"div">) {
  return(
    <divdata-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-rowsm:justify-end",
        className)}
      {...props}
    />
  )
}

functionDialogTitle({
  className,
  ...props}:React.ComponentProps<typeofDialogPrimitive.Title>) {
  return(
    <DialogPrimitive.Titledata-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

functionDialogDescription({
  className,
  ...props}:React.ComponentProps<typeofDialogPrimitive.Description>) {
  return(
    <DialogPrimitive.Descriptiondata-slot="dialog-description"
      className={cn("text-muted-foregroundtext-sm", className)}
      {...props}
    />
  )
}

export{
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
