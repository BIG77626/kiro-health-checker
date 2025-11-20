/**
 * ServiceContainer - 服务容器
 * 
 * 职责：
 * - 统一创建和管理所有服务实例
 * - 依赖注入的入口点
 * - 确保单例模式
 * 
 * Iron Laws (clean-architecture):
 * - ALL SERVICES CREATED HERE
 * - PAGES ONLY GET, NEVER NEW
 * - DEPENDENCY INJECTION ENFORCED
 * 
 * @see .claude/skills/quick-refs/CLEAN-ARCHITECTURE-CHECKLIST.md
 */

const BehaviorTracker = require('../../infrastructure/services/BehaviorTracker');
const FeedbackService = require('./FeedbackService');
const ShortTermFeedbackService = require('./ShortTermFeedbackService');
const FeedbackAggregationService = require('./FeedbackAggregationService');
const StorageAdapter = require('../../../adapters/StorageAdapter');
const UploaderAdapter = require('../../../adapters/UploaderAdapter');
const MockAIService = require('../../infrastructure/adapters/ai/MockAIService');

class ServiceContainer {
  constructor() {
    this._services = {};
    this._initialized = false;
  }
  
  /**
   * 初始化所有服务
   * 
   * @param {Object} config - 全局配置
   */
  init(config) {
    if (this._initialized) {
      console.warn('[ServiceContainer] Already initialized');
      return;
    }
    
    try {
      // 1. 创建Logger (可选)
      const logger = config.logger || null;
      
      // 2. 创建Adapters
      const storageAdapter = new StorageAdapter(logger);
      const uploaderAdapter = new UploaderAdapter(
        {
          baseUrl: config.apiBaseUrl || '',
          timeout: config.uploadTimeout || 30000,
          maxRetries: config.maxRetries || 3,
          retryDelay: config.retryDelay || 2000
        },
        logger
      );
      
      // 3. 创建BehaviorTracker
      const behaviorTracker = new BehaviorTracker(
        {
          maxBufferSize: config.maxBufferSize || 10,
          flushInterval: config.flushInterval || 30000
        },
        storageAdapter,
        uploaderAdapter,
        logger
      );
      
      // 4. 创建FeedbackService (P1-002)
      const feedbackService = new FeedbackService(
        {
          maxBufferSize: config.maxBufferSize || 10,
          flushInterval: config.flushInterval || 30000,
          storageKey: 'feedback_events' // P1-004修复：与aggregator统一使用feedback_events
        },
        storageAdapter,
        uploaderAdapter,
        logger
      );
      
      // 5. 创建AI服务（短期反馈使用）
      const aiService = new MockAIService();

      // 6. 创建短期反馈服务 (P1-003)
      const shortTermFeedbackService = new ShortTermFeedbackService(
        {
          responseTimeout: config.shortTermFeedbackTimeout || 2000,
          maxHistoryItems: config.shortTermFeedbackMaxHistory || 200,
          storageKey: 'short_term_feedback_history'
        },
        aiService,
        storageAdapter,
        uploaderAdapter,
        logger
      );

      // 7. 创建中期反馈聚合服务 (P1-004)
      // 注意：参数顺序 config, aiService, storage, uploader, logger
      const feedbackAggregationService = new FeedbackAggregationService(
        {
          aggregationTimeout: config.aggregationTimeout || 30000,
          minFeedbackCount: config.minFeedbackCount || 50,
          storageKey: 'feedback_aggregation_results'
        },
        aiService,        // ✅ 第2个参数：AI服务
        storageAdapter,   // ✅ 第3个参数：存储服务
        uploaderAdapter,
        logger
      );

      // 8. 注册服务
      this._services.behaviorTracker = behaviorTracker;
      this._services.feedbackService = feedbackService;
      this._services.shortTermFeedbackService = shortTermFeedbackService;
      this._services.feedbackAggregationService = feedbackAggregationService;
      this._services.storageAdapter = storageAdapter;
      this._services.uploaderAdapter = uploaderAdapter;
      this._services.aiService = aiService;
      
      this._initialized = true;
      
      console.log('[ServiceContainer] Initialized successfully');
    } catch (e) {
      console.error('[ServiceContainer] Initialization failed', e);
      throw e;
    }
  }
  
  /**
   * 获取BehaviorTracker实例
   * 
   * @returns {BehaviorTracker}
   */
  getBehaviorTracker() {
    if (!this._initialized) {
      throw new Error('ServiceContainer not initialized');
    }
    return this._services.behaviorTracker;
  }
  
  /**
   * 获取StorageAdapter实例
   * 
   * @returns {StorageAdapter}
   */
  getStorageAdapter() {
    if (!this._initialized) {
      throw new Error('ServiceContainer not initialized');
    }
    return this._services.storageAdapter;
  }
  
  /**
   * 获取FeedbackService实例 (P1-002)
   * 
   * @returns {FeedbackService}
   */
  getFeedbackService() {
    if (!this._initialized) {
      throw new Error('ServiceContainer not initialized');
    }
    return this._services.feedbackService;
  }

  /**
   * 获取短期反馈服务实例 (P1-003)
   * @returns {ShortTermFeedbackService}
   */
  getShortTermFeedbackService() {
    if (!this._initialized) {
      throw new Error('ServiceContainer not initialized');
    }
    return this._services.shortTermFeedbackService;
  }

  /**
   * 获取中期反馈聚合服务实例 (P1-004)
   * @returns {FeedbackAggregationService}
   */
  getFeedbackAggregationService() {
    if (!this._initialized) {
      throw new Error('ServiceContainer not initialized');
    }
    return this._services.feedbackAggregationService;
  }
  
  /**
   * 获取UploaderAdapter实例
   * 
   * @returns {UploaderAdapter}
   */
  getUploaderAdapter() {
    if (!this._initialized) {
      throw new Error('ServiceContainer not initialized');
    }
    return this._services.uploaderAdapter;
  }
  
  /**
   * 重置服务容器（仅用于测试）
   */
  reset() {
    this._services = {};
    this._initialized = false;
  }
}

// 导出单例
module.exports = new ServiceContainer();
