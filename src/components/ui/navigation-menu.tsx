import* asReact from"react"
import* asNavigationMenuPrimitive from"@radix-ui/react-navigation-menu"
import{ cva} from"class-variance-authority"
import{ ChevronDownIcon} from"lucide-react"

import{ cn} from"@/lib/utils"

functionNavigationMenu({
  className,
  children,
  viewport= true,
  ...props}:React.ComponentProps<typeofNavigationMenuPrimitive.Root> & {
  viewport?: boolean}) {
  return(
    <NavigationMenuPrimitive.Rootdata-slot="navigation-menu"
      data-viewport={viewport}
      className={cn(
        "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
        className)}
      {...props}
    >
      {children}
      {viewport&& <NavigationMenuViewport/>}
    </NavigationMenuPrimitive.Root>
  )
}

functionNavigationMenuList({
  className,
  ...props}:React.ComponentProps<typeofNavigationMenuPrimitive.List>) {
  return(
    <NavigationMenuPrimitive.Listdata-slot="navigation-menu-list"
      className={cn(
        "group flex flex-1 list-none items-center justify-center gap-1",
        className)}
      {...props}
    />
  )
}

functionNavigationMenuItem({
  className,
  ...props}:React.ComponentProps<typeofNavigationMenuPrimitive.Item>) {
  return(
    <NavigationMenuPrimitive.Itemdata-slot="navigation-menu-item"
      className={cn("relative", className)}
      {...props}
    />
  )
}

constnavigationMenuTriggerStyle= cva(
  "group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50data-[state=open]:hover:bg-accentdata-[state=open]:text-accent-foregrounddata-[state=open]:focus:bg-accentdata-[state=open]:bg-accent/50 focus-visible:ring-ring/50 outline-nonetransition-[color,box-shadow] focus-visible:ring-[3px]focus-visible:outline-1"
)

functionNavigationMenuTrigger({
  className,
  children,
  ...props}:React.ComponentProps<typeofNavigationMenuPrimitive.Trigger>) {
  return(
    <NavigationMenuPrimitive.Triggerdata-slot="navigation-menu-trigger"
      className={cn(navigationMenuTriggerStyle(), "group", className)}
      {...props}
    >
      {children}{" "}
      <ChevronDownIcon className="relative top-[1px] ml-1 size-3 transition duration-300group-data-[state=open]:rotate-180"
        aria-hidden="true"
      />
    </NavigationMenuPrimitive.Trigger>
  )
}

functionNavigationMenuContent({
  className,
  ...props}:React.ComponentProps<typeofNavigationMenuPrimitive.Content>) {
  return(
    <NavigationMenuPrimitive.Contentdata-slot="navigation-menu-content"
      className={cn(
        "data-[motion^=from-]:animate-indata-[motion^=to-]:animate-outdata-[motion^=from-]:fade-indata-[motion^=to-]:fade-outdata-[motion=from-end]:slide-in-from-right-52data-[motion=from-start]:slide-in-from-left-52data-[motion=to-end]:slide-out-to-right-52data-[motion=to-start]:slide-out-to-left-52 top-0 left-0 w-full p-2 pr-2.5 md:absolutemd:w-auto",
        "group-data-[viewport=false]/navigation-menu:bg-popovergroup-data-[viewport=false]/navigation-menu:text-popover-foregroundgroup-data-[viewport=false]/navigation-menu:data-[state=open]:animate-ingroup-data-[viewport=false]/navigation-menu:data-[state=closed]:animate-outgroup-data-[viewport=false]/navigation-menu:data-[state=closed]:zoom-out-95group-data-[viewport=false]/navigation-menu:data-[state=open]:zoom-in-95group-data-[viewport=false]/navigation-menu:data-[state=open]:fade-in-0group-data-[viewport=false]/navigation-menu:data-[state=closed]:fade-out-0group-data-[viewport=false]/navigation-menu:top-fullgroup-data-[viewport=false]/navigation-menu:mt-1.5group-data-[viewport=false]/navigation-menu:overflow-hiddengroup-data-[viewport=false]/navigation-menu:rounded-mdgroup-data-[viewport=false]/navigation-menu:bordergroup-data-[viewport=false]/navigation-menu:shadowgroup-data-[viewport=false]/navigation-menu:duration-200**:data-[slot=navigation-menu-link]:focus:ring-0**:data-[slot=navigation-menu-link]:focus:outline-none",
        className)}
      {...props}
    />
  )
}

functionNavigationMenuViewport({
  className,
  ...props}:React.ComponentProps<typeofNavigationMenuPrimitive.Viewport>) {
  return(
    <div className={cn(
        "absolute top-full left-0 isolate z-50 flex justify-center"
      )}
    >
      <NavigationMenuPrimitive.Viewportdata-slot="navigation-menu-viewport"
        className={cn(
          "origin-top-center bg-popover text-popover-foregrounddata-[state=open]:animate-indata-[state=closed]:animate-outdata-[state=closed]:zoom-out-95data-[state=open]:zoom-in-90 relative mt-1.5h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-md border shadowmd:w-[var(--radix-navigation-menu-viewport-width)]",
          className)}
        {...props}
      />
    </div>
  )
}

functionNavigationMenuLink({
  className,
  ...props}:React.ComponentProps<typeofNavigationMenuPrimitive.Link>) {
  return(
    <NavigationMenuPrimitive.Linkdata-slot="navigation-menu-link"
      className={cn(
        "data-[active=true]:focus:bg-accentdata-[active=true]:hover:bg-accentdata-[active=true]:bg-accent/50data-[active=true]:text-accent-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:ring-ring/50[&_svg:not([class*='text-'])]:text-muted-foreground flex flex-col gap-1 rounded-sm p-2 text-sm transition-all outline-none focus-visible:ring-[3px] focus-visible:outline-1[&_svg:not([class*='size-'])]:size-4",
        className)}
      {...props}
    />
  )
}

functionNavigationMenuIndicator({
  className,
  ...props}:React.ComponentProps<typeofNavigationMenuPrimitive.Indicator>) {
  return(
    <NavigationMenuPrimitive.Indicatordata-slot="navigation-menu-indicator"
      className={cn(
        "data-[state=visible]:animate-indata-[state=hidden]:animate-outdata-[state=hidden]:fade-outdata-[state=visible]:fade-in top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden",
        className)}
      {...props}
    >
      <div className="bg-border relative top-[60%] h-2 w-2 rotate-45 rounded-tl-smshadow-md" />
    </NavigationMenuPrimitive.Indicator>
  )
}

export{
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
}
