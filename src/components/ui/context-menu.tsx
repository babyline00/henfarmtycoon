"useclient"

import* asReact from"react"
import* asContextMenuPrimitive from"@radix-ui/react-context-menu"
import{ CheckIcon, ChevronRightIcon, CircleIcon} from"lucide-react"

import{ cn} from"@/lib/utils"

functionContextMenu({
  ...props}:React.ComponentProps<typeofContextMenuPrimitive.Root>) {
  return<ContextMenuPrimitive.Rootdata-slot="context-menu" {...props} />
}

functionContextMenuTrigger({
  ...props}:React.ComponentProps<typeofContextMenuPrimitive.Trigger>) {
  return(
    <ContextMenuPrimitive.Triggerdata-slot="context-menu-trigger" {...props} />
  )
}

functionContextMenuGroup({
  ...props}:React.ComponentProps<typeofContextMenuPrimitive.Group>) {
  return(
    <ContextMenuPrimitive.Groupdata-slot="context-menu-group" {...props} />
  )
}

functionContextMenuPortal({
  ...props}:React.ComponentProps<typeofContextMenuPrimitive.Portal>) {
  return(
    <ContextMenuPrimitive.Portaldata-slot="context-menu-portal" {...props} />
  )
}

functionContextMenuSub({
  ...props}:React.ComponentProps<typeofContextMenuPrimitive.Sub>) {
  return<ContextMenuPrimitive.Subdata-slot="context-menu-sub" {...props} />
}

functionContextMenuRadioGroup({
  ...props}:React.ComponentProps<typeofContextMenuPrimitive.RadioGroup>) {
  return(
    <ContextMenuPrimitive.RadioGroupdata-slot="context-menu-radio-group"
      {...props}
    />
  )
}

functionContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props}:React.ComponentProps<typeofContextMenuPrimitive.SubTrigger> & {
  inset?: boolean}) {
  return(
    <ContextMenuPrimitive.SubTriggerdata-slot="context-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foregrounddata-[state=open]:bg-accentdata-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8[&_svg]:pointer-events-none[&_svg]:shrink-0[&_svg:not([class*='size-'])]:size-4",
        className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </ContextMenuPrimitive.SubTrigger>
  )
}

functionContextMenuSubContent({
  className,
  ...props}:React.ComponentProps<typeofContextMenuPrimitive.SubContent>) {
  return(
    <ContextMenuPrimitive.SubContentdata-slot="context-menu-sub-content"
      className={cn(
        "bg-popover text-popover-foregrounddata-[state=open]:animate-indata-[state=closed]:animate-outdata-[state=closed]:fade-out-0data-[state=open]:fade-in-0data-[state=closed]:zoom-out-95data-[state=open]:zoom-in-95data-[side=bottom]:slide-in-from-top-2data-[side=left]:slide-in-from-right-2data-[side=right]:slide-in-from-left-2data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem]origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-md border p-1shadow-lg",
        className)}
      {...props}
    />
  )
}

functionContextMenuContent({
  className,
  ...props}:React.ComponentProps<typeofContextMenuPrimitive.Content>) {
  return(
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Contentdata-slot="context-menu-content"
        className={cn(
          "bg-popover text-popover-foregrounddata-[state=open]:animate-indata-[state=closed]:animate-outdata-[state=closed]:fade-out-0data-[state=open]:fade-in-0data-[state=closed]:zoom-out-95data-[state=open]:zoom-in-95data-[side=bottom]:slide-in-from-top-2data-[side=left]:slide-in-from-right-2data-[side=right]:slide-in-from-left-2data-[side=top]:slide-in-from-bottom-2 z-50max-h-(--radix-context-menu-content-available-height) min-w-[8rem]origin-(--radix-context-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1shadow-md",
          className)}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  )
}

functionContextMenuItem({
  className,
  inset,
  variant= "default",
  ...props}:React.ComponentProps<typeofContextMenuPrimitive.Item> & {
  inset?: booleanvariant?:"default" | "destructive"
}) {
  return(
    <ContextMenuPrimitive.Itemdata-slot="context-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "focus:bg-accent focus:text-accent-foregrounddata-[variant=destructive]:text-destructivedata-[variant=destructive]:focus:bg-destructive/10dark:data-[variant=destructive]:focus:bg-destructive/20data-[variant=destructive]:focus:text-destructivedata-[variant=destructive]:*:[svg]:!text-destructive[&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8[&_svg]:pointer-events-none[&_svg]:shrink-0[&_svg:not([class*='size-'])]:size-4",
        className)}
      {...props}
    />
  )
}

functionContextMenuCheckboxItem({
  className,
  children,
  checked,
  ...props}:React.ComponentProps<typeofContextMenuPrimitive.CheckboxItem>) {
  return(
    <ContextMenuPrimitive.CheckboxItemdata-slot="context-menu-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50[&_svg]:pointer-events-none[&_svg]:shrink-0[&_svg:not([class*='size-'])]:size-4",
        className)}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  )
}

functionContextMenuRadioItem({
  className,
  children,
  ...props}:React.ComponentProps<typeofContextMenuPrimitive.RadioItem>) {
  return(
    <ContextMenuPrimitive.RadioItemdata-slot="context-menu-radio-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50[&_svg]:pointer-events-none[&_svg]:shrink-0[&_svg:not([class*='size-'])]:size-4",
        className)}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  )
}

functionContextMenuLabel({
  className,
  inset,
  ...props}:React.ComponentProps<typeofContextMenuPrimitive.Label> & {
  inset?: boolean}) {
  return(
    <ContextMenuPrimitive.Labeldata-slot="context-menu-label"
      data-inset={inset}
      className={cn(
        "text-foreground px-2 py-1.5 text-sm font-mediumdata-[inset]:pl-8",
        className)}
      {...props}
    />
  )
}

functionContextMenuSeparator({
  className,
  ...props}:React.ComponentProps<typeofContextMenuPrimitive.Separator>) {
  return(
    <ContextMenuPrimitive.Separatordata-slot="context-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

functionContextMenuShortcut({
  className,
  ...props}:React.ComponentProps<"span">) {
  return(
    <spandata-slot="context-menu-shortcut"
      className={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className)}
      {...props}
    />
  )
}

export{
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
}
