import { AppConfig } from '../config/defaults.js';

export class CodeforcesApiClient {
  constructor({ baseUrl = AppConfig.liveMonitoring.codeforcesApiBaseUrl } = {}) {
    this.baseUrl = baseUrl;
  }

  async userStatus(handle, { from = 1, count = 25 } = {}) {
    const url = `${this.baseUrl}/user.status?handle=${encodeURIComponent(handle)}&from=${from}&count=${count}`;
    const response = await fetch(url);
    const payload = await response.json();
    if (payload.status !== 'OK') throw new Error(payload.comment || 'Codeforces user.status failed');
    return payload.result || [];
  }

  async contestStandings(contestId, handle) {
    const url = `${this.baseUrl}/contest.standings?contestId=${encodeURIComponent(contestId)}&handles=${encodeURIComponent(handle)}&showUnofficial=true`;
    const response = await fetch(url);
    const payload = await response.json();
    if (payload.status !== 'OK') throw new Error(payload.comment || 'Codeforces contest.standings failed');
    return payload.result || {};
  }
}
