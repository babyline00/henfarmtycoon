import{ cn} from"@/lib/utils"

functionSkeleton({ className, ...props}:React.ComponentProps<"div">) {
  return(
    <divdata-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

export{ Skeleton}
