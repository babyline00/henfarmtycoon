"useclient"

import* asReact from"react"
import* asTabsPrimitive from"@radix-ui/react-tabs"

import{ cn} from"@/lib/utils"

functionTabs({
  className,
  ...props}:React.ComponentProps<typeofTabsPrimitive.Root>) {
  return(
    <TabsPrimitive.Rootdata-slot="tabs"
      className={cn("flex flex-colgap-2", className)}
      {...props}
    />
  )
}

functionTabsList({
  className,
  ...props}:React.ComponentProps<typeofTabsPrimitive.List>) {
  return(
    <TabsPrimitive.Listdata-slot="tabs-list"
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
        className)}
      {...props}
    />
  )
}

functionTabsTrigger({
  className,
  ...props}:React.ComponentProps<typeofTabsPrimitive.Trigger>) {
  return(
    <TabsPrimitive.Triggerdata-slot="tabs-trigger"
      className={cn(
        "data-[state=active]:bg-backgrounddark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ringdark:data-[state=active]:border-inputdark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flexh-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowraptransition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50data-[state=active]:shadow-sm[&_svg]:pointer-events-none[&_svg]:shrink-0[&_svg:not([class*='size-'])]:size-4",
        className)}
      {...props}
    />
  )
}

functionTabsContent({
  className,
  ...props}:React.ComponentProps<typeofTabsPrimitive.Content>) {
  return(
    <TabsPrimitive.Contentdata-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export{ Tabs, TabsList, TabsTrigger, TabsContent}
