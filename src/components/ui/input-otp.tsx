"useclient"

import* asReact from"react"
import{ OTPInput, OTPInputContext} from"input-otp"
import{ MinusIcon} from"lucide-react"

import{ cn} from"@/lib/utils"

functionInputOTP({
  className,
  containerClassName,
  ...props}:React.ComponentProps<typeofOTPInput> & {
  containerClassName?: string}) {
  return(
    <OTPInputdata-slot="input-otp"
      containerClassName={cn(
        "flex items-center gap-2has-disabled:opacity-50",
        containerClassName)}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  )
}

functionInputOTPGroup({ className, ...props}:React.ComponentProps<"div">) {
  return(
    <divdata-slot="input-otp-group"
      className={cn("flex items-center", className)}
      {...props}
    />
  )
}

functionInputOTPSlot({
  index,
  className,
  ...props}:React.ComponentProps<"div"> & {
  index: number}) {
  constinputOTPContext= React.useContext(OTPInputContext)
  const{ char, hasFakeCaret, isActive} = inputOTPContext?.slots[index]?? {}

  return(
    <divdata-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        "data-[active=true]:border-ringdata-[active=true]:ring-ring/50data-[active=true]:aria-invalid:ring-destructive/20dark:data-[active=true]:aria-invalid:ring-destructive/40 aria-invalid:border-destructivedata-[active=true]:aria-invalid:border-destructive dark:bg-input/30 border-input relative flex h-9 w-9 items-center justify-center border-y border-r text-sm shadow-xs transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-mddata-[active=true]:z-10data-[active=true]:ring-[3px]",
        className)}
      {...props}
    >
      {char}
      {hasFakeCaret&& (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      )}
    </div>
  )
}

functionInputOTPSeparator({ ...props}:React.ComponentProps<"div">) {
  return(
    <divdata-slot="input-otp-separator" role="separator" {...props}>
      <MinusIcon/>
    </div>
  )
}

export{ InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator}
