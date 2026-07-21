export class StatsExtractor {
  extract() {
    const text = document.body?.innerText || '';
    const solvedMatch = text.match(/Solved\s+(\d+)/i);
    const rankingMatch = text.match(/Ranking\s+#?\s*([\d,]+)/i);

    return {
      solvedTotal: solvedMatch ? Number(solvedMatch[1]) : null,
      ranking: rankingMatch ? Number(rankingMatch[1].replace(/,/g, '')) : null
    };
  }
}
