export class SubmissionExtractor {
  extract() {
    return Array.from(document.querySelectorAll('a[href*="/problems/"]'))
      .map((link) => {
        const href = link.getAttribute('href') || '';
        const slug = href.match(/\/problems\/([^/]+)/)?.[1] || null;
        const title = link.textContent?.trim() || null;
        return { title, titleSlug: slug };
      })
      .filter((item, index, items) => item.titleSlug && items.findIndex((candidate) => candidate.titleSlug === item.titleSlug) === index);
  }
}
