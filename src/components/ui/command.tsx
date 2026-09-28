"useclient"

import* asReact from"react"
import{ Command asCommandPrimitive} from"cmdk"
import{ SearchIcon} from"lucide-react"

import{ cn} from"@/lib/utils"
import{
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from"@/components/ui/dialog"

functionCommand({
  className,
  ...props}:React.ComponentProps<typeofCommandPrimitive>) {
  return(
    <CommandPrimitivedata-slot="command"
      className={cn(
        "bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md",
        className)}
      {...props}
    />
  )
}

functionCommandDialog({
  title= "CommandPalette",
  description= "Search for a command torun...",
  children,
  className,
  showCloseButton= true,
  ...props}:React.ComponentProps<typeofDialog> & {
  title?: stringdescription?: stringclassName?: stringshowCloseButton?: boolean}) {
  return(
    <Dialog{...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent className={cn("overflow-hidden p-0", className)}
        showCloseButton={showCloseButton}
      >
        <Command className="[&_[cmdk-group-heading]]:text-muted-foreground**:data-[slot=command-input-wrapper]:h-12[&_[cmdk-group-heading]]:px-2[&_[cmdk-group-heading]]:font-medium[&_[cmdk-group]]:px-2[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0[&_[cmdk-input-wrapper]_svg]:h-5[&_[cmdk-input-wrapper]_svg]:w-5[&_[cmdk-input]]:h-12[&_[cmdk-item]]:px-2[&_[cmdk-item]]:py-3[&_[cmdk-item]_svg]:h-5[&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

functionCommandInput({
  className,
  ...props}:React.ComponentProps<typeofCommandPrimitive.Input>) {
  return(
    <divdata-slot="command-input-wrapper"
      className="flex h-9 items-center gap-2 border-bpx-3"
    >
      <SearchIcon className="size-4 shrink-0opacity-50" />
      <CommandPrimitive.Inputdata-slot="command-input"
        className={cn(
          "placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-alloweddisabled:opacity-50",
          className)}
        {...props}
      />
    </div>
  )
}

functionCommandList({
  className,
  ...props}:React.ComponentProps<typeofCommandPrimitive.List>) {
  return(
    <CommandPrimitive.Listdata-slot="command-list"
      className={cn(
        "max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto",
        className)}
      {...props}
    />
  )
}

functionCommandEmpty({
  ...props}:React.ComponentProps<typeofCommandPrimitive.Empty>) {
  return(
    <CommandPrimitive.Emptydata-slot="command-empty"
      className="py-6 text-centertext-sm"
      {...props}
    />
  )
}

functionCommandGroup({
  className,
  ...props}:React.ComponentProps<typeofCommandPrimitive.Group>) {
  return(
    <CommandPrimitive.Groupdata-slot="command-group"
      className={cn(
        "text-foreground[&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1[&_[cmdk-group-heading]]:px-2[&_[cmdk-group-heading]]:py-1.5[&_[cmdk-group-heading]]:text-xs[&_[cmdk-group-heading]]:font-medium",
        className)}
      {...props}
    />
  )
}

functionCommandSeparator({
  className,
  ...props}:React.ComponentProps<typeofCommandPrimitive.Separator>) {
  return(
    <CommandPrimitive.Separatordata-slot="command-separator"
      className={cn("bg-border -mx-1h-px", className)}
      {...props}
    />
  )
}

functionCommandItem({
  className,
  ...props}:React.ComponentProps<typeofCommandPrimitive.Item>) {
  return(
    <CommandPrimitive.Itemdata-slot="command-item"
      className={cn(
        "data-[selected=true]:bg-accentdata-[selected=true]:text-accent-foreground[&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-nonedata-[disabled=true]:pointer-events-nonedata-[disabled=true]:opacity-50[&_svg]:pointer-events-none[&_svg]:shrink-0[&_svg:not([class*='size-'])]:size-4",
        className)}
      {...props}
    />
  )
}

functionCommandShortcut({
  className,
  ...props}:React.ComponentProps<"span">) {
  return(
    <spandata-slot="command-shortcut"
      className={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className)}
      {...props}
    />
  )
}

export{
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
