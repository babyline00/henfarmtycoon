"useclient"

import* asReact from"react"
import* asSliderPrimitive from"@radix-ui/react-slider"

import{ cn} from"@/lib/utils"

functionSlider({
  className,
  defaultValue,
  value,
  min= 0,
  max= 100,
  ...props}:React.ComponentProps<typeofSliderPrimitive.Root>) {
  const_values= React.useMemo(
    () =>
      Array.isArray(value)
        ? value :Array.isArray(defaultValue)
          ? defaultValue :[min, max],
    [value, defaultValue, min, max])

  return(
    <SliderPrimitive.Rootdata-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50data-[orientation=vertical]:h-fulldata-[orientation=vertical]:min-h-44data-[orientation=vertical]:w-autodata-[orientation=vertical]:flex-col",
        className)}
      {...props}
    >
      <SliderPrimitive.Trackdata-slot="slider-track"
        className={cn(
          "bg-muted relative grow overflow-hidden rounded-fulldata-[orientation=horizontal]:h-1.5data-[orientation=horizontal]:w-fulldata-[orientation=vertical]:h-fulldata-[orientation=vertical]:w-1.5"
        )}
      >
        <SliderPrimitive.Rangedata-slot="slider-range"
          className={cn(
            "bg-primary absolutedata-[orientation=horizontal]:h-fulldata-[orientation=vertical]:w-full"
          )}
        />
      </SliderPrimitive.Track>
      {Array.from({ length:_values.length}, (_, index) => (
        <SliderPrimitive.Thumbdata-slot="slider-thumb"
          key={index}
          className="border-primary bg-background ring-ring/50 block size-4 shrink-0 rounded-full border shadow-smtransition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-nonedisabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export{ Slider}
