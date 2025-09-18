import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";

interface NavigationProps {
  currentPage?: string;
}

export default function Navigation({ currentPage }: NavigationProps) {
  const { t } = useTranslation();
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: "fas fa-home", label: t('nav.home'), key: "home" },
    { href: "/explore", icon: "fas fa-compass", label: t('nav.explore'), key: "explore" },
    { href: "/share-links", icon: "fas fa-link", label: t('nav.shareLinks'), key: "share-links" },
    { href: "/profile", icon: "fas fa-user", label: t('nav.profile'), key: "profile" },
  ];

  const isActive = (href: string, key: string) => {
    if (currentPage) return currentPage === key;
    return location === href;
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border">
      <div className="flex items-center justify-around py-3">
        {navItems.map((item) => (
          <Link key={item.key} href={item.href}>
            <button
              className={`flex flex-col items-center space-y-1 px-3 py-2 transition-colors ${
                isActive(item.href, item.key)
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid={`nav-${item.key}`}
            >
              <i className={`${item.icon} text-lg`}></i>
              <span className="text-xs">{item.label}</span>
            </button>
          </Link>
        ))}
      </div>
    </nav>
  );
}
