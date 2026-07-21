const pool = require('../database/pool');
const { delByPattern } = require('../redis/client');
const codeforcesClient = require('./platforms/codeforcesClient');
const codechefClient = require('./platforms/codechefClient');
const leetcodeClient = require('./platforms/leetcodeClient');
const HttpError = require('../utils/httpError');

const platformClients = {
  codeforces: codeforcesClient,
  codechef: codechefClient,
  leetcode: leetcodeClient
};

async function syncPlatformAccount(userId, account, options = {}) {
  const db = options.db || pool;
  const throwOnError = Boolean(options.throwOnError);
  const { id: accountId, platform, handle } = account;
  const client = platformClients[platform];
    if (!client) {
      throw new Error(`No client for platform: ${platform}`);
    }

  if (platform === 'leetcode') {
    await db.query(
      `UPDATE platform_accounts
       SET sync_status = CASE WHEN last_synced_at IS NULL THEN 'pending_extension_upload' ELSE sync_status END,
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
       WHERE id = $1`,
      [
        accountId,
        JSON.stringify({
          leetcodeSyncMode: 'authenticated_extension',
          publicSyncDeprecatedAt: new Date().toISOString()
        })
      ]
    );
    return {
      platform,
      handle,
      status: 'pending_extension_upload',
      message: 'LeetCode uses the CPInsight browser extension as the canonical sync source.'
    };
  }

  try {
    console.log(`Syncing ${platform} account: ${handle}`);

    // Fetch submissions based on platform support
    let submissions = [];
    let contests = [];
    let userInfo = null;
    let metadataPatch = null;

    if (platform === 'codeforces' && client.getUserSubmissions) {
      // Codeforces has full API support
      [submissions, contests] = await Promise.all([
        client.getUserSubmissions(handle).catch(e => {
          console.error(`Failed to fetch ${platform} submissions for ${handle}:`, e.message);
          if (throwOnError) throw e;
          return [];
        }),
        client.getUserRating(handle).catch(e => {
          console.error(`Failed to fetch ${platform} contests for ${handle}:`, e.message);
          if (throwOnError) throw e;
          return [];
        })
      ]);

      userInfo = await client.getUserInfo(handle).catch(e => {
        console.error(`Failed to fetch ${platform} user info for ${handle}:`, e.message);
        if (throwOnError) throw e;
        return null;
      });
    } else if (platform === 'leetcode' && client.getPublicProfile) {
      // LeetCode has limited API (GraphQL)
      userInfo = await client.getPublicProfile(handle).catch(e => {
        console.error(`Failed to fetch ${platform} profile for ${handle}:`, e.message);
        if (throwOnError) throw e;
        return null;
      });

      const calendar = client.getUserCalendar
        ? await client.getUserCalendar(handle).catch(e => {
          console.error(`Failed to fetch ${platform} calendar for ${handle}:`, e.message);
          return null;
        })
        : null;

      const acceptedSubmissionStats = (userInfo?.submitStatsGlobal?.acSubmissionNum || [])
        .find((stat) => (stat.difficulty || '').toString().toLowerCase() === 'all');
      const expectedAcceptedSubmissions = Number(acceptedSubmissionStats?.submissions);
      const expectedAcceptedCount = Number.isInteger(expectedAcceptedSubmissions) && expectedAcceptedSubmissions > 0
        ? expectedAcceptedSubmissions
        : null;

      if (!expectedAcceptedCount) {
        throw new Error(`LeetCode accepted submission count unavailable for ${handle}`);
      }

      const acceptedSubmissions = client.getAllAcceptedSubmissions
        ? await client.getAllAcceptedSubmissions(handle, expectedAcceptedCount).catch(e => {
          console.error(`Failed to fetch complete ${platform} accepted submissions for ${handle}:`, e.message);
          throw e;
        })
        : [];
      
      if (userInfo?.submitStatsGlobal) {
        // Persist aggregate stats by difficulty (used for accurate KPI totals).
        const stats = userInfo.submitStatsGlobal.acSubmissionNum;
        const statsByDifficulty = {};
        for (const stat of stats || []) {
          const key = (stat.difficulty || '').toString().toLowerCase();
          if (!key) continue;
          statsByDifficulty[key] = {
            count: Number(stat.count || 0),
            submissions: Number(stat.submissions || 0)
          };
        }
        metadataPatch = { ...(metadataPatch || {}), leetcodeStats: statsByDifficulty };
      }

      if (Array.isArray(acceptedSubmissions) && acceptedSubmissions.length > 0) {
        submissions = acceptedSubmissions.map((item) => ({
          id: item.id || `leetcode-${handle}-${item.titleSlug || item.title || item.timestamp}`,
          problem: {
            name: item.title || item.titleSlug || 'LeetCode Problem',
            slug: item.titleSlug || null,
            rating: null
          },
          verdict: 'AC',
          creationTimeSeconds: Number(item.timestamp || 0)
        })).filter((item) => Number.isFinite(item.creationTimeSeconds) && item.creationTimeSeconds > 0);
      }

      if (calendar?.dayCounts && Object.keys(calendar.dayCounts).length > 0) {
        metadataPatch = {
          ...(metadataPatch || {}),
          leetcodeCalendar: {
            activeYears: calendar.activeYears || [],
            streak: Number(calendar.streak || 0),
            totalActiveDays: Number(calendar.totalActiveDays || 0),
            dayCounts: calendar.dayCounts
          }
        };

      }
    } else if (platform === 'codechef' && client.getPublicProfile) {
      const codechefData = await client.getPublicProfile(handle);

      if (!codechefData?.profile) {
        throw new HttpError(400, `CodeChef handle not found: ${handle}`, null, 'INVALID_HANDLE');
      }

      userInfo = codechefData.profile;
      submissions = Array.isArray(codechefData.submissions) ? codechefData.submissions : [];
      contests = Array.isArray(codechefData.contests) ? codechefData.contests : [];
      metadataPatch = {
        ...(metadataPatch || {}),
        codechefStats: codechefData.stats || {},
        codechefHeatmap: codechefData.heatmap || {},
        codechefProfile: {
          stars: codechefData.profile?.stars || null,
          globalRank: codechefData.profile?.globalRank || null,
          countryRank: codechefData.profile?.countryRank || null,
          institution: codechefData.profile?.institution || null,
          country: codechefData.profile?.country || null,
          totalProblemsSolved: codechefData.profile?.totalProblemsSolved || 0
        }
      };
    }

    if (!userInfo) {
      throw new HttpError(400, `${platform} handle not found: ${handle}`, null, 'INVALID_HANDLE');
    }

    if (userInfo) {
      // Update platform account with rating
      let rating = null;
      let maxRating = null;

      if (platform === 'codeforces') {
        rating = userInfo.rating || null;
        maxRating = userInfo.maxRating || null;
      } else if (platform === 'leetcode' && userInfo.profile) {
        rating = userInfo.profile.ranking || null;
      } else if (platform === 'codechef') {
        rating = userInfo.currentRating || null;
        maxRating = userInfo.maximumRating || null;
      }

      await db.query(
        `UPDATE platform_accounts
         SET rating = $1,
             max_rating = $2,
             metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE($4::jsonb, '{}'::jsonb),
             last_synced_at = NOW(),
             sync_status = 'synced'
         WHERE id = $3`,
        [rating, maxRating, accountId, metadataPatch ? JSON.stringify(metadataPatch) : null]
      );
    }

    // Clear existing data for this account
    await db.query('DELETE FROM submission_history WHERE platform_account_id = $1', [accountId]);
    await db.query('DELETE FROM contest_history WHERE platform_account_id = $1', [accountId]);

    // Insert submissions
    console.log('Platform:', platform);
    console.log('Submission count:', submissions.length);

    if (platform === 'leetcode') {
        console.log(
            submissions.slice(0, 5).map(s => ({
                id: s.id,
                title: s.problem?.name,
                slug: s.problem?.slug,
                verdict: s.verdict,
                ts: s.creationTimeSeconds
            }))
        );
    }
    if (submissions && Array.isArray(submissions)) {
      for (const submission of submissions) {
        try {
          const externalId = submission.id || `${platform}-${handle}-${submission.creationTimeSeconds}`;
          const tags = submission.problem?.tags || [];
          
          await db.query(
            `INSERT INTO submission_history 
             (platform_account_id, platform, external_submission_id, problem_key, problem_name, 
              verdict, submitted_at, tags, difficulty, language, contest_key)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (platform_account_id, external_submission_id) DO NOTHING`,
            [
              accountId,
              platform,
              externalId,
              submission.problem?.slug || [submission.problem?.contestId, submission.problem?.index].filter(Boolean).join('') || submission.problem?.name || externalId,
              submission.problem?.name || 'Unknown Problem',
              submission.verdict || 'UNKNOWN',
              new Date(submission.creationTimeSeconds * 1000),
              tags,
              submission.problem?.rating || null,
              submission.language || null,
              submission.problem?.contestId || null
            ]
          );
        } catch (e) {
          console.error(`Failed to insert submission for ${platform}:`, e.message);
          if (throwOnError) throw e;
        }
      }
    }

    // Insert contests (from ratings)
    if (contests && Array.isArray(contests)) {
      for (const contest of contests) {
        try {
          const externalId = contest.contestId || `${platform}-${handle}-${contest.ratingUpdateTimeSeconds}`;
          
          await db.query(
            `INSERT INTO contest_history 
             (platform_account_id, platform, external_contest_id, contest_name, 
              rating_before, rating_after, rating_delta, participated_at, rank)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (platform_account_id, external_contest_id) DO NOTHING`,
            [
              accountId,
              platform,
              externalId,
              contest.contestName || 'Unknown Contest',
              contest.oldRating ?? null,
              contest.newRating ?? null,
              contest.ratingDelta ?? (
                contest.newRating != null && contest.oldRating != null
                  ? contest.newRating - contest.oldRating
                  : null
              ),
              new Date(contest.ratingUpdateTimeSeconds * 1000),
              contest.rank || null
            ]
          );
        } catch (e) {
          console.error(`Failed to insert contest for ${platform}:`, e.message);
          if (throwOnError) throw e;
        }
      }
    }

    // Invalidate persisted analytics cache for this user so resyncs never serve stale derived data.
    await db.query(
      `DELETE FROM analytics_cache
       WHERE user_id = $1`,
      [userId]
    );
    await delByPattern(`analytics:${userId}:*`).catch(() => {});

    console.log(`Synced ${platform} account: ${handle} successfully`);
    return { platform, handle, submissionsCount: submissions?.length || 0, contestsCount: contests?.length || 0 };
  } catch (error) {
    console.error(`Error syncing ${platform} account ${handle}:`, error);
    if (throwOnError) {
      throw error;
    }
    // Mark as failed but don't throw
    await db.query(
      `UPDATE platform_accounts SET sync_status = 'failed', last_synced_at = NOW() WHERE id = $1`,
      [accountId]
    );
    return { platform, handle, error: error.message };
  }
}


async function syncUserPlatforms(userId) {
  try {
    // Get all connected accounts for this user
    const result = await pool.query(
      'SELECT * FROM platform_accounts WHERE user_id = $1 ORDER BY platform',
      [userId]
    );

    const accounts = result.rows;
    if (accounts.length === 0) {
      return { success: true, message: 'No accounts to sync', synced: [] };
    }

    const syncResults = [];
    for (const account of accounts) {
      const syncResult = await syncPlatformAccount(userId, account);
      syncResults.push(syncResult);
    }

    return {
      success: true,
      message: `Synced ${syncResults.length} platform accounts`,
      synced: syncResults
    };
  } catch (error) {
    console.error('Error in syncUserPlatforms:', error);
    return {
      success: false,
      message: error.message,
      synced: []
    };
  }
}

module.exports = { syncUserPlatforms, syncPlatformAccount };
