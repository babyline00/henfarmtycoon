"useclient"

import* asReact from"react"
import* asDropdownMenuPrimitive from"@radix-ui/react-dropdown-menu"
import{ CheckIcon, ChevronRightIcon, CircleIcon} from"lucide-react"

import{ cn} from"@/lib/utils"

functionDropdownMenu({
  ...props}:React.ComponentProps<typeofDropdownMenuPrimitive.Root>) {
  return<DropdownMenuPrimitive.Rootdata-slot="dropdown-menu" {...props} />
}

functionDropdownMenuPortal({
  ...props}:React.ComponentProps<typeofDropdownMenuPrimitive.Portal>) {
  return(
    <DropdownMenuPrimitive.Portaldata-slot="dropdown-menu-portal" {...props} />
  )
}

functionDropdownMenuTrigger({
  ...props}:React.ComponentProps<typeofDropdownMenuPrimitive.Trigger>) {
  return(
    <DropdownMenuPrimitive.Triggerdata-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

functionDropdownMenuContent({
  className,
  sideOffset= 4,
  ...props}:React.ComponentProps<typeofDropdownMenuPrimitive.Content>) {
  return(
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Contentdata-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foregrounddata-[state=open]:animate-indata-[state=closed]:animate-outdata-[state=closed]:fade-out-0data-[state=open]:fade-in-0data-[state=closed]:zoom-out-95data-[state=open]:zoom-in-95data-[side=bottom]:slide-in-from-top-2data-[side=left]:slide-in-from-right-2data-[side=right]:slide-in-from-left-2data-[side=top]:slide-in-from-bottom-2 z-50max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem]origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1shadow-md",
          className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

functionDropdownMenuGroup({
  ...props}:React.ComponentProps<typeofDropdownMenuPrimitive.Group>) {
  return(
    <DropdownMenuPrimitive.Groupdata-slot="dropdown-menu-group" {...props} />
  )
}

functionDropdownMenuItem({
  className,
  inset,
  variant= "default",
  ...props}:React.ComponentProps<typeofDropdownMenuPrimitive.Item> & {
  inset?: booleanvariant?:"default" | "destructive"
}) {
  return(
    <DropdownMenuPrimitive.Itemdata-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "focus:bg-accent focus:text-accent-foregrounddata-[variant=destructive]:text-destructivedata-[variant=destructive]:focus:bg-destructive/10dark:data-[variant=destructive]:focus:bg-destructive/20data-[variant=destructive]:focus:text-destructivedata-[variant=destructive]:*:[svg]:!text-destructive[&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8[&_svg]:pointer-events-none[&_svg]:shrink-0[&_svg:not([class*='size-'])]:size-4",
        className)}
      {...props}
    />
  )
}

functionDropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props}:React.ComponentProps<typeofDropdownMenuPrimitive.CheckboxItem>) {
  return(
    <DropdownMenuPrimitive.CheckboxItemdata-slot="dropdown-menu-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50[&_svg]:pointer-events-none[&_svg]:shrink-0[&_svg:not([class*='size-'])]:size-4",
        className)}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

functionDropdownMenuRadioGroup({
  ...props}:React.ComponentProps<typeofDropdownMenuPrimitive.RadioGroup>) {
  return(
    <DropdownMenuPrimitive.RadioGroupdata-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

functionDropdownMenuRadioItem({
  className,
  children,
  ...props}:React.ComponentProps<typeofDropdownMenuPrimitive.RadioItem>) {
  return(
    <DropdownMenuPrimitive.RadioItemdata-slot="dropdown-menu-radio-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50[&_svg]:pointer-events-none[&_svg]:shrink-0[&_svg:not([class*='size-'])]:size-4",
        className)}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

functionDropdownMenuLabel({
  className,
  inset,
  ...props}:React.ComponentProps<typeofDropdownMenuPrimitive.Label> & {
  inset?: boolean}) {
  return(
    <DropdownMenuPrimitive.Labeldata-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-sm font-mediumdata-[inset]:pl-8",
        className)}
      {...props}
    />
  )
}

functionDropdownMenuSeparator({
  className,
  ...props}:React.ComponentProps<typeofDropdownMenuPrimitive.Separator>) {
  return(
    <DropdownMenuPrimitive.Separatordata-slot="dropdown-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

functionDropdownMenuShortcut({
  className,
  ...props}:React.ComponentProps<"span">) {
  return(
    <spandata-slot="dropdown-menu-shortcut"
      className={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className)}
      {...props}
    />
  )
}

functionDropdownMenuSub({
  ...props}:React.ComponentProps<typeofDropdownMenuPrimitive.Sub>) {
  return<DropdownMenuPrimitive.Subdata-slot="dropdown-menu-sub" {...props} />
}

functionDropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props}:React.ComponentProps<typeofDropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean}) {
  return(
    <DropdownMenuPrimitive.SubTriggerdata-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foregrounddata-[state=open]:bg-accentdata-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-nonedata-[inset]:pl-8",
        className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

functionDropdownMenuSubContent({
  className,
  ...props}:React.ComponentProps<typeofDropdownMenuPrimitive.SubContent>) {
  return(
    <DropdownMenuPrimitive.SubContentdata-slot="dropdown-menu-sub-content"
      className={cn(
        "bg-popover text-popover-foregrounddata-[state=open]:animate-indata-[state=closed]:animate-outdata-[state=closed]:fade-out-0data-[state=open]:fade-in-0data-[state=closed]:zoom-out-95data-[state=open]:zoom-in-95data-[side=bottom]:slide-in-from-top-2data-[side=left]:slide-in-from-right-2data-[side=right]:slide-in-from-left-2data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem]origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1shadow-lg",
        className)}
      {...props}
    />
  )
}

export{
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
