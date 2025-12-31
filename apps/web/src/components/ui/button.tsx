import { Slot } from '@radix-ui/react-slot';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'ghost';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: Variant;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, asChild = false, variant = 'primary', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const base =
      'inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50';
    const styles: Record<Variant, string> = {
      primary: 'bg-slate-900 text-white hover:bg-slate-800',
      ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 border border-slate-200',
    };
    return (
      <Comp className={cn(base, styles[variant], className)} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';
