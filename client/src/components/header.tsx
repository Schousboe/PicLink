import { useTheme } from "../hooks/use-theme";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Image } from "lucide-react";

export function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Image className="text-primary-foreground text-xl w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-card-foreground">PicLink</h1>
              <p className="text-xs text-muted-foreground">Simple Image Hosting</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              data-testid="button-theme-toggle"
              className="w-10 h-10 rounded-lg bg-accent hover:bg-accent/80"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-accent-foreground" />
              ) : (
                <Moon className="h-4 w-4 text-accent-foreground" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
