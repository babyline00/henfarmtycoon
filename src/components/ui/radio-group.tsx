"useclient"

import* asReact from"react"
import* asRadioGroupPrimitive from"@radix-ui/react-radio-group"
import{ CircleIcon} from"lucide-react"

import{ cn} from"@/lib/utils"

functionRadioGroup({
  className,
  ...props}:React.ComponentProps<typeofRadioGroupPrimitive.Root>) {
  return(
    <RadioGroupPrimitive.Rootdata-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  )
}

functionRadioGroupItem({
  className,
  ...props}:React.ComponentProps<typeofRadioGroupPrimitive.Item>) {
  return(
    <RadioGroupPrimitive.Itemdata-slot="radio-group-item"
      className={cn(
        "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 aspect-square size-4 shrink-0 rounded-full border shadow-xstransition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-alloweddisabled:opacity-50",
        className)}
      {...props}
    >
      <RadioGroupPrimitive.Indicatordata-slot="radio-group-indicator"
        className="relative flex items-center justify-center"
      >
        <CircleIcon className="fill-primary absolute top-1/2 left-1/2 size-2 -translate-x-1/2-translate-y-1/2" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export{ RadioGroup, RadioGroupItem}
