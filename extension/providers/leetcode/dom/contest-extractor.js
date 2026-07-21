export class ContestExtractor {
  extract() {
    return Array.from(document.querySelectorAll('a[href*="/contest/"]'))
      .map((link) => ({
        contestTitle: link.textContent?.trim() || null,
        url: link.href || null
      }))
      .filter((item) => item.contestTitle);
  }
}
