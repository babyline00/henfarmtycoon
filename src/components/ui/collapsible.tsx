"useclient"

import* asCollapsiblePrimitive from"@radix-ui/react-collapsible"

functionCollapsible({
  ...props}:React.ComponentProps<typeofCollapsiblePrimitive.Root>) {
  return<CollapsiblePrimitive.Rootdata-slot="collapsible" {...props} />
}

functionCollapsibleTrigger({
  ...props}:React.ComponentProps<typeofCollapsiblePrimitive.CollapsibleTrigger>) {
  return(
    <CollapsiblePrimitive.CollapsibleTriggerdata-slot="collapsible-trigger"
      {...props}
    />
  )
}

functionCollapsibleContent({
  ...props}:React.ComponentProps<typeofCollapsiblePrimitive.CollapsibleContent>) {
  return(
    <CollapsiblePrimitive.CollapsibleContentdata-slot="collapsible-content"
      {...props}
    />
  )
}

export{ Collapsible, CollapsibleTrigger, CollapsibleContent}
