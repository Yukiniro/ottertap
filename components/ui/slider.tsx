import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "@/lib/utils"

function Slider({
  "aria-label": ariaLabel,
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  size = "default",
  ...props
}: SliderPrimitive.Root.Props & {
  size?: "default" | "pill"
}) {
  const _values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min, max]

  return (
    <SliderPrimitive.Root
      aria-label={ariaLabel}
      className={cn("group/slider data-horizontal:w-full data-vertical:h-full", className)}
      data-slot="slider"
      data-size={size}
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col group-data-[size=pill]/slider:size-full! group-data-[size=pill]/slider:min-h-0! group-data-[size=pill]/slider:cursor-ns-resize group-data-[size=pill]/slider:rounded-[inherit]">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full bg-muted select-none data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1 group-data-[size=pill]/slider:absolute group-data-[size=pill]/slider:inset-0 group-data-[size=pill]/slider:w-full! group-data-[size=pill]/slider:rounded-[inherit] group-data-[size=pill]/slider:bg-background group-data-[size=pill]/slider:ring-1 group-data-[size=pill]/slider:ring-border"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary transition-colors select-none data-horizontal:h-full data-vertical:w-full group-data-[boost=true]/slider:bg-(--volume-boost)"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            aria-label={ariaLabel}
            data-slot="slider-thumb"
            key={index}
            className="relative block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50 group-data-[size=pill]/slider:h-[10px]! group-data-[size=pill]/slider:w-[28px]! group-data-[size=pill]/slider:border-2 group-data-[size=pill]/slider:border-primary group-data-[size=pill]/slider:bg-background group-data-[size=pill]/slider:shadow-[0_1px_4px_#15112933] group-data-[size=pill]/slider:transition-[scale,border-color,box-shadow] group-data-[size=pill]/slider:duration-150 group-data-[size=pill]/slider:after:-inset-4 group-data-[size=pill]/slider:hover:scale-110 group-data-[size=pill]/slider:group-data-dragging/slider:scale-125 group-data-[boost=true]/slider:border-(--volume-boost)!"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
