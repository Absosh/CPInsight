const express = require('express');
const pool = require('../database/pool');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// Debug endpoint to see raw submissions
router.get('/submissions/:platform', authenticate, async (req, res) => {
  try {
    const { platform } = req.params;
    
    // Get platform account
    const account = await pool.query(
      'SELECT id, platform, handle FROM platform_accounts WHERE user_id = $1 AND platform = $2',
      [req.user.id, platform]
    );
    
    if (account.rowCount === 0) {
      return res.json({ error: 'No account', accountId: null, submissionCount: 0, submissions: [] });
    }
    
    const accountId = account.rows[0].id;
    
    // Get submissions
    const result = await pool.query(
      'SELECT id, platform, problem_key, problem_name, verdict, submitted_at, tags, difficulty FROM submission_history WHERE platform_account_id = $1 LIMIT 10',
      [accountId]
    );
    
    res.json({
      platform,
      handle: account.rows[0].handle,
      accountId,
      totalCount: (await pool.query('SELECT COUNT(*) FROM submission_history WHERE platform_account_id = $1', [accountId])).rows[0].count,
      submissions: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug: Check current user and their accounts
router.get('/user-accounts', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const accounts = await pool.query(
      'SELECT id, platform, handle, rating, max_rating, sync_status, last_synced_at FROM platform_accounts WHERE user_id = $1',
      [userId]
    );
    
    const submissions = await pool.query(
      'SELECT COUNT(*) as count FROM submission_history'
    );
    
    res.json({
      userId,
      accounts: accounts.rows,
      totalSubmissionsInDb: submissions.rows[0].count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
