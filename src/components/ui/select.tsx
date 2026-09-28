"useclient"

import* asReact from"react"
import* asSelectPrimitive from"@radix-ui/react-select"
import{ CheckIcon, ChevronDownIcon, ChevronUpIcon} from"lucide-react"

import{ cn} from"@/lib/utils"

functionSelect({
  ...props}:React.ComponentProps<typeofSelectPrimitive.Root>) {
  return<SelectPrimitive.Rootdata-slot="select" {...props} />
}

functionSelectGroup({
  ...props}:React.ComponentProps<typeofSelectPrimitive.Group>) {
  return<SelectPrimitive.Groupdata-slot="select-group" {...props} />
}

functionSelectValue({
  ...props}:React.ComponentProps<typeofSelectPrimitive.Value>) {
  return<SelectPrimitive.Valuedata-slot="select-value" {...props} />
}

functionSelectTrigger({
  className,
  size= "default",
  children,
  ...props}:React.ComponentProps<typeofSelectPrimitive.Trigger> & {
  size?:"sm" | "default"
}) {
  return(
    <SelectPrimitive.Triggerdata-slot="select-trigger"
      data-size={size}
      className={cn(
        "border-input data-[placeholder]:text-muted-foreground[&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xstransition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50data-[size=default]:h-9data-[size=sm]:h-8*:data-[slot=select-value]:line-clamp-1*:data-[slot=select-value]:flex*:data-[slot=select-value]:items-center*:data-[slot=select-value]:gap-2[&_svg]:pointer-events-none[&_svg]:shrink-0[&_svg:not([class*='size-'])]:size-4",
        className)}
      {...props}
    >
      {children}
      <SelectPrimitive.IconasChild>
        <ChevronDownIcon className="size-4opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

functionSelectContent({
  className,
  children,
  position= "popper",
  ...props}:React.ComponentProps<typeofSelectPrimitive.Content>) {
  return(
    <SelectPrimitive.Portal>
      <SelectPrimitive.Contentdata-slot="select-content"
        className={cn(
          "bg-popover text-popover-foregrounddata-[state=open]:animate-indata-[state=closed]:animate-outdata-[state=closed]:fade-out-0data-[state=open]:fade-in-0data-[state=closed]:zoom-out-95data-[state=open]:zoom-in-95data-[side=bottom]:slide-in-from-top-2data-[side=left]:slide-in-from-right-2data-[side=right]:slide-in-from-left-2data-[side=top]:slide-in-from-bottom-2 relative z-50max-h-(--radix-select-content-available-height) min-w-[8rem]origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md bordershadow-md",
          position=== "popper" &&
            "data-[side=bottom]:translate-y-1data-[side=left]:-translate-x-1data-[side=right]:translate-x-1data-[side=top]:-translate-y-1",
          className)}
        position={position}
        {...props}
      >
        <SelectScrollUpButton/>
        <SelectPrimitive.Viewport className={cn(
            "p-1",
            position=== "popper" &&
              "h-[var(--radix-select-trigger-height)] w-fullmin-w-[var(--radix-select-trigger-width)]scroll-my-1"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton/>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

functionSelectLabel({
  className,
  ...props}:React.ComponentProps<typeofSelectPrimitive.Label>) {
  return(
    <SelectPrimitive.Labeldata-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  )
}

functionSelectItem({
  className,
  children,
  ...props}:React.ComponentProps<typeofSelectPrimitive.Item>) {
  return(
    <SelectPrimitive.Itemdata-slot="select-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground[&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50[&_svg]:pointer-events-none[&_svg]:shrink-0[&_svg:not([class*='size-'])]:size-4*:[span]:last:flex*:[span]:last:items-center*:[span]:last:gap-2",
        className)}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

functionSelectSeparator({
  className,
  ...props}:React.ComponentProps<typeofSelectPrimitive.Separator>) {
  return(
    <SelectPrimitive.Separatordata-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

functionSelectScrollUpButton({
  className,
  ...props}:React.ComponentProps<typeofSelectPrimitive.ScrollUpButton>) {
  return(
    <SelectPrimitive.ScrollUpButtondata-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

functionSelectScrollDownButton({
  className,
  ...props}:React.ComponentProps<typeofSelectPrimitive.ScrollDownButton>) {
  return(
    <SelectPrimitive.ScrollDownButtondata-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className)}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export{
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
