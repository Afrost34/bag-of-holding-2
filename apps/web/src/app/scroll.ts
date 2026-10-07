/**
 * Scrolls an element to the top of its nearest scrolling container only. `scrollIntoView` also
 * scrolls every ancestor, including the app shell's `overflow: hidden` frame, which shifts the
 * tab bar off screen.
 */
export function scrollToElement(
  element: Element,
  options: { offset?: number; smooth?: boolean } = {},
): void {
  let scroller = element.parentElement;
  while (scroller) {
    const overflowY = getComputedStyle(scroller).overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      scroller.scrollHeight > scroller.clientHeight
    ) {
      break;
    }
    scroller = scroller.parentElement;
  }
  if (!scroller) return;
  const top =
    element.getBoundingClientRect().top -
    scroller.getBoundingClientRect().top +
    scroller.scrollTop -
    (options.offset ?? 16);
  scroller.scrollTo({ top: Math.max(0, top), behavior: options.smooth ? 'smooth' : 'auto' });
}
