"useclient"

import* asReact from"react"
import* asRechartsPrimitive from"recharts"

import{ cn} from"@/lib/utils"

//Format:{ THEME_NAME:CSS_SELECTOR }
constTHEMES = { light:"", dark:".dark" } as const export typeChartConfig= {
  [k in string]:{
    label?:React.ReactNodeicon?:React.ComponentType} & (
    | { color?:string; theme?: never}
    | { color?:never; theme:Record<keyof typeofTHEMES, string> }
  )
}

typeChartContextProps= {
  config:ChartConfig}

constChartContext= React.createContext<ChartContextProps| null>(null)

functionuseChart() {
  const context= React.useContext(ChartContext)

  if(!context) {
    throw newError("useChart must be used within a<ChartContainer/>")
  }

  return context}

functionChartContainer({
  id,
  className,
  children,
  config,
  ...props}:React.ComponentProps<"div"> & {
  config:ChartConfig children:React.ComponentProps<
    typeofRechartsPrimitive.ResponsiveContainer>["children"]}) {
  constuniqueId= React.useId()
  constchartId= `chart-${id|| uniqueId.replace(/:/g, "")}`

  return(
    <ChartContext.Providervalue={{ config}}>
      <divdata-slot="chart"
        data-chart={chartId}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border[&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border[&_.recharts-radial-bar-background-sector]:fill-muted[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted[&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video justify-center text-xs[&_.recharts-dot[stroke='#fff']]:stroke-transparent[&_.recharts-layer]:outline-hidden[&_.recharts-sector]:outline-hidden[&_.recharts-sector[stroke='#fff']]:stroke-transparent[&_.recharts-surface]:outline-hidden",
          className)}
        {...props}
      >
        <ChartStyleid={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

constChartStyle= ({ id, config}:{ id:string; config:ChartConfig}) => {
  constcolorConfig= Object.entries(config).filter(
    ([, config]) => config.theme|| config.color)

  if(!colorConfig.length) {
    return null}

  return(
    <styledangerouslySetInnerHTML={{
        __html:Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}]{
${colorConfig.map(([key, itemConfig]) => {
    const color=
      itemConfig.theme?.[theme as keyof typeofitemConfig.theme]||
      itemConfig.color return color? `  --color-${key}:${color};` : null})
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  )
}

constChartTooltip= RechartsPrimitive.Tooltip functionChartTooltipContent({
  active,
  payload,
  className,
  indicator= "dot",
  hideLabel= false,
  hideIndicator= false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}:React.ComponentProps<typeofRechartsPrimitive.Tooltip> &
  React.ComponentProps<"div"> & {
    hideLabel?: booleanhideIndicator?: booleanindicator?:"line" | "dot" | "dashed"
    nameKey?: stringlabelKey?: string}) {
  const{ config} = useChart()

  consttooltipLabel= React.useMemo(() => {
    if(hideLabel|| !payload?.length) {
      return null}

    const [item]= payload const key= `${labelKey|| item?.dataKey|| item?.name|| "value"}`
    constitemConfig= getPayloadConfigFromPayload(config, item, key)
    const value=
      !labelKey&& typeof label=== "string"
        ? config[label as keyof typeofconfig]?.label|| label :itemConfig?.label if(labelFormatter) {
      return(
        <div className={cn("font-medium", labelClassName)}>
          {labelFormatter(value, payload)}
        </div>
      )
    }

    if(!value) {
      return null}

    return<div className={cn("font-medium", labelClassName)}>{value}</div>
  }, [label,
    labelFormatter,
    payload,
    hideLabel,
    labelClassName,
    config,
    labelKey,
  ])

  if(!active|| !payload?.length) {
    return null}

  constnestLabel= payload.length=== 1&& indicator!== "dot"

  return(
    <div className={cn(
        "border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xsshadow-xl",
        className)}
    >
      {!nestLabel? tooltipLabel :null}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key= `${nameKey|| item.name|| item.dataKey|| "value"}`
          constitemConfig= getPayloadConfigFromPayload(config, item, key)
          constindicatorColor= color|| item.payload.fill|| item.color return(
            <divkey={item.dataKey}
              className={cn(
                "[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2[&>svg]:h-2.5[&>svg]:w-2.5",
                indicator=== "dot" && "items-center"
              )}
            >
              {formatter&& item?.value!== undefined&& item.name? (
                formatter(item.value, item.name, item, index, item.payload)
              ) :(
                <>
                  {itemConfig?.icon? (
                    <itemConfig.icon/>
                  ) :(
                    !hideIndicator&& (
                      <div className={cn(
                          "shrink-0 rounded-[2px]border-(--color-border) bg-(--color-bg)",
                          {
                            "h-2.5 w-2.5": indicator=== "dot",
                            "w-1": indicator=== "line",
                            "w-0 border-[1.5px] border-dashedbg-transparent": indicator=== "dashed",
                            "my-0.5":nestLabel&& indicator=== "dashed",
                          }
                        )}
                        style={
                          {
                            "--color-bg":indicatorColor,
                            "--color-border":indicatorColor,
                          } asReact.CSSProperties}
                      />
                    )
                  )}
                  <div className={cn(
                      "flex flex-1 justify-between leading-none",
                      nestLabel? "items-end" :"items-center"
                    )}
                  >
                    <div className="grid gap-1.5">
                      {nestLabel? tooltipLabel :null}
                      <span className="text-muted-foreground">
                        {itemConfig?.label|| item.name}
                      </span>
                    </div>
                    {item.value&& (
                      <span className="text-foreground font-mono font-medium tabular-nums">
                        {item.value.toLocaleString()}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

constChartLegend= RechartsPrimitive.Legend functionChartLegendContent({
  className,
  hideIcon= false,
  payload,
  verticalAlign= "bottom",
  nameKey,
}:React.ComponentProps<"div"> &
  Pick<RechartsPrimitive.LegendProps, "payload" | "verticalAlign"> & {
    hideIcon?: booleannameKey?: string}) {
  const{ config} = useChart()

  if(!payload?.length) {
    return null}

  return(
    <div className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign=== "top" ? "pb-3" :"pt-3",
        className)}
    >
      {payload.map((item) => {
        const key= `${nameKey|| item.dataKey|| "value"}`
        constitemConfig= getPayloadConfigFromPayload(config, item, key)

        return(
          <divkey={item.value}
            className={cn(
              "[&>svg]:text-muted-foreground flex items-center gap-1.5[&>svg]:h-3[&>svg]:w-3"
            )}
          >
            {itemConfig?.icon&& !hideIcon? (
              <itemConfig.icon/>
            ) :(
              <div className="h-2 w-2 shrink-0rounded-[2px]"
                style={{
                  backgroundColor:item.color,
                }}
              />
            )}
            {itemConfig?.label}
          </div>
        )
      })}
    </div>
  )
}

//Helper to extract item config from a payload. functiongetPayloadConfigFromPayload(
  config:ChartConfig,
  payload:unknown,
  key: string) {
  if(typeof payload!== "object" || payload=== null) {
    return undefined}

  constpayloadPayload=
    "payload" in payload&&
    typeof payload.payload=== "object" &&
    payload.payload!== null? payload.payload : undefined letconfigLabelKey: string= key if(
    key in payload&&
    typeof payload[key as keyof typeof payload]=== "string"
  ) {
    configLabelKey= payload[key as keyof typeof payload] as string} else if(
    payloadPayload&&
    key inpayloadPayload&&
    typeofpayloadPayload[key as keyof typeofpayloadPayload]=== "string"
  ) {
    configLabelKey= payloadPayload[ key as keyof typeofpayloadPayload ] as string}

  returnconfigLabelKey in config? config[configLabelKey] : config[key as keyof typeof config]}

export{
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}
