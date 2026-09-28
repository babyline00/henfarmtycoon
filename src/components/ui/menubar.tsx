"useclient"

import* asReact from"react"
import* asMenubarPrimitive from"@radix-ui/react-menubar"
import{ CheckIcon, ChevronRightIcon, CircleIcon} from"lucide-react"

import{ cn} from"@/lib/utils"

functionMenubar({
  className,
  ...props}:React.ComponentProps<typeofMenubarPrimitive.Root>) {
  return(
    <MenubarPrimitive.Rootdata-slot="menubar"
      className={cn(
        "bg-background flex h-9 items-center gap-1 rounded-md border p-1shadow-xs",
        className)}
      {...props}
    />
  )
}

functionMenubarMenu({
  ...props}:React.ComponentProps<typeofMenubarPrimitive.Menu>) {
  return<MenubarPrimitive.Menudata-slot="menubar-menu" {...props} />
}

functionMenubarGroup({
  ...props}:React.ComponentProps<typeofMenubarPrimitive.Group>) {
  return<MenubarPrimitive.Groupdata-slot="menubar-group" {...props} />
}

functionMenubarPortal({
  ...props}:React.ComponentProps<typeofMenubarPrimitive.Portal>) {
  return<MenubarPrimitive.Portaldata-slot="menubar-portal" {...props} />
}

functionMenubarRadioGroup({
  ...props}:React.ComponentProps<typeofMenubarPrimitive.RadioGroup>) {
  return(
    <MenubarPrimitive.RadioGroupdata-slot="menubar-radio-group" {...props} />
  )
}

functionMenubarTrigger({
  className,
  ...props}:React.ComponentProps<typeofMenubarPrimitive.Trigger>) {
  return(
    <MenubarPrimitive.Triggerdata-slot="menubar-trigger"
      className={cn(
        "focus:bg-accent focus:text-accent-foregrounddata-[state=open]:bg-accentdata-[state=open]:text-accent-foreground flex items-center rounded-sm px-2 py-1 text-sm font-medium outline-hiddenselect-none",
        className)}
      {...props}
    />
  )
}

functionMenubarContent({
  className,
  align= "start",
  alignOffset= -4,
  sideOffset= 8,
  ...props}:React.ComponentProps<typeofMenubarPrimitive.Content>) {
  return(
    <MenubarPortal>
      <MenubarPrimitive.Contentdata-slot="menubar-content"
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foregrounddata-[state=open]:animate-indata-[state=closed]:fade-out-0data-[state=open]:fade-in-0data-[state=closed]:zoom-out-95data-[state=open]:zoom-in-95data-[side=bottom]:slide-in-from-top-2data-[side=left]:slide-in-from-right-2data-[side=right]:slide-in-from-left-2data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[12rem]origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border p-1shadow-md",
          className)}
        {...props}
      />
    </MenubarPortal>
  )
}

functionMenubarItem({
  className,
  inset,
  variant= "default",
  ...props}:React.ComponentProps<typeofMenubarPrimitive.Item> & {
  inset?: booleanvariant?:"default" | "destructive"
}) {
  return(
    <MenubarPrimitive.Itemdata-slot="menubar-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "focus:bg-accent focus:text-accent-foregrounddata-[variant=destructive]:text-destructivedata-[variant=destructive]:focus:bg-destructive/10dark:data-[variant=destructive]:focus:bg-destructive/20data-[variant=destructive]:focus:text-destructivedata-[variant=destructive]:*:[svg]:!text-destructive[&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8[&_svg]:pointer-events-none[&_svg]:shrink-0[&_svg:not([class*='size-'])]:size-4",
        className)}
      {...props}
    />
  )
}

functionMenubarCheckboxItem({
  className,
  children,
  checked,
  ...props}:React.ComponentProps<typeofMenubarPrimitive.CheckboxItem>) {
  return(
    <MenubarPrimitive.CheckboxItemdata-slot="menubar-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50[&_svg]:pointer-events-none[&_svg]:shrink-0[&_svg:not([class*='size-'])]:size-4",
        className)}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <MenubarPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.CheckboxItem>
  )
}

functionMenubarRadioItem({
  className,
  children,
  ...props}:React.ComponentProps<typeofMenubarPrimitive.RadioItem>) {
  return(
    <MenubarPrimitive.RadioItemdata-slot="menubar-radio-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50[&_svg]:pointer-events-none[&_svg]:shrink-0[&_svg:not([class*='size-'])]:size-4",
        className)}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <MenubarPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.RadioItem>
  )
}

functionMenubarLabel({
  className,
  inset,
  ...props}:React.ComponentProps<typeofMenubarPrimitive.Label> & {
  inset?: boolean}) {
  return(
    <MenubarPrimitive.Labeldata-slot="menubar-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-sm font-mediumdata-[inset]:pl-8",
        className)}
      {...props}
    />
  )
}

functionMenubarSeparator({
  className,
  ...props}:React.ComponentProps<typeofMenubarPrimitive.Separator>) {
  return(
    <MenubarPrimitive.Separatordata-slot="menubar-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

functionMenubarShortcut({
  className,
  ...props}:React.ComponentProps<"span">) {
  return(
    <spandata-slot="menubar-shortcut"
      className={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className)}
      {...props}
    />
  )
}

functionMenubarSub({
  ...props}:React.ComponentProps<typeofMenubarPrimitive.Sub>) {
  return<MenubarPrimitive.Subdata-slot="menubar-sub" {...props} />
}

functionMenubarSubTrigger({
  className,
  inset,
  children,
  ...props}:React.ComponentProps<typeofMenubarPrimitive.SubTrigger> & {
  inset?: boolean}) {
  return(
    <MenubarPrimitive.SubTriggerdata-slot="menubar-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foregrounddata-[state=open]:bg-accentdata-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-nonedata-[inset]:pl-8",
        className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto h-4 w-4" />
    </MenubarPrimitive.SubTrigger>
  )
}

functionMenubarSubContent({
  className,
  ...props}:React.ComponentProps<typeofMenubarPrimitive.SubContent>) {
  return(
    <MenubarPrimitive.SubContentdata-slot="menubar-sub-content"
      className={cn(
        "bg-popover text-popover-foregrounddata-[state=open]:animate-indata-[state=closed]:animate-outdata-[state=closed]:fade-out-0data-[state=open]:fade-in-0data-[state=closed]:zoom-out-95data-[state=open]:zoom-in-95data-[side=bottom]:slide-in-from-top-2data-[side=left]:slide-in-from-right-2data-[side=right]:slide-in-from-left-2data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem]origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border p-1shadow-lg",
        className)}
      {...props}
    />
  )
}

export{
  Menubar,
  MenubarPortal,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarGroup,
  MenubarSeparator,
  MenubarLabel,
  MenubarItem,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
}
