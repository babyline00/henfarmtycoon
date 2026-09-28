"useclient"

import* asReact from"react"

import{ cn} from"@/lib/utils"

functionTable({ className, ...props}:React.ComponentProps<"table">) {
  return(
    <divdata-slot="table-container"
      className="relative w-fulloverflow-x-auto"
    >
      <tabledata-slot="table"
        className={cn("w-full caption-bottomtext-sm", className)}
        {...props}
      />
    </div>
  )
}

functionTableHeader({ className, ...props}:React.ComponentProps<"thead">) {
  return(
    <theaddata-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

functionTableBody({ className, ...props}:React.ComponentProps<"tbody">) {
  return(
    <tbodydata-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

functionTableFooter({ className, ...props}:React.ComponentProps<"tfoot">) {
  return(
    <tfootdata-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium[&>tr]:last:border-b-0",
        className)}
      {...props}
    />
  )
}

functionTableRow({ className, ...props}:React.ComponentProps<"tr">) {
  return(
    <trdata-slot="table-row"
      className={cn(
        "hover:bg-muted/50data-[state=selected]:bg-muted border-btransition-colors",
        className)}
      {...props}
    />
  )
}

functionTableHead({ className, ...props}:React.ComponentProps<"th">) {
  return(
    <thdata-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap[&:has([role=checkbox])]:pr-0[&>[role=checkbox]]:translate-y-[2px]",
        className)}
      {...props}
    />
  )
}

functionTableCell({ className, ...props}:React.ComponentProps<"td">) {
  return(
    <tddata-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap[&:has([role=checkbox])]:pr-0[&>[role=checkbox]]:translate-y-[2px]",
        className)}
      {...props}
    />
  )
}

functionTableCaption({
  className,
  ...props}:React.ComponentProps<"caption">) {
  return(
    <captiondata-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export{
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
