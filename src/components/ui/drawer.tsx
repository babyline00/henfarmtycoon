"useclient"

import* asReact from"react"
import{ Drawer asDrawerPrimitive} from"vaul"

import{ cn} from"@/lib/utils"

functionDrawer({
  ...props}:React.ComponentProps<typeofDrawerPrimitive.Root>) {
  return<DrawerPrimitive.Rootdata-slot="drawer" {...props} />
}

functionDrawerTrigger({
  ...props}:React.ComponentProps<typeofDrawerPrimitive.Trigger>) {
  return<DrawerPrimitive.Triggerdata-slot="drawer-trigger" {...props} />
}

functionDrawerPortal({
  ...props}:React.ComponentProps<typeofDrawerPrimitive.Portal>) {
  return<DrawerPrimitive.Portaldata-slot="drawer-portal" {...props} />
}

functionDrawerClose({
  ...props}:React.ComponentProps<typeofDrawerPrimitive.Close>) {
  return<DrawerPrimitive.Closedata-slot="drawer-close" {...props} />
}

functionDrawerOverlay({
  className,
  ...props}:React.ComponentProps<typeofDrawerPrimitive.Overlay>) {
  return(
    <DrawerPrimitive.Overlaydata-slot="drawer-overlay"
      className={cn(
        "data-[state=open]:animate-indata-[state=closed]:animate-outdata-[state=closed]:fade-out-0data-[state=open]:fade-in-0 fixed inset-0 z-50bg-black/50",
        className)}
      {...props}
    />
  )
}

functionDrawerContent({
  className,
  children,
  ...props}:React.ComponentProps<typeofDrawerPrimitive.Content>) {
  return(
    <DrawerPortaldata-slot="drawer-portal">
      <DrawerOverlay/>
      <DrawerPrimitive.Contentdata-slot="drawer-content"
        className={cn(
          "group/drawer-content bg-background fixed z-50 flex h-autoflex-col",
          "data-[vaul-drawer-direction=top]:inset-x-0data-[vaul-drawer-direction=top]:top-0data-[vaul-drawer-direction=top]:mb-24data-[vaul-drawer-direction=top]:max-h-[80vh]data-[vaul-drawer-direction=top]:rounded-b-lgdata-[vaul-drawer-direction=top]:border-b",
          "data-[vaul-drawer-direction=bottom]:inset-x-0data-[vaul-drawer-direction=bottom]:bottom-0data-[vaul-drawer-direction=bottom]:mt-24data-[vaul-drawer-direction=bottom]:max-h-[80vh]data-[vaul-drawer-direction=bottom]:rounded-t-lgdata-[vaul-drawer-direction=bottom]:border-t",
          "data-[vaul-drawer-direction=right]:inset-y-0data-[vaul-drawer-direction=right]:right-0data-[vaul-drawer-direction=right]:w-3/4data-[vaul-drawer-direction=right]:border-ldata-[vaul-drawer-direction=right]:sm:max-w-sm",
          "data-[vaul-drawer-direction=left]:inset-y-0data-[vaul-drawer-direction=left]:left-0data-[vaul-drawer-direction=left]:w-3/4data-[vaul-drawer-direction=left]:border-rdata-[vaul-drawer-direction=left]:sm:max-w-sm",
          className)}
        {...props}
      >
        <div className="bg-muted mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-fullgroup-data-[vaul-drawer-direction=bottom]/drawer-content:block" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

functionDrawerHeader({ className, ...props}:React.ComponentProps<"div">) {
  return(
    <divdata-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 p-4group-data-[vaul-drawer-direction=bottom]/drawer-content:text-centergroup-data-[vaul-drawer-direction=top]/drawer-content:text-center md:gap-1.5md:text-left",
        className)}
      {...props}
    />
  )
}

functionDrawerFooter({ className, ...props}:React.ComponentProps<"div">) {
  return(
    <divdata-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

functionDrawerTitle({
  className,
  ...props}:React.ComponentProps<typeofDrawerPrimitive.Title>) {
  return(
    <DrawerPrimitive.Titledata-slot="drawer-title"
      className={cn("text-foregroundfont-semibold", className)}
      {...props}
    />
  )
}

functionDrawerDescription({
  className,
  ...props}:React.ComponentProps<typeofDrawerPrimitive.Description>) {
  return(
    <DrawerPrimitive.Descriptiondata-slot="drawer-description"
      className={cn("text-muted-foregroundtext-sm", className)}
      {...props}
    />
  )
}

export{
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
