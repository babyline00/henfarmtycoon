"useclient"

import{ useToast} from"@/hooks/use-toast"
import{
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from"@/components/ui/toast"

export functionToaster() {
  const{ toasts} = useToast()

  return(
    <ToastProvider>
      {toasts.map(function({ id, title, description, action, ...props}) {
        return(
          <Toastkey={id} {...props}>
            <div className="grid gap-1">
              {title&& <ToastTitle>{title}</ToastTitle>}
              {description&& (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose/>
          </Toast>
        )
      })}
      <ToastViewport/>
    </ToastProvider>
  )
}