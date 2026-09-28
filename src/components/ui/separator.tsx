"useclient"

import* asReact from"react"
import* asSeparatorPrimitive from"@radix-ui/react-separator"

import{ cn} from"@/lib/utils"

functionSeparator({
  className,
  orientation= "horizontal",
  decorative= true,
  ...props}:React.ComponentProps<typeofSeparatorPrimitive.Root>) {
  return(
    <SeparatorPrimitive.Rootdata-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "bg-border shrink-0data-[orientation=horizontal]:h-pxdata-[orientation=horizontal]:w-fulldata-[orientation=vertical]:h-fulldata-[orientation=vertical]:w-px",
        className)}
      {...props}
    />
  )
}

export{ Separator}
