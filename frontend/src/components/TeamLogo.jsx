import React from "react";
import { getTeamLogo, hasTeamLogo, getTeamLogoScale } from "../constants/teamAssets";
import { getTeamColor } from "../constants/f1Colors";

// Compact initials for a constructor, e.g. "Toro Rosso" -> "TR", "Renault" -> "RE"
function initials(team) {
  const words = (team || "").replace(/F1 Team/i, "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Team logo with a graceful fallback: when no real logo image is shipped for
 * the constructor, render a transparent-background square monogram badge tinted
 * with the team colour instead of the generic F1 mark.
 *
 * Props: team, size (px), scale (extra img zoom), className
 */
export default function TeamLogo({ team, size = 20, scale = 1, className = "", style = {} }) {
  if (hasTeamLogo(team)) {
    const finalScale = scale * getTeamLogoScale(team);
    return (
      <img
        src={getTeamLogo(team)}
        alt={team}
        onError={(e) => { e.currentTarget.src = "/f1.svg"; }}
        className={`object-contain ${className}`}
        style={{ width: size, height: size, transform: finalScale !== 1 ? `scale(${finalScale})` : undefined, ...style }}
      />
    );
  }
  const color = getTeamColor(team);
  return (
    <div
      title={team}
      className={`flex items-center justify-center rounded-[4px] font-bold ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        color,
        border: `1.5px solid ${color}`,
        background: `${color}1f`, // ~12% tint, transparent otherwise
        letterSpacing: "0.02em",
        lineHeight: 1,
        ...style,
      }}
    >
      {initials(team)}
    </div>
  );
}
