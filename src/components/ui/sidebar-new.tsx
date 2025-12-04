
'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, PanelLeft } from 'lucide-react';

export const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-4', className)} {...props} />
));
SidebarFooter.displayName = 'SidebarFooter';


const SidebarContext = React.createContext<{
    isCollapsed: boolean;
    toggleCollapse: () => void;
  } | null>(null);
  
  export function useSidebar() {
    const context = React.useContext(SidebarContext);
    if (!context) {
      throw new Error('useSidebar must be used within a Sidebar');
    }
    return context;
  }

export const Sidebar = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
    const [isCollapsed, setIsCollapsed] = React.useState(false);
    
    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    }

    return (
        <SidebarContext.Provider value={{ isCollapsed, toggleCollapse }}>
            <div
                ref={ref}
                className={cn(
                'relative bg-primary text-primary-foreground transition-all duration-300 ease-in-out flex flex-col h-screen sticky top-0',
                isCollapsed ? 'w-16' : 'w-80',
                className
                )}
                {...props}
            >
                {children}
                <div className="absolute -right-4 bottom-4 hidden lg:block">
                    <Button
                        variant="secondary"
                        size="icon"
                        className="rounded-full h-8 w-8 bg-card text-card-foreground hover:bg-card/80"
                        onClick={toggleCollapse}
                    >
                        <ChevronLeft className={cn("h-4 w-4 transition-transform", isCollapsed && "rotate-180")} />
                    </Button>
                </div>
            </div>
        </SidebarContext.Provider>
    )
});
Sidebar.displayName = 'Sidebar';


export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
    const { isCollapsed } = useSidebar();
    return (
        <div
            ref={ref}
            className={cn(
            'p-4 transition-all duration-300 flex flex-col items-center',
            isCollapsed && 'p-2',
            className
            )}
            {...props}
        />
    )
});
SidebarHeader.displayName = 'SidebarHeader';

export const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex-1 overflow-y-auto', className)} {...props} />
));
SidebarContent.displayName = 'SidebarContent';

export const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => {
    const { isCollapsed } = useSidebar();
    return (
        <ul
            ref={ref}
            className={cn(
                'space-y-2 p-2',
                isCollapsed && 'flex flex-col items-center',
                className
            )}
            {...props}
        />
    )
});
SidebarMenu.displayName = 'SidebarMenu';


export const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn('w-full', className)} {...props} />
));
SidebarMenuItem.displayName = 'SidebarMenuItem';

export const SidebarMenuButton = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    active?: boolean;
  }
>(({ className, children, active = false, ...props }, ref) => {
    const { isCollapsed } = useSidebar();
    const childrenArray = React.Children.toArray(children);
    const icon = childrenArray[0];
    const label = childrenArray[1];

  return (
    <a
      ref={ref}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary-foreground/10 text-green-300 hover:text-green-200 hover:bg-primary-foreground/15'
          : 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground',
        isCollapsed && 'justify-center',
        className
      )}
      {...props}
    >
      {icon}
      {!isCollapsed && label}
    </a>
  );
});
SidebarMenuButton.displayName = 'SidebarMenuButton';

export const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, ...props }, ref) => {
  const { toggleCollapse } = useSidebar();

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7', className)}
      onClick={toggleCollapse}
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
});
SidebarTrigger.displayName = 'SidebarTrigger';
