import type { ImgHTMLAttributes } from "react";

export function BrandLogo({ variant = "light", height = 48, className, ...props }: ImgHTMLAttributes<HTMLImageElement> & { variant?: "light" | "dark"; height?: number }) {
  const src = variant === "dark" ? "/logo-extinfy-dark.png" : "/logo-extinfy-light.png";
  return <img src={src} alt="Extinfy" height={height} style={{ height, width: "auto" }} className={className} {...props} />;
}
