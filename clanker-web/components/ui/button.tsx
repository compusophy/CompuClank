"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { haptics } from "@/lib/haptics"

type HapticType = 'light' | 'medium' | 'heavy' | 'golden' | 'none'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 hover:brightness-110",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-primary/30 bg-background shadow-sm hover:bg-accent hover:border-primary/50 hover:shadow-md dark:bg-input/30 dark:border-primary/20 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm hover:shadow-md",
        ghost:
          "hover:bg-accent/80 hover:text-accent-foreground dark:hover:bg-accent/50 hover:scale-105",
        link: "text-primary underline-offset-4 hover:underline",
        golden: "btn-golden text-primary-foreground font-semibold",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  haptic = "light",
  onClick,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Haptic feedback intensity: 'light', 'medium', 'heavy', 'golden', or 'none' */
    haptic?: HapticType
  }) {
  const Comp = asChild ? Slot : "button"

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      // Trigger haptic feedback based on type
      if (haptic !== 'none') {
        switch (haptic) {
          case 'golden':
            haptics.goldenPulse()
            break
          case 'heavy':
            haptics.heavyAction()
            break
          case 'medium':
            haptics.cardTap()
            break
          case 'light':
          default:
            haptics.buttonPress()
            break
        }
      }
      // Call original onClick handler
      onClick?.(e)
    },
    [haptic, onClick]
  )

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      onClick={handleClick}
      {...props}
    />
  )
}

export { Button, buttonVariants }
