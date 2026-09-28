"useclient"

import* asReact from"react"
import* asToggleGroupPrimitive from"@radix-ui/react-toggle-group"
import{ typeVariantProps} from"class-variance-authority"

import{ cn} from"@/lib/utils"
import{ toggleVariants} from"@/components/ui/toggle"

constToggleGroupContext= React.createContext<
  VariantProps<typeoftoggleVariants>
>({
  size:"default",
  variant:"default",
})

functionToggleGroup({
  className,
  variant,
  size,
  children,
  ...props}:React.ComponentProps<typeofToggleGroupPrimitive.Root> &
  VariantProps<typeoftoggleVariants>) {
  return(
    <ToggleGroupPrimitive.Rootdata-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn(
        "group/toggle-group flex w-fit items-center rounded-mddata-[variant=outline]:shadow-xs",
        className)}
      {...props}
    >
      <ToggleGroupContext.Providervalue={{ variant, size}}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  )
}

functionToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props}:React.ComponentProps<typeofToggleGroupPrimitive.Item> &
  VariantProps<typeoftoggleVariants>) {
  const context= React.useContext(ToggleGroupContext)

  return(
    <ToggleGroupPrimitive.Itemdata-slot="toggle-group-item"
      data-variant={context.variant|| variant}
      data-size={context.size|| size}
      className={cn(
        toggleVariants({
          variant: context.variant|| variant,
          size: context.size|| size,
        }),
        "min-w-0 flex-1 shrink-0 rounded-none shadow-none first:rounded-l-md last:rounded-r-md focus:z-10 focus-visible:z-10data-[variant=outline]:border-l-0data-[variant=outline]:first:border-l",
        className)}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
}

export{ ToggleGroup, ToggleGroupItem}
