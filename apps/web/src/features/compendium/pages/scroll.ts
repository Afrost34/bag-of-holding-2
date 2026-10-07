import { scrollToElement } from '../../../app/scroll';

/** Scrolls to a section of the page (the app uses hash routing, so no #anchors). */
export function scrollToSection(id: string): void {
  const element = document.getElementById(id);
  if (element) scrollToElement(element, { smooth: true });
}
