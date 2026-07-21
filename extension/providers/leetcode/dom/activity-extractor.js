export class ActivityExtractor {
  extract() {
    const cells = Array.from(document.querySelectorAll('[data-date], rect[data-date], [aria-label*="submission" i]'));
    return cells.map((cell) => ({
      date: cell.getAttribute('data-date') || null,
      label: cell.getAttribute('aria-label') || null
    })).filter((item) => item.date || item.label);
  }
}
