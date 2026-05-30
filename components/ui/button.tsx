import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  asChild?: boolean;
  href?: string;
};

export function Button({ className, variant = "default", size = "md", asChild, href, children, ...props }: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
    variant === "default" && "bg-primary text-primary-foreground hover:bg-orange-300",
    variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-cyan-300",
    variant === "ghost" && "hover:bg-white/10",
    variant === "outline" && "border border-white/15 bg-white/5 hover:bg-white/10",
    size === "sm" && "h-8 px-3 text-sm",
    size === "md" && "h-10 px-4 text-sm",
    size === "lg" && "h-12 px-5 text-base",
    size === "icon" && "h-10 w-10",
    className
  );
  if (asChild && href) return <Link href={href} className={classes}>{children}</Link>;
  return <button className={classes} {...props}>{children}</button>;
}
