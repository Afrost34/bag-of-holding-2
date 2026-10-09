import {
  Anchor,
  Beer,
  Bird,
  BookOpen,
  Bug,
  Castle,
  Church,
  Coins,
  Compass,
  Crown,
  DoorOpen,
  Drama,
  Eye,
  Factory,
  Fish,
  Flag,
  Flame,
  Footprints,
  Gem,
  Ghost,
  Hammer,
  Heart,
  House,
  Key,
  Landmark,
  Leaf,
  MapPin,
  Mountain,
  MountainSnow,
  Sailboat,
  School,
  Scroll,
  Shield,
  Ship,
  Skull,
  Sparkles,
  Star,
  Store,
  Swords,
  Tent,
  TowerControl,
  TreeDeciduous,
  TreePine,
  Trees,
  Warehouse,
  Waves,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/** Icons for map pins (bundled, so they work offline), by id. */
export const PIN_ICONS: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: 'map-pin', label: 'Pin', Icon: MapPin },
  { id: 'castle', label: 'Castle', Icon: Castle },
  { id: 'tower', label: 'Tower', Icon: TowerControl },
  { id: 'house', label: 'House', Icon: House },
  { id: 'landmark', label: 'Hall', Icon: Landmark },
  { id: 'church', label: 'Temple', Icon: Church },
  { id: 'school', label: 'Academy', Icon: School },
  { id: 'store', label: 'Shop', Icon: Store },
  { id: 'beer', label: 'Tavern', Icon: Beer },
  { id: 'warehouse', label: 'Warehouse', Icon: Warehouse },
  { id: 'factory', label: 'Workshop', Icon: Factory },
  { id: 'hammer', label: 'Smithy', Icon: Hammer },
  { id: 'tent', label: 'Camp', Icon: Tent },
  { id: 'door', label: 'Entrance', Icon: DoorOpen },
  { id: 'anchor', label: 'Harbour', Icon: Anchor },
  { id: 'ship', label: 'Ship', Icon: Ship },
  { id: 'sailboat', label: 'Boat', Icon: Sailboat },
  { id: 'mountain', label: 'Mountain', Icon: Mountain },
  { id: 'mountain-snow', label: 'Peak', Icon: MountainSnow },
  { id: 'trees', label: 'Forest', Icon: Trees },
  { id: 'tree-pine', label: 'Pine', Icon: TreePine },
  { id: 'tree', label: 'Tree', Icon: TreeDeciduous },
  { id: 'leaf', label: 'Grove', Icon: Leaf },
  { id: 'wheat', label: 'Farm', Icon: Wheat },
  { id: 'waves', label: 'Water', Icon: Waves },
  { id: 'fish', label: 'Fishing', Icon: Fish },
  { id: 'bird', label: 'Wildlife', Icon: Bird },
  { id: 'bug', label: 'Monster lair', Icon: Bug },
  { id: 'skull', label: 'Danger', Icon: Skull },
  { id: 'swords', label: 'Battle', Icon: Swords },
  { id: 'shield', label: 'Fort', Icon: Shield },
  { id: 'crown', label: 'Capital', Icon: Crown },
  { id: 'flag', label: 'Border', Icon: Flag },
  { id: 'gem', label: 'Treasure', Icon: Gem },
  { id: 'coins', label: 'Market', Icon: Coins },
  { id: 'key', label: 'Secret', Icon: Key },
  { id: 'scroll', label: 'Quest', Icon: Scroll },
  { id: 'book', label: 'Library', Icon: BookOpen },
  { id: 'drama', label: 'Theatre', Icon: Drama },
  { id: 'ghost', label: 'Haunted', Icon: Ghost },
  { id: 'flame', label: 'Fire', Icon: Flame },
  { id: 'sparkles', label: 'Magic', Icon: Sparkles },
  { id: 'eye', label: 'Lookout', Icon: Eye },
  { id: 'footprints', label: 'Trail', Icon: Footprints },
  { id: 'compass', label: 'Landmark', Icon: Compass },
  { id: 'star', label: 'Important', Icon: Star },
  { id: 'heart', label: 'Ally', Icon: Heart },
];

export const pinIcon = (id: string | null | undefined) => PIN_ICONS.find((i) => i.id === id);

const svgs = new Map<string, string>();

/** An icon as SVG markup, in a colour (made once, then kept). */
export function pinIconSvg(
  id: string,
  color: string,
  size = 64,
  /** Line width (a halo under an inked icon is drawn wider). */
  strokeWidth = 2.25,
): string | null {
  const key = `${id}|${color}|${String(size)}|${String(strokeWidth)}`;
  const cached = svgs.get(key);
  if (cached) return cached;
  const icon = pinIcon(id);
  if (!icon) return null;
  const svg = renderToStaticMarkup(
    createElement(icon.Icon, {
      color,
      size,
      strokeWidth,
      xmlns: 'http://www.w3.org/2000/svg',
    }),
  );
  svgs.set(key, svg);
  return svg;
}
