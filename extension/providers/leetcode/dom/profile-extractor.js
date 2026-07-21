import { LeetCodeConfig } from '../config.js';

function firstText(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = element?.textContent?.trim();
    if (text) return text;
  }
  return null;
}

function firstAttribute(selectors, attribute) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const value = element?.getAttribute(attribute);
    if (value) return value;
  }
  return null;
}

export class ProfileExtractor {
  extract() {
    const profileHref = firstAttribute(LeetCodeConfig.selectors.profileLinks, 'href');
    const username = profileHref?.match(/\/(?:u|profile)\/([^/]+)/)?.[1] || null;
    const rankingText = firstText(LeetCodeConfig.selectors.ranking);

    return {
      username,
      avatarUrl: firstAttribute(LeetCodeConfig.selectors.avatar, 'src'),
      ranking: rankingText ? Number(rankingText.replace(/[^\d]/g, '')) || null : null,
      realName: document.querySelector('h1, [class*="real-name" i]')?.textContent?.trim() || null
    };
  }
}
