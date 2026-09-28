"useclient"

import* asReact from"react"
import* asSwitchPrimitive from"@radix-ui/react-switch"

import{ cn} from"@/lib/utils"

functionSwitch({
  className,
  ...props}:React.ComponentProps<typeofSwitchPrimitive.Root>) {
  return(
    <SwitchPrimitive.Rootdata-slot="switch"
      className={cn(
        "peerdata-[state=checked]:bg-primarydata-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-alloweddisabled:opacity-50",
        className)}
      {...props}
    >
      <SwitchPrimitive.Thumbdata-slot="switch-thumb"
        className={cn(
          "bg-backgrounddark:data-[state=unchecked]:bg-foregrounddark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transformdata-[state=checked]:translate-x-[calc(100%-2px)]data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export{ Switch}
