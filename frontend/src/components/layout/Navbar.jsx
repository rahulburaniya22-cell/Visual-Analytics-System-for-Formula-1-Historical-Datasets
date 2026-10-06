import React from "react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/season", label: "Season" },
  { to: "/race/2024_1", label: "Race" },
  { to: "/drivers", label: "Drivers" },
  { to: "/strategy", label: "Strategy" },
];

export default function Navbar() {
  return (
    <nav className="bg-[#111111] border-b border-[#222] px-6 py-3 flex items-center gap-8">
      <NavLink to="/" className="text-xl font-bold text-[#e10600] tracking-wide">
        F1 Analytics
      </NavLink>
      <div className="flex gap-6">
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `text-sm font-medium pb-1 border-b-2 transition-colors ${
                isActive
                  ? "text-white border-[#e10600]"
                  : "text-gray-400 border-transparent hover:text-white"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
