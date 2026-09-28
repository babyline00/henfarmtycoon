"useclient"

import* asAspectRatioPrimitive from"@radix-ui/react-aspect-ratio"

functionAspectRatio({
  ...props}:React.ComponentProps<typeofAspectRatioPrimitive.Root>) {
  return<AspectRatioPrimitive.Rootdata-slot="aspect-ratio" {...props} />
}

export{ AspectRatio}
