import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/compass", label: "Home" },
  { to: "/dividend-aristocrats", label: "Aristocrats" },
  { to: "/compass/hd-income", label: "HD Income" },
  { to: "/compass/about", label: "About" },
];

export function CompassLayout() {
  return (
    <div className="min-h-screen bg-white font-sans text-[#0B1F1A] antialiased">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <NavLink to="/compass" className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-white"
              style={{ backgroundColor: "#0F6E56" }}
            >
              DC
            </span>
            <span className="text-lg font-semibold tracking-tight">
              Dividend<span style={{ color: "#0F6E56" }}>Compass</span>
            </span>
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/compass"}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-[#0F6E56]"
                      : "text-neutral-700 hover:text-[#0F6E56]"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile nav */}
          <nav className="flex items-center gap-3 md:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/compass"}
                className={({ isActive }) =>
                  `text-xs font-medium ${
                    isActive ? "text-[#0F6E56]" : "text-neutral-600"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="mt-24 border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-neutral-500 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} DividendCompass
        </div>
      </footer>
    </div>
  );
}
