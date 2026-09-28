"useclient"

import* asReact from"react"
importuseEmblaCarousel, {
  typeUseEmblaCarouselType,
} from"embla-carousel-react"
import{ ArrowLeft, ArrowRight} from"lucide-react"

import{ cn} from"@/lib/utils"
import{ Button} from"@/components/ui/button"

typeCarouselApi= UseEmblaCarouselType[1] typeUseCarouselParameters= Parameters<typeofuseEmblaCarousel>
typeCarouselOptions= UseCarouselParameters[0] typeCarouselPlugin= UseCarouselParameters[1] typeCarouselProps= {
  opts?:CarouselOptionsplugins?:CarouselPluginorientation?:"horizontal" | "vertical"
  setApi?:(api:CarouselApi) => void}

typeCarouselContextProps= {
  carouselRef:ReturnType<typeofuseEmblaCarousel>[0] api:ReturnType<typeofuseEmblaCarousel>[1]scrollPrev:() => voidscrollNext:() => voidcanScrollPrev: booleancanScrollNext: boolean} & CarouselProps constCarouselContext= React.createContext<CarouselContextProps| null>(null)

functionuseCarousel() {
  const context= React.useContext(CarouselContext)

  if(!context) {
    throw newError("useCarousel must be used within a<Carousel/>")
  }

  return context}

functionCarousel({
  orientation= "horizontal",
  opts,
  setApi,
  plugins,
  className,
  children,
  ...props}:React.ComponentProps<"div"> & CarouselProps) {
  const[carouselRef, api]= useEmblaCarousel(
    {
      ...opts,
      axis: orientation=== "horizontal" ? "x" :"y",
    },
    plugins)
  const[canScrollPrev, setCanScrollPrev]= React.useState(false)
  const[canScrollNext, setCanScrollNext]= React.useState(false)

  constonSelect= React.useCallback((api:CarouselApi) => {
    if(!api) returnsetCanScrollPrev(api.canScrollPrev())
    setCanScrollNext(api.canScrollNext())
  }, [])

  constscrollPrev= React.useCallback(() => {
    api?.scrollPrev()
  }, [api])

  constscrollNext= React.useCallback(() => {
    api?.scrollNext()
  }, [api])

  consthandleKeyDown= React.useCallback(
    (event:React.KeyboardEvent<HTMLDivElement>) => {
      if(event.key=== "ArrowLeft") {
        event.preventDefault()
        scrollPrev()
      } else if(event.key=== "ArrowRight") {
        event.preventDefault()
        scrollNext()
      }
    },
    [scrollPrev, scrollNext])

  React.useEffect(() => {
    if(!api|| !setApi) returnsetApi(api)
  }, [api, setApi])

  React.useEffect(() => {
    if(!api) returnonSelect(api)
    api.on("reInit", onSelect)
    api.on("select", onSelect)

    return() => {
      api?.off("select", onSelect)
    }
  }, [api, onSelect])

  return(
    <CarouselContext.Providervalue={{
        carouselRef,
        api:api,
        opts,
        orientation: orientation|| (opts?.axis=== "y" ? "vertical" :"horizontal"),
        scrollPrev,
        scrollNext,
        canScrollPrev,
        canScrollNext,
      }}
    >
      <divonKeyDownCapture={handleKeyDown}
        className={cn("relative", className)}
        role="region"
        aria-roledescription="carousel"
        data-slot="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  )
}

functionCarouselContent({ className, ...props}:React.ComponentProps<"div">) {
  const{ carouselRef, orientation} = useCarousel()

  return(
    <divref={carouselRef}
      className="overflow-hidden"
      data-slot="carousel-content"
    >
      <div className={cn(
          "flex",
          orientation=== "horizontal" ? "-ml-4" :"-mt-4flex-col",
          className)}
        {...props}
      />
    </div>
  )
}

functionCarouselItem({ className, ...props}:React.ComponentProps<"div">) {
  const{ orientation} = useCarousel()

  return(
    <divrole="group"
      aria-roledescription="slide"
      data-slot="carousel-item"
      className={cn(
        "min-w-0 shrink-0 grow-0basis-full",
        orientation=== "horizontal" ? "pl-4" :"pt-4",
        className)}
      {...props}
    />
  )
}

functionCarouselPrevious({
  className,
  variant= "outline",
  size= "icon",
  ...props}:React.ComponentProps<typeofButton>) {
  const{ orientation, scrollPrev, canScrollPrev} = useCarousel()

  return(
    <Buttondata-slot="carousel-previous"
      variant={variant}
      size={size}
      className={cn(
        "absolute size-8 rounded-full",
        orientation=== "horizontal"
          ? "top-1/2 -left-12-translate-y-1/2"
          :"-top-12 left-1/2 -translate-x-1/2rotate-90",
        className)}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ArrowLeft/>
      <span className="sr-only">Previousslide</span>
    </Button>
  )
}

functionCarouselNext({
  className,
  variant= "outline",
  size= "icon",
  ...props}:React.ComponentProps<typeofButton>) {
  const{ orientation, scrollNext, canScrollNext} = useCarousel()

  return(
    <Buttondata-slot="carousel-next"
      variant={variant}
      size={size}
      className={cn(
        "absolute size-8 rounded-full",
        orientation=== "horizontal"
          ? "top-1/2 -right-12-translate-y-1/2"
          :"-bottom-12 left-1/2 -translate-x-1/2rotate-90",
        className)}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ArrowRight/>
      <span className="sr-only">Nextslide</span>
    </Button>
  )
}

export{
  typeCarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
}
