import* asReact from"react"
import{ Slot} from"@radix-ui/react-slot"
import{ ChevronRight, MoreHorizontal} from"lucide-react"

import{ cn} from"@/lib/utils"

functionBreadcrumb({ ...props}:React.ComponentProps<"nav">) {
  return<navaria-label="breadcrumb" data-slot="breadcrumb" {...props} />
}

functionBreadcrumbList({ className, ...props}:React.ComponentProps<"ol">) {
  return(
    <oldata-slot="breadcrumb-list"
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-wordssm:gap-2.5",
        className)}
      {...props}
    />
  )
}

functionBreadcrumbItem({ className, ...props}:React.ComponentProps<"li">) {
  return(
    <lidata-slot="breadcrumb-item"
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    />
  )
}

functionBreadcrumbLink({
  asChild,
  className,
  ...props}:React.ComponentProps<"a"> & {
  asChild?: boolean}) {
  constComp= asChild? Slot :"a"

  return(
    <Compdata-slot="breadcrumb-link"
      className={cn("hover:text-foregroundtransition-colors", className)}
      {...props}
    />
  )
}

functionBreadcrumbPage({ className, ...props}:React.ComponentProps<"span">) {
  return(
    <spandata-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("text-foregroundfont-normal", className)}
      {...props}
    />
  )
}

functionBreadcrumbSeparator({
  children,
  className,
  ...props}:React.ComponentProps<"li">) {
  return(
    <lidata-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", className)}
      {...props}
    >
      {children?? <ChevronRight/>}
    </li>
  )
}

functionBreadcrumbEllipsis({
  className,
  ...props}:React.ComponentProps<"span">) {
  return(
    <spandata-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">More</span>
    </span>
  )
}

export{
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}
