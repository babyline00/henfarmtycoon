import* asReact from"react"

import{ cn} from"@/lib/utils"

functionCard({ className, ...props}:React.ComponentProps<"div">) {
  return(
    <divdata-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6shadow-sm",
        className)}
      {...props}
    />
  )
}

functionCardHeader({ className, ...props}:React.ComponentProps<"div">) {
  return(
    <divdata-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-mingrid-rows-[auto_auto] items-start gap-1.5 px-6has-data-[slot=card-action]:grid-cols-[1fr_auto][.border-b]:pb-6",
        className)}
      {...props}
    />
  )
}

functionCardTitle({ className, ...props}:React.ComponentProps<"div">) {
  return(
    <divdata-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

functionCardDescription({ className, ...props}:React.ComponentProps<"div">) {
  return(
    <divdata-slot="card-description"
      className={cn("text-muted-foregroundtext-sm", className)}
      {...props}
    />
  )
}

functionCardAction({ className, ...props}:React.ComponentProps<"div">) {
  return(
    <divdata-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-startjustify-self-end",
        className)}
      {...props}
    />
  )
}

functionCardContent({ className, ...props}:React.ComponentProps<"div">) {
  return(
    <divdata-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

functionCardFooter({ className, ...props}:React.ComponentProps<"div">) {
  return(
    <divdata-slot="card-footer"
      className={cn("flex items-center px-6[.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export{
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
