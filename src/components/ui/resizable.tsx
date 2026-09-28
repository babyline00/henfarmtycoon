"useclient"

import* asReact from"react"
import{ GripVerticalIcon} from"lucide-react"
import* asResizablePrimitive from"react-resizable-panels"

import{ cn} from"@/lib/utils"

functionResizablePanelGroup({
  className,
  ...props}:React.ComponentProps<typeofResizablePrimitive.PanelGroup>) {
  return(
    <ResizablePrimitive.PanelGroupdata-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-fulldata-[panel-group-direction=vertical]:flex-col",
        className)}
      {...props}
    />
  )
}

functionResizablePanel({
  ...props}:React.ComponentProps<typeofResizablePrimitive.Panel>) {
  return<ResizablePrimitive.Paneldata-slot="resizable-panel" {...props} />
}

functionResizableHandle({
  withHandle,
  className,
  ...props}:React.ComponentProps<typeofResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean}) {
  return(
    <ResizablePrimitive.PanelResizeHandledata-slot="resizable-handle"
      className={cn(
        "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hiddendata-[panel-group-direction=vertical]:h-pxdata-[panel-group-direction=vertical]:w-fulldata-[panel-group-direction=vertical]:after:left-0data-[panel-group-direction=vertical]:after:h-1data-[panel-group-direction=vertical]:after:w-fulldata-[panel-group-direction=vertical]:after:translate-x-0data-[panel-group-direction=vertical]:after:-translate-y-1/2[&[data-panel-group-direction=vertical]>div]:rotate-90",
        className)}
      {...props}
    >
      {withHandle&& (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xsborder">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </ResizablePrimitive.PanelResizeHandle>
  )
}

export{ ResizablePanelGroup, ResizablePanel, ResizableHandle}
