"use client"

import * as React from "react"
import { Moon, Sun, Settings } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { UI_CONSTANTS } from "@/lib/utils"

export function SettingsModal() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [uiScale, setUiScale] = React.useState(100)

  React.useEffect(() => {
    setMounted(true)
    const savedScale = localStorage.getItem("ui-scale")
    if (savedScale) {
      const parsed = parseInt(savedScale)
      if (!isNaN(parsed) && parsed >= 50 && parsed <= 200) {
        setUiScale(parsed)
      }
    }
  }, [])

  React.useEffect(() => {
    if (!mounted) return
    document.documentElement.style.fontSize = `${uiScale}%`
    localStorage.setItem("ui-scale", uiScale.toString())
  }, [uiScale, mounted])

  if (!mounted) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full focus-visible:ring-0">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={`w-80 ${UI_CONSTANTS.padding}`}>
        <div className={`grid ${UI_CONSTANTS.gap}`}>
          <div className="flex items-center justify-between space-x-2">
            <div className="flex flex-col space-y-1">
              <Label htmlFor="dark-mode">Dark Mode</Label>
              <span className="text-xs text-muted-foreground">
                Switch between light and dark themes.
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Sun className="h-4 w-4 text-muted-foreground" />
              <Switch
                id="dark-mode"
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              />
              <Moon className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="flex items-center justify-between space-x-2">
            <div className="flex flex-col space-y-1">
              <Label htmlFor="ui-scale">UI Scale</Label>
              <span className="text-xs text-muted-foreground">
                Adjust the interface size ({uiScale}%).
              </span>
            </div>
            <div className="w-[120px]">
              <Slider
                id="ui-scale"
                min={75}
                max={125}
                step={5}
                value={[uiScale]}
                onValueChange={(val) => setUiScale(val[0])}
              />
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
