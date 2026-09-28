"useclient"

import* asReact from"react"
import{
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from"lucide-react"
import{ DayButton, DayPicker, getDefaultClassNames} from"react-day-picker"

import{ cn} from"@/lib/utils"
import{ Button, buttonVariants} from"@/components/ui/button"

functionCalendar({
  className,
  classNames,
  showOutsideDays= true,
  captionLayout= "label",
  buttonVariant= "ghost",
  formatters,
  components,
  ...props}:React.ComponentProps<typeofDayPicker> & {
  buttonVariant?:React.ComponentProps<typeofButton>["variant"]}) {
  constdefaultClassNames= getDefaultClassNames()

  return(
    <DayPickershowOutsideDays={showOutsideDays}
      className={cn(
        "bg-background group/calendar p-3[--cell-size:--spacing(8)][[data-slot=card-content]_&]:bg-transparent[[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className)}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown:(date) =>
          date.toLocaleString("default", { month:"short" }),
        ...formatters,
      }}
      classNames={{
        root:cn("w-fit", defaultClassNames.root),
        months:cn(
          "flex gap-4 flex-col md:flex-rowrelative",
          defaultClassNames.months),
        month:cn("flex flex-col w-full gap-4", defaultClassNames.month),
        nav:cn(
          "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between",
          defaultClassNames.nav),
        button_previous:cn(
          buttonVariants({ variant:buttonVariant}),
          "size-(--cell-size) aria-disabled:opacity-50 p-0 select-none",
          defaultClassNames.button_previous),
        button_next:cn(
          buttonVariants({ variant:buttonVariant}),
          "size-(--cell-size) aria-disabled:opacity-50 p-0 select-none",
          defaultClassNames.button_next),
        month_caption:cn(
          "flex items-center justify-centerh-(--cell-size) w-fullpx-(--cell-size)",
          defaultClassNames.month_caption),
        dropdowns:cn(
          "w-full flex items-center text-sm font-medium justify-centerh-(--cell-size) gap-1.5",
          defaultClassNames.dropdowns),
        dropdown_root:cn(
          "relative has-focus:border-ring border border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px]rounded-md",
          defaultClassNames.dropdown_root),
        dropdown:cn(
          "absolute bg-popover inset-0opacity-0",
          defaultClassNames.dropdown),
        caption_label:cn(
          "select-none font-medium",
          captionLayout=== "label"
            ? "text-sm"
            :"rounded-md pl-2 pr-1 flex items-center gap-1 text-sm h-8[&>svg]:text-muted-foreground[&>svg]:size-3.5",
          defaultClassNames.caption_label),
        table:"w-fullborder-collapse",
        weekdays:cn("flex", defaultClassNames.weekdays),
        weekday:cn(
          "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem]select-none",
          defaultClassNames.weekday),
        week:cn("flex w-full mt-2", defaultClassNames.week),
        week_number_header:cn(
          "select-nonew-(--cell-size)",
          defaultClassNames.week_number_header),
        week_number:cn(
          "text-[0.8rem] select-nonetext-muted-foreground",
          defaultClassNames.week_number),
        day:cn(
          "relative w-full h-full p-0 text-center[&:first-child[data-selected=true]_button]:rounded-l-md[&:last-child[data-selected=true]_button]:rounded-r-md group/day aspect-square select-none",
          defaultClassNames.day),
        range_start:cn(
          "rounded-l-mdbg-accent",
          defaultClassNames.range_start),
        range_middle:cn("rounded-none", defaultClassNames.range_middle),
        range_end:cn("rounded-r-mdbg-accent", defaultClassNames.range_end),
        today:cn(
          "bg-accent text-accent-foreground rounded-mddata-[selected=true]:rounded-none",
          defaultClassNames.today),
        outside:cn(
          "text-muted-foregroundaria-selected:text-muted-foreground",
          defaultClassNames.outside),
        disabled:cn(
          "text-muted-foregroundopacity-50",
          defaultClassNames.disabled),
        hidden:cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root:({ className, rootRef, ...props}) => {
          return(
            <divdata-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Chevron:({ className, orientation, ...props}) => {
          if(orientation=== "left") {
            return(
              <ChevronLeftIcon className={cn("size-4", className)} {...props} />
            )
          }

          if(orientation=== "right") {
            return(
              <ChevronRightIcon className={cn("size-4", className)}
                {...props}
              />
            )
          }

          return(
            <ChevronDownIcon className={cn("size-4", className)} {...props} />
          )
        },
        DayButton:CalendarDayButton,
        WeekNumber:({ children, ...props}) => {
          return(
            <td{...props}>
              <div className="flexsize-(--cell-size) items-center justify-centertext-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

functionCalendarDayButton({
  className,
  day,
  modifiers,
  ...props}:React.ComponentProps<typeofDayButton>) {
  constdefaultClassNames= getDefaultClassNames()

  const ref= React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if(modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return(
    <Buttonref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected&&
        !modifiers.range_start&&
        !modifiers.range_end&&
        !modifiers.range_middle}
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "data-[selected-single=true]:bg-primarydata-[selected-single=true]:text-primary-foregrounddata-[range-middle=true]:bg-accentdata-[range-middle=true]:text-accent-foregrounddata-[range-start=true]:bg-primarydata-[range-start=true]:text-primary-foregrounddata-[range-end=true]:bg-primarydata-[range-end=true]:text-primary-foregroundgroup-data-[focused=true]/day:border-ringgroup-data-[focused=true]/day:ring-ring/50 dark:hover:text-accent-foreground flex aspect-square size-auto w-fullmin-w-(--cell-size) flex-col gap-1 leading-none font-normalgroup-data-[focused=true]/day:relativegroup-data-[focused=true]/day:z-10group-data-[focused=true]/day:ring-[3px]data-[range-end=true]:rounded-mddata-[range-end=true]:rounded-r-mddata-[range-middle=true]:rounded-nonedata-[range-start=true]:rounded-mddata-[range-start=true]:rounded-l-md[&>span]:text-xs[&>span]:opacity-70",
        defaultClassNames.day,
        className)}
      {...props}
    />
  )
}

export{ Calendar, CalendarDayButton}
