"useclient"

import{ useTheme} from"next-themes"
import{ Toaster asSonner, ToasterProps} from"sonner"

constToaster= ({ ...props}:ToasterProps) => {
  const{ theme= "system" } = useTheme()

  return(
    <Sonnertheme={theme asToasterProps["theme"]}
      className="toastergroup"
      style={
        {
          "--normal-bg":"var(--popover)",
          "--normal-text":"var(--popover-foreground)",
          "--normal-border":"var(--border)",
        } asReact.CSSProperties}
      {...props}
    />
  )
}

export{ Toaster}
