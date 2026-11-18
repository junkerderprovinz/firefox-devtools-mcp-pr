/**
 * Element collection and relevance filtering (runs in browser context)
 */

/**
 * Interactive element tags
 */
const INTERACTIVE_TAGS = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'img',
  'video',
  'audio',
  'iframe',
];

/**
 * Semantic container tags
 */
const SEMANTIC_TAGS = ['nav', 'main', 'section', 'article', 'header', 'footer', 'form'];

/**
 * Common container tags (need additional checks)
 */
const CONTAINER_TAGS = ['div', 'span', 'p', 'li', 'ul', 'ol'];

/**
 * Max direct text content length for containers
 */
const MAX_DIRECT_TEXT_CONTENT = 500;

/**
 * Check if element is visible
 * Checks current element and all ancestors up to documentElement
 */
export function isVisible(el: Element): boolean {
  if (el?.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  // Check current element and all ancestors
  let current: Element | null = el;
  while (current && current !== document.documentElement) {
    try {
      const style = window.getComputedStyle(current);
      // Parse opacity as number to handle '0', '0.0', '0.00', etc.
      const opacity = parseFloat(style.opacity);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        opacity === 0 ||
        isNaN(opacity)
      ) {
        return false;
      }
    } catch {
      return false;
    }
    // A slotted element is rendered at its slot, so the slot's ancestors decide whether it shows
    current =
      current.assignedSlot ??
      current.parentElement ??
      (current.getRootNode() as ShadowRoot).host ??
      null;
  }

  return true;
}

/**
 * Child nodes of an element in the flat tree, which is what gets rendered: a shadow host shows its
 * shadow root, and a slot shows its assigned nodes or, if there are none, its fallback content.
 * Slots are display: contents by default, so their nodes take their place.
 */
export function getFlatTreeChildNodes(el: Element): Node[] {
  const nodes: Node[] = [];
  const addNodes = (childNodes: ArrayLike<Node>) => {
    for (let i = 0; i < childNodes.length; i++) {
      const node = childNodes[i]!;
      // A slot outside a shadow tree is an ordinary element that renders its children
      if ((node as Element).localName !== 'slot' || !(node.getRootNode() as ShadowRoot).host) {
        nodes.push(node);
      } else if (window.getComputedStyle(node as Element).display !== 'none') {
        const assigned = (node as HTMLSlotElement).assignedNodes();
        addNodes(assigned.length > 0 ? assigned : node.childNodes);
      }
    }
  };
  addNodes((el.shadowRoot ?? el).childNodes);
  return nodes;
}

/**
 * Child elements of an element in the flat tree
 */
export function getFlatTreeChildren(el: Element): Element[] {
  return getFlatTreeChildNodes(el).filter(
    (node): node is Element => node.nodeType === Node.ELEMENT_NODE
  );
}

/**
 * Get direct text content (not including descendants)
 */
function getDirectTextContent(el: Element): string {
  let text = '';
  for (const node of getFlatTreeChildNodes(el)) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || '';
    }
  }
  return text.trim();
}

/**
 * Check if element has interactive descendants
 */
function hasInteractiveDescendant(el: Element): boolean {
  for (const child of getFlatTreeChildren(el)) {
    const tag = child.tagName.toLowerCase();
    if (INTERACTIVE_TAGS.indexOf(tag) !== -1 || child.hasAttribute('role')) {
      return true;
    }
  }
  return false;
}

/**
 * Check if element is relevant for snapshot
 * Filters out hidden/irrelevant elements
 */
export function isRelevant(el: Element): boolean {
  if (el?.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  // Check visibility
  if (!isVisible(el)) {
    return false;
  }

  const tag = el.tagName.toLowerCase();

  // Always include interactive elements
  if (INTERACTIVE_TAGS.indexOf(tag) !== -1) {
    return true;
  }

  // Include elements with role
  if (el.hasAttribute('role')) {
    return true;
  }

  // Include elements with aria-label
  if (el.hasAttribute('aria-label')) {
    return true;
  }

  // Include headings
  if (/^h[1-6]$/.test(tag)) {
    return true;
  }

  // Include semantic elements
  if (SEMANTIC_TAGS.indexOf(tag) !== -1) {
    return true;
  }

  // Common containers - need additional checks
  if (CONTAINER_TAGS.indexOf(tag) !== -1) {
    // Has meaningful direct text (not from descendants)?
    const directText = getDirectTextContent(el);
    if (directText.length > 0 && directText.length < MAX_DIRECT_TEXT_CONTENT) {
      return true;
    }
    // Has id or class?
    if (el.id || el.className) {
      return true;
    }
    // Has interactive descendants?
    if (hasInteractiveDescendant(el)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if element is focusable
 */
export function isFocusable(el: Element): boolean {
  const htmlEl = el as HTMLElement;

  // Has tabindex >= 0
  if (htmlEl.tabIndex >= 0) {
    return true;
  }

  // Naturally focusable elements
  const tag = el.tagName.toLowerCase();
  if (['a', 'button', 'input', 'select', 'textarea'].indexOf(tag) !== -1) {
    return true;
  }

  return false;
}

/**
 * Check if element is interactive
 */
export function isInteractive(el: Element): boolean {
  const tag = el.tagName.toLowerCase();

  // Interactive tags
  if (INTERACTIVE_TAGS.indexOf(tag) !== -1) {
    return true;
  }

  // Has click handler role
  const role = el.getAttribute('role');
  if (role && ['button', 'link', 'menuitem', 'tab'].indexOf(role) !== -1) {
    return true;
  }

  // Has onclick or similar
  if (el.hasAttribute('onclick')) {
    return true;
  }

  return false;
}
