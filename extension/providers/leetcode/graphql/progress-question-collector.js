import { ExtensionError, ErrorKind } from '../../../utils/errors.js';
import { LeetCodeConfig } from '../config.js';
import { LeetCodeGraphQLOperation } from './queries.js';
import { LeetCodeGraphQLParsers } from '../parsers/graphql-parsers.js';
import { normalizeProgressQuestion } from '../normalizers/leetcode-normalizer.js';
import { createQuestionDataset } from '../models/question-dataset.js';

function dedupeQuestions(questions) {
  const seen = new Set();
  const deduped = [];

  for (const question of questions) {
    const key = question.slug || question.questionId || question.frontendId;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(question);
  }

  return deduped;
}

function logStageError(logger, stageName, error) {
  logger?.error(`Stage name: ${stageName}`);
  logger?.error(`Exception message: ${error?.message || 'Unknown error'}`);
  logger?.error(`Complete stack trace: ${error?.stack || 'No stack trace available'}`);
}

export class UserProgressQuestionCollector {
  constructor({ client, logger, config = LeetCodeConfig.progressQuestionList } = {}) {
    this.client = client;
    this.logger = logger;
    this.config = config;
  }

  async collect(options = {}) {
    const startedAt = performance.now();

    try {
      if (!this.client) {
        throw new ExtensionError('LeetCode GraphQL client is required for progress collection', {
          kind: ErrorKind.PROVIDER
        });
      }

      const limit = Number(options.limit || this.config.limit || 50);
      const sortField = options.sortField || this.config.sortField;
      const sortOrder = options.sortOrder || this.config.sortOrder;
      const rawQuestions = [];
      const pageKeys = new Set();
      let totalNum = null;
      let skip = Number(options.skip || 0);
      let page = 0;

      this.logger?.debug('Collector starting');
      this.logger?.debug('Executing userProgressQuestionList');

      while (totalNum === null || rawQuestions.length < totalNum) {
        page += 1;
        let parsed;

        try {
          const data = await this.client.execute(LeetCodeGraphQLOperation.USER_PROGRESS_QUESTION_LIST, {
            skip,
            limit,
            sortField,
            sortOrder
          });
          parsed = LeetCodeGraphQLParsers[LeetCodeGraphQLOperation.USER_PROGRESS_QUESTION_LIST](data);
        } catch (error) {
          logStageError(this.logger, `Pagination page ${page}`, error);
          throw error;
        }

        const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
        totalNum = Number.isFinite(parsed.totalNum) ? parsed.totalNum : rawQuestions.length + questions.length;

        this.logger?.debug(`Page number: ${page}`);
        this.logger?.debug(`Questions received: ${questions.length}`);
        this.logger?.debug(`Running total: ${rawQuestions.length + questions.length}`);
        this.logger?.debug(`totalNum: ${totalNum}`);
        this.logger?.debug(`skip: ${skip}`);
        this.logger?.debug(`limit: ${limit}`);

        const pageKey = questions
          .map((question) => question?.titleSlug || question?.questionId || question?.frontendId)
          .filter(Boolean)
          .join('|');

        if (pageKey && pageKeys.has(pageKey)) {
          this.logger?.debug(`Page ${page} skipped duplicate`);
          this.logger?.debug('Pagination complete');
          break;
        }
        if (pageKey) pageKeys.add(pageKey);

        rawQuestions.push(...questions);
        this.logger?.debug(`Page ${page} collected`);

        if (questions.length === 0 || rawQuestions.length >= totalNum) {
          this.logger?.debug('Pagination complete');
          break;
        }

        this.logger?.debug('Fetching next page');
        skip += limit;
      }

      let normalizedQuestions;
      try {
        this.logger?.debug('Starting normalization');
        normalizedQuestions = dedupeQuestions(rawQuestions.map(normalizeProgressQuestion));
        this.logger?.debug('Questions normalized');
        this.logger?.debug(`Number normalized: ${normalizedQuestions.length}`);
      } catch (error) {
        logStageError(this.logger, 'Normalization', error);
        throw error;
      }

      let dataset;
      try {
        dataset = createQuestionDataset({
          questions: normalizedQuestions,
          totalNum: totalNum || normalizedQuestions.length,
          pagesCollected: page
        });
        this.logger?.debug('Dataset created');
        this.logger?.debug(`Question count: ${dataset.questions.length}`);
      } catch (error) {
        logStageError(this.logger, 'Dataset creation', error);
        throw error;
      }

      this.logger?.debug('Analytics complete');
      this.logger?.debug(`Total solved: ${dataset.analytics.totalSolved}`);
      this.logger?.debug(`Solved last month: ${dataset.analytics.solvedLast30Days}`);
      this.logger?.debug(`Solved last year: ${dataset.analytics.solvedLastYear}`);
      this.logger?.debug(`Easy: ${dataset.analytics.easySolved}`);
      this.logger?.debug(`Medium: ${dataset.analytics.mediumSolved}`);
      this.logger?.debug(`Hard: ${dataset.analytics.hardSolved}`);
      this.logger?.debug(`Topic count: ${dataset.analytics.topicFrequency.length}`);
      this.logger?.debug('Collection complete');
      this.logger?.debug(`Questions collected: ${dataset.questions.length}`);
      this.logger?.debug('Normalization complete');
      this.logger?.debug(`Collection completed successfully`);
      this.logger?.debug(`Questions: ${dataset.questions.length}`);
      this.logger?.debug(`Pages: ${dataset.pagesCollected}`);
      this.logger?.debug(`Duration: ${Math.round(performance.now() - startedAt)}ms`);

      return dataset;
    } catch (error) {
      logStageError(this.logger, 'userProgressQuestionList collection', error);
      throw error;
    }
  }
}
