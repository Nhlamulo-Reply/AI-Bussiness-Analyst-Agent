import { MoreHorizontal, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";

interface MoveToBinMenuProps {
  itemLabel: string;
  disabled?: boolean;
  onMoveToBin: () => void;
}

export function MoveToBinMenu({
  itemLabel,
  disabled = false,
  onMoveToBin,
}: MoveToBinMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideInteraction = (event: Event) => {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target) &&
        !popoverRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const closeOnResize = () => setOpen(false);

    document.addEventListener("pointerdown", closeOnOutsideInteraction);
    document.addEventListener("scroll", closeOnOutsideInteraction, true);
    window.addEventListener("resize", closeOnResize);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideInteraction);
      document.removeEventListener("scroll", closeOnOutsideInteraction, true);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [open]);

  const toggleMenu = () => {
    if (open) {
      setOpen(false);
      return;
    }

    const bounds = triggerRef.current?.getBoundingClientRect();
    if (bounds) {
      const menuWidth = 154;
      const menuHeight = 42;
      const edgePadding = 8;
      const topFits = bounds.bottom + menuHeight + edgePadding <= window.innerHeight;
      setPosition({
        top: topFits
          ? bounds.bottom + 5
          : Math.max(edgePadding, bounds.top - menuHeight - 5),
        left: Math.min(
          Math.max(edgePadding, bounds.right - menuWidth),
          window.innerWidth - menuWidth - edgePadding,
        ),
      });
    }
    setOpen(true);
  };

  const popover = open ? (
    <div
      className="move-to-bin-menu__popover"
      id={menuId}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
      ref={popoverRef}
      style={{ top: position.top, left: position.left }}
    >
      <button
        className="move-to-bin-menu__action"
        disabled={disabled}
        onClick={() => {
          setOpen(false);
          onMoveToBin();
        }}
        type="button"
      >
        <Trash2 aria-hidden="true" size={15} />
        <span>Move to bin</span>
      </button>
    </div>
  ) : null;

  return (
    <div
      className="move-to-bin-menu"
      ref={menuRef}
    >
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-label={`More actions for ${itemLabel}`}
        className="move-to-bin-menu__trigger"
        onClick={toggleMenu}
        ref={triggerRef}
        title="More actions"
        type="button"
      >
        <MoreHorizontal aria-hidden="true" size={18} />
      </button>
      {popover && typeof document !== "undefined"
        ? createPortal(popover, document.body)
        : null}
    </div>
  );
}
