"useclient"

import* asReact from"react"
import* asLabelPrimitive from"@radix-ui/react-label"

import{ cn} from"@/lib/utils"

function Label({
  className,
  ...props}:React.ComponentProps<typeof LabelPrimitive.Root>) {
  return(
    <LabelPrimitive.Rootdata-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-nonegroup-data-[disabled=true]:pointer-events-nonegroup-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowedpeer-disabled:opacity-50",
        className)}
      {...props}
    />
  )
}

export{ Label}
