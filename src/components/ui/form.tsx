"useclient"

import* asReact from"react"
import* asLabelPrimitive from"@radix-ui/react-label"
import{ Slot} from"@radix-ui/react-slot"
import{
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  typeControllerProps,
  typeFieldPath,
  typeFieldValues,
} from"react-hook-form"

import{ cn} from"@/lib/utils"
import{ Label} from"@/components/ui/label"

constForm= FormProvider typeFormFieldContextValue<
  TFieldValues extendsFieldValues= FieldValues,
  TName extendsFieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name:TName}

constFormFieldContext= React.createContext<FormFieldContextValue>(
  {} asFormFieldContextValue)

constFormField= <
  TFieldValues extendsFieldValues= FieldValues,
  TName extendsFieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props}:ControllerProps<TFieldValues, TName>) => {
  return(
    <FormFieldContext.Providervalue={{ name: props.name}}>
      <Controller{...props} />
    </FormFieldContext.Provider>
  )
}

constuseFormField= () => {
  constfieldContext= React.useContext(FormFieldContext)
  constitemContext= React.useContext(FormItemContext)
  const{ getFieldState} = useFormContext()
  constformState= useFormState({ name:fieldContext.name})
  constfieldState= getFieldState(fieldContext.name, formState)

  if(!fieldContext) {
    throw newError("useFormField should be used within<FormField>")
  }

  const{ id} = itemContext return{
    id,
    name:fieldContext.name,
    formItemId:`${id}-form-item`,
    formDescriptionId:`${id}-form-item-description`,
    formMessageId:`${id}-form-item-message`,
    ...fieldState,
  }
}

typeFormItemContextValue= {
  id: string}

constFormItemContext= React.createContext<FormItemContextValue>(
  {} asFormItemContextValue)

functionFormItem({ className, ...props}:React.ComponentProps<"div">) {
  const id= React.useId()

  return(
    <FormItemContext.Providervalue={{ id}}>
      <divdata-slot="form-item"
        className={cn("grid gap-2", className)}
        {...props}
      />
    </FormItemContext.Provider>
  )
}

functionFormLabel({
  className,
  ...props}:React.ComponentProps<typeofLabelPrimitive.Root>) {
  const{ error, formItemId} = useFormField()

  return(
    <Labeldata-slot="form-label"
      data-error={!!error}
      className={cn("data-[error=true]:text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  )
}

functionFormControl({ ...props}:React.ComponentProps<typeofSlot>) {
  const{ error, formItemId, formDescriptionId, formMessageId} = useFormField()

  return(
    <Slotdata-slot="form-control"
      id={formItemId}
      aria-describedby={
        !error? `${formDescriptionId}`
          :`${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  )
}

functionFormDescription({ className, ...props}:React.ComponentProps<"p">) {
  const{ formDescriptionId} = useFormField()

  return(
    <pdata-slot="form-description"
      id={formDescriptionId}
      className={cn("text-muted-foregroundtext-sm", className)}
      {...props}
    />
  )
}

functionFormMessage({ className, ...props}:React.ComponentProps<"p">) {
  const{ error, formMessageId} = useFormField()
  const body= error? String(error?.message?? "") : props.children if(!body) {
    return null}

  return(
    <pdata-slot="form-message"
      id={formMessageId}
      className={cn("text-destructivetext-sm", className)}
      {...props}
    >
      {body}
    </p>
  )
}

export{
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
}
