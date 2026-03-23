import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Factory,
  Warehouse,
  RefreshCcw,
  DollarSign,
  Layers,
  Clock,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Fornitori", url: "/suppliers", icon: Users },
  { title: "Articoli", url: "/items", icon: Package },
  { title: "Distinte Base", url: "/bom", icon: Layers },
];

const operationsItems = [
  { title: "Ordini Fornitori", url: "/purchase-orders", icon: FileText },
  { title: "Ordini Produzione", url: "/production-orders", icon: Factory },
  { title: "Magazzino", url: "/inventory", icon: Warehouse },
  { title: "Lotti", url: "/lots", icon: Clock },
];

const analyticsItems = [
  { title: "Costi", url: "/costs", icon: DollarSign },
  { title: "Riordino", url: "/reorder", icon: RefreshCcw },
];

function SidebarSection({
  label,
  items,
  collapsed,
}: {
  label: string;
  items: typeof mainItems;
  collapsed: boolean;
}) {
  return (
    <SidebarGroup>
      {!collapsed && (
        <SidebarGroupLabel className="text-muted-foreground/60 uppercase text-[10px] tracking-widest font-mono">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  end={item.url === "/"}
                  className="hover:bg-sidebar-accent/50 transition-colors"
                  activeClassName="bg-sidebar-accent text-primary font-medium"
                >
                  <item.icon className="mr-2 h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm font-mono">CF</span>
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-foreground font-semibold text-sm tracking-tight">ChainFlow</h1>
              <p className="text-muted-foreground text-[10px] font-mono uppercase tracking-wider">
                SCM Platform
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection label="Principale" items={mainItems} collapsed={collapsed} />
        <SidebarSection label="Operazioni" items={operationsItems} collapsed={collapsed} />
        <SidebarSection label="Analytics" items={analyticsItems} collapsed={collapsed} />
      </SidebarContent>
    </Sidebar>
  );
}
