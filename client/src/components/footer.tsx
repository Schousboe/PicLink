import { Image } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card mt-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-3 mb-4 md:mb-0">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Image className="text-primary-foreground w-4 h-4" />
            </div>
            <span className="font-semibold text-card-foreground">PicLink</span>
          </div>
          <div className="flex space-x-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-primary transition-colors">Contact</a>
            <a href="#" className="hover:text-primary transition-colors">API Docs</a>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-border text-center text-sm text-muted-foreground">
          <p>&copy; 2024 PicLink. All rights reserved. Built with React, TypeScript, and Tailwind CSS.</p>
        </div>
      </div>
    </footer>
  );
}
