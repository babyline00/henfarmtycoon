"useclient"

import* asReact from"react"
import* asAlertDialogPrimitive from"@radix-ui/react-alert-dialog"

import{ cn} from"@/lib/utils"
import{ buttonVariants} from"@/components/ui/button"

functionAlertDialog({
  ...props}:React.ComponentProps<typeofAlertDialogPrimitive.Root>) {
  return<AlertDialogPrimitive.Rootdata-slot="alert-dialog" {...props} />
}

functionAlertDialogTrigger({
  ...props}:React.ComponentProps<typeofAlertDialogPrimitive.Trigger>) {
  return(
    <AlertDialogPrimitive.Triggerdata-slot="alert-dialog-trigger" {...props} />
  )
}

functionAlertDialogPortal({
  ...props}:React.ComponentProps<typeofAlertDialogPrimitive.Portal>) {
  return(
    <AlertDialogPrimitive.Portaldata-slot="alert-dialog-portal" {...props} />
  )
}

functionAlertDialogOverlay({
  className,
  ...props}:React.ComponentProps<typeofAlertDialogPrimitive.Overlay>) {
  return(
    <AlertDialogPrimitive.Overlaydata-slot="alert-dialog-overlay"
      className={cn(
        "data-[state=open]:animate-indata-[state=closed]:animate-outdata-[state=closed]:fade-out-0data-[state=open]:fade-in-0 fixed inset-0 z-50bg-black/50",
        className)}
      {...props}
    />
  )
}

functionAlertDialogContent({
  className,
  ...props}:React.ComponentProps<typeofAlertDialogPrimitive.Content>) {
  return(
    <AlertDialogPortal>
      <AlertDialogOverlay/>
      <AlertDialogPrimitive.Contentdata-slot="alert-dialog-content"
        className={cn(
          "bg-backgrounddata-[state=open]:animate-indata-[state=closed]:animate-outdata-[state=closed]:fade-out-0data-[state=open]:fade-in-0data-[state=closed]:zoom-out-95data-[state=open]:zoom-in-95 fixedtop-[50%]left-[50%] z-50 grid w-fullmax-w-[calc(100%-2rem)]translate-x-[-50%]translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200sm:max-w-lg",
          className)}
        {...props}
      />
    </AlertDialogPortal>
  )
}

functionAlertDialogHeader({
  className,
  ...props}:React.ComponentProps<"div">) {
  return(
    <divdata-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-centersm:text-left", className)}
      {...props}
    />
  )
}

functionAlertDialogFooter({
  className,
  ...props}:React.ComponentProps<"div">) {
  return(
    <divdata-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-rowsm:justify-end",
        className)}
      {...props}
    />
  )
}

functionAlertDialogTitle({
  className,
  ...props}:React.ComponentProps<typeofAlertDialogPrimitive.Title>) {
  return(
    <AlertDialogPrimitive.Titledata-slot="alert-dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  )
}

functionAlertDialogDescription({
  className,
  ...props}:React.ComponentProps<typeofAlertDialogPrimitive.Description>) {
  return(
    <AlertDialogPrimitive.Descriptiondata-slot="alert-dialog-description"
      className={cn("text-muted-foregroundtext-sm", className)}
      {...props}
    />
  )
}

functionAlertDialogAction({
  className,
  ...props}:React.ComponentProps<typeofAlertDialogPrimitive.Action>) {
  return(
    <AlertDialogPrimitive.Action className={cn(buttonVariants(), className)}
      {...props}
    />
  )
}

functionAlertDialogCancel({
  className,
  ...props}:React.ComponentProps<typeofAlertDialogPrimitive.Cancel>) {
  return(
    <AlertDialogPrimitive.Cancel className={cn(buttonVariants({ variant:"outline" }), className)}
      {...props}
    />
  )
}

export{
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
