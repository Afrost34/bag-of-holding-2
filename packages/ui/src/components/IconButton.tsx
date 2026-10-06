import { forwardRef, type ReactNode } from 'react';
import { Button, type ButtonProps } from './Button';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'size'> {
  /** Accessible name, also shown as the tooltip. */
  label: string;
  icon: ReactNode;
  size?: 'icon' | 'icon-sm';
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, size = 'icon', variant = 'ghost', tooltipSide, ...props },
  ref,
) {
  return (
    <Tooltip label={label} {...(tooltipSide ? { side: tooltipSide } : {})}>
      <Button ref={ref} aria-label={label} size={size} variant={variant} {...props}>
        {icon}
      </Button>
    </Tooltip>
  );
});
