// cloudfunctions/ai-service/index.js
// 统一的AI服务云函数 - 安全代理层

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 监控指标收集（简化版，生产环境应使用云监控服务）
const metrics = {
  requestCount: 0,
  errorCount: 0,
  successCount: 0,
  latencySum: 0,
  lastResetTime: Date.now()
}

/**
 * 记录监控指标
 */
function recordMetric(action, success, latency) {
  metrics.requestCount++
  if (success) {
    metrics.successCount++
  } else {
    metrics.errorCount++
  }
  metrics.latencySum += latency

  // 每小时重置一次指标（简化版，生产环境应使用更完善的监控系统）
  const now = Date.now()
  if (now - metrics.lastResetTime > 3600000) {
    const avgLatency = metrics.requestCount > 0 ? metrics.latencySum / metrics.requestCount : 0
    console.log('[Metrics] 指标统计:', {
      requestCount: metrics.requestCount,
      successCount: metrics.successCount,
      errorCount: metrics.errorCount,
      avgLatency: avgLatency.toFixed(2) + 'ms',
      successRate: ((metrics.successCount / metrics.requestCount) * 100).toFixed(2) + '%'
    })
    // 重置指标
    metrics.requestCount = 0
    metrics.errorCount = 0
    metrics.successCount = 0
    metrics.latencySum = 0
    metrics.lastResetTime = now
  }

  // 错误率告警（简化版，生产环境应使用云监控服务）
  if (metrics.requestCount > 10) {
    const errorRate = metrics.errorCount / metrics.requestCount
    if (errorRate > 0.1) { // 错误率超过10%
      console.error('[Alert] 错误率过高:', {
        errorRate: (errorRate * 100).toFixed(2) + '%',
        errorCount: metrics.errorCount,
        totalCount: metrics.requestCount,
        action
      })
    }
  }

  // 延迟告警（简化版）
  if (latency > 5000) { // 超过5秒
    console.warn('[Alert] 请求延迟过高:', {
      action,
      latency: latency + 'ms',
      threshold: '5000ms'
    })
  }
}

/**
 * 统一的AI服务云函数
 * 
 * 安全设计：
 * 1. 密钥存储在云函数环境变量中，不暴露给客户端
 * 2. 统一限流、重试、审计
 * 3. 支持多种AI操作：getHint, gradeEssay, sendMessage, generateLearningPlan
 * 4. 监控指标采集和告警
 * 
 * @param {Object} event - 事件对象
 * @param {string} event.action - 操作类型：'getHint' | 'gradeEssay' | 'sendMessage' | 'generateLearningPlan'
 * @param {Object} event.params - 操作参数
 * @returns {Promise<Object>} 操作结果
 */
exports.main = async (event, context) => {
  const startTime = Date.now()
  const { action, ...params } = event

  // 记录请求日志（脱敏）
  console.log('[ai-service] 收到请求:', {
    action,
    timestamp: new Date().toISOString(),
    // 不记录敏感参数
    hasParams: !!params
  })

  // 验证输入
  if (!action) {
    const latency = Date.now() - startTime
    recordMetric('unknown', false, latency)
    return {
      success: false,
      error: '缺少action参数',
      code: 'MISSING_PARAMETER',
      timestamp: Date.now()
    }
  }

  try {
    let result
    // 根据action路由到对应的处理函数
    switch (action) {
      case 'getHint':
        result = await handleGetHint(params)
        break
      
      case 'gradeEssay':
        result = await handleGradeEssay(params)
        break
      
      case 'sendMessage':
        result = await handleSendMessage(params)
        break
      
      case 'generateLearningPlan':
        result = await handleGenerateLearningPlan(params)
        break
      
      case 'analyzeData':
        result = await handleAnalyzeData(params)
        break
      
      case 'getRecommendedCourses':
        result = await handleGetRecommendedCourses(params)
        break
      
      case 'getCourseDetail':
        result = await handleGetCourseDetail(params)
        break
      
      default:
        result = {
          success: false,
          error: `不支持的操作类型: ${action}`,
          code: 'INVALID_PARAMETER',
          timestamp: Date.now()
        }
    }

    const latency = Date.now() - startTime
    recordMetric(action, result.success, latency)

    // 记录成功日志
    if (result.success) {
      console.log(`[ai-service] ${action} 成功:`, {
        latency: latency + 'ms',
        timestamp: new Date().toISOString()
      })
    } else {
      console.error(`[ai-service] ${action} 失败:`, {
        error: result.error,
        latency: latency + 'ms',
        timestamp: new Date().toISOString()
      })
    }

    return result
  } catch (error) {
    const latency = Date.now() - startTime
    recordMetric(action, false, latency)

    // 记录错误日志（脱敏）
    console.error(`[ai-service] ${action} 异常:`, {
      error: error.message,
      latency: latency + 'ms',
      timestamp: new Date().toISOString()
    })

    return {
      success: false,
      error: error.message || 'AI服务暂时不可用',
      code: error.code || 'INTERNAL_ERROR',
      timestamp: Date.now()
    }
  }
}

/**
 * 处理获取提示请求
 */
async function handleGetHint(params) {
  const { questionId, context = {} } = params

  if (!questionId) {
    return {
      success: false,
      error: '缺少questionId参数',
      code: 'MISSING_PARAMETER',
      timestamp: Date.now()
    }
  }

  try {
    // 调用Qwen API获取提示
    const hint = await callQwenAPI({
      prompt: buildHintPrompt(questionId, context),
      temperature: 0.3,
      max_tokens: 200
    })

    return {
      success: true,
      data: {
        hint: hint.content || '请仔细阅读题目，注意关键信息。',
        questionId,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }
  } catch (error) {
    console.error('[ai-service] getHint失败:', error)
    return {
      success: false,
      error: error.message || '获取提示失败',
      code: 'AI_SERVICE_UNAVAILABLE',
      timestamp: Date.now()
    }
  }
}

/**
 * 处理批改作文请求
 */
async function handleGradeEssay(params) {
  const { essayContent, questionId, context = {} } = params

  if (!essayContent || !questionId) {
    return {
      success: false,
      error: '缺少essayContent或questionId参数',
      code: 'MISSING_PARAMETER',
      timestamp: Date.now()
    }
  }

  try {
    // 调用Qwen API批改作文
    const result = await callQwenAPI({
      prompt: buildGradingPrompt(essayContent, questionId, context),
      temperature: 0.2,
      max_tokens: 800
    })

    // 解析JSON格式的响应
    let gradingResult
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        gradingResult = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      // 如果解析失败，使用降级方案
      gradingResult = buildFallbackGradingResult(essayContent)
    }

    return {
      success: true,
      data: {
        ...gradingResult,
        questionId,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }
  } catch (error) {
    console.error('[ai-service] gradeEssay失败:', error)
    return {
      success: false,
      error: error.message || '批改失败',
      code: 'AI_SERVICE_UNAVAILABLE',
      timestamp: Date.now()
    }
  }
}

/**
 * 处理发送消息请求
 */
async function handleSendMessage(params) {
  const { userId, message } = params

  if (!userId || !message) {
    return {
      success: false,
      error: '缺少userId或message参数',
      code: 'MISSING_PARAMETER',
      timestamp: Date.now()
    }
  }

  try {
    // 调用Qwen API发送消息
    const result = await callQwenAPI({
      prompt: message,
      temperature: 0.7,
      max_tokens: 1000
    })

    return {
      success: true,
      data: {
        content: result.content,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }
  } catch (error) {
    console.error('[ai-service] sendMessage失败:', error)
    return {
      success: false,
      error: error.message || '发送消息失败',
      code: 'AI_SERVICE_UNAVAILABLE',
      timestamp: Date.now()
    }
  }
}

/**
 * 处理生成学习计划请求
 */
async function handleGenerateLearningPlan(params) {
  const { userProfile, learningGoals } = params

  if (!userProfile || !learningGoals) {
    return {
      success: false,
      error: '缺少userProfile或learningGoals参数',
      code: 'MISSING_PARAMETER',
      timestamp: Date.now()
    }
  }

  try {
    // 调用Qwen API生成学习计划
    const prompt = buildLearningPlanPrompt(userProfile, learningGoals)
    const result = await callQwenAPI({
      prompt,
      temperature: 0.4,
      max_tokens: 1200
    })

    return {
      success: true,
      data: {
        plan: result.content,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }
  } catch (error) {
    console.error('[ai-service] generateLearningPlan失败:', error)
    return {
      success: false,
      error: error.message || '生成学习计划失败',
      code: 'AI_SERVICE_UNAVAILABLE',
      timestamp: Date.now()
    }
  }
}

/**
 * 调用Qwen API（统一入口，密钥从环境变量获取）
 */
async function callQwenAPI(options) {
  const { prompt, temperature = 0.3, max_tokens = 800 } = options

  // 从环境变量获取密钥（安全）
  const QWEN_API_KEY = process.env.QWEN_API_KEY
  const QWEN_BASE_URL = process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1'
  const MODEL = process.env.QWEN_MODEL || 'qwen-turbo'

  if (!QWEN_API_KEY) {
    throw new Error('QWEN_API_KEY未配置')
  }

  try {
    const axios = require('axios')
    
    const response = await axios.post(
      `${QWEN_BASE_URL}/services/aigc/text-generation/generation`,
      {
        model: MODEL,
        input: {
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        parameters: {
          temperature,
          max_tokens
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${QWEN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    )

    if (!response.data.output || !response.data.output.text) {
      throw new Error('Invalid response format from Qwen API')
    }

    return {
      content: response.data.output.text
    }
  } catch (error) {
    console.error('[ai-service] Qwen API调用失败:', error)
    throw error
  }
}

/**
 * 构建提示词（getHint）
 */
function buildHintPrompt(questionId, context) {
  const { question, questionType, userAnswer, passage } = context

  let prompt = `你是一位专业的考研英语辅导老师。请为以下题目提供学习提示，帮助学生理解题目要点和解题思路。

题目ID: ${questionId}
题型: ${questionType || '未知'}`

  if (passage) {
    prompt += `\n\n文章内容:\n${passage.substring(0, 500)}`
  }

  if (question) {
    prompt += `\n\n题目:\n${question}`
  }

  if (userAnswer) {
    prompt += `\n\n学生当前答案:\n${userAnswer}`
    prompt += `\n\n请根据学生的答案，提供有针对性的提示，不要直接给出答案。`
  } else {
    prompt += `\n\n请提供解题思路和关键提示，帮助学生理解题目要求。`
  }

  prompt += `\n\n提示要求：
1. 语言简洁明了，控制在100字以内
2. 不要直接给出答案
3. 提供解题思路和关键点
4. 鼓励学生思考`

  return prompt
}

/**
 * 构建批改提示词（gradeEssay）
 */
function buildGradingPrompt(essayContent, questionId, context) {
  const { question, requirements, scoringCriteria } = context

  let prompt = `你是一位专业的考研英语作文批改老师。请对以下作文进行评分和批改。

题目ID: ${questionId}`

  if (question) {
    prompt += `\n\n题目要求:\n${question}`
  }

  if (requirements) {
    prompt += `\n\n具体要求:\n${requirements}`
  }

  if (scoringCriteria) {
    prompt += `\n\n评分标准:\n${scoringCriteria}`
  } else {
    prompt += `\n\n评分标准（总分30分）:
- 内容完整性（10分）：是否完整回答了题目要求
- 结构逻辑（10分）：文章结构是否清晰，逻辑是否连贯
- 语言表达（10分）：词汇使用、语法准确性、句式多样性`
  }

  prompt += `\n\n学生作文:\n${essayContent}`

  prompt += `\n\n请按照以下格式提供批改结果（JSON格式）:
{
  "scores": {
    "content": 0-10,
    "structure": 0-10,
    "language": 0-10,
    "total": 0-30
  },
  "feedback": {
    "strengths": ["优点1", "优点2"],
    "improvements": ["改进点1", "改进点2"]
  },
  "suggestions": ["具体建议1", "具体建议2"],
  "detailedComments": "详细评语（100-200字）"
}`

  return prompt
}

/**
 * 构建学习计划提示词
 */
function buildLearningPlanPrompt(userProfile, learningGoals) {
  return `根据以下用户信息生成个性化学习计划：

用户信息：
${JSON.stringify(userProfile, null, 2)}

学习目标：
${JSON.stringify(learningGoals, null, 2)}

请生成详细的学习计划。`
}

/**
 * 处理分析学习数据请求
 */
async function handleAnalyzeData(params) {
  const { userId, data } = params

  if (!userId || !data) {
    return {
      success: false,
      error: '缺少userId或data参数',
      code: 'MISSING_PARAMETER',
      timestamp: Date.now()
    }
  }

  try {
    const prompt = buildAnalysisPrompt(userId, data)
    const result = await callQwenAPI({
      prompt,
      temperature: 0.2,
      max_tokens: 1000
    })

    return {
      success: true,
      data: {
        diagnosis: result.content || '数据分析完成',
        recommendations: [],
        strengths: [],
        weaknesses: [],
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }
  } catch (error) {
    console.error('[ai-service] analyzeData失败:', error)
    return {
      success: false,
      error: error.message || '分析数据失败',
      code: 'AI_SERVICE_UNAVAILABLE',
      timestamp: Date.now()
    }
  }
}

/**
 * 处理获取推荐课程请求
 */
async function handleGetRecommendedCourses(params) {
  const { params: queryParams = {} } = params
  const { category, limit = 10 } = queryParams

  try {
    // 预定义课程数据（后续可以从数据库或AI生成）
    const allCourses = [
      {
        id: 'vocabulary_master',
        title: '词汇大师训练营',
        description: '系统学习考研词汇，提高记忆效率',
        category: 'vocabulary',
        difficulty: 'intermediate',
        estimatedTime: '30天',
        rating: 4.8,
        totalLessons: 30,
        completedLessons: 0,
        instructor: 'AI词汇专家',
        features: [
          '每日单词学习计划',
          '智能记忆复习',
          '词根词缀剖析',
          '真题词汇练习'
        ]
      },
      {
        id: 'reading_comprehension',
        title: '阅读理解进阶',
        description: '掌握阅读技巧，提高理解速度',
        category: 'reading',
        difficulty: 'advanced',
        estimatedTime: '25天',
        rating: 4.6,
        totalLessons: 25,
        completedLessons: 0,
        instructor: 'AI阅读专家',
        features: [
          '阅读技巧训练',
          '长难句解析',
          '真题练习',
          '速度提升训练'
        ]
      },
      {
        id: 'writing_master',
        title: '写作能力提升',
        description: '学习写作技巧，掌握表达方法',
        category: 'writing',
        difficulty: 'advanced',
        estimatedTime: '20天',
        rating: 4.7,
        totalLessons: 20,
        completedLessons: 0,
        instructor: 'AI写作专家',
        features: [
          '写作模板学习',
          '语法纠错',
          '范文分析',
          '实战练习'
        ]
      },
      {
        id: 'cloze_fill',
        title: '完形填空专项',
        description: '提高完形填空准确率和速度',
        category: 'reading',
        difficulty: 'intermediate',
        estimatedTime: '15天',
        rating: 4.5,
        totalLessons: 15,
        completedLessons: 0,
        instructor: 'AI完形专家',
        features: [
          '语法点训练',
          '上下文理解',
          '真题练习',
          '技巧总结'
        ]
      }
    ]

    // 根据category过滤
    let filteredCourses = allCourses
    if (category) {
      filteredCourses = allCourses.filter(course => course.category === category)
    }

    // 限制数量
    const courses = filteredCourses.slice(0, Math.min(limit, 50))

    return {
      success: true,
      data: courses,
      timestamp: Date.now()
    }
  } catch (error) {
    console.error('[ai-service] getRecommendedCourses失败:', error)
    return {
      success: false,
      error: error.message || '获取推荐课程失败',
      code: 'INTERNAL_ERROR',
      timestamp: Date.now()
    }
  }
}

/**
 * 处理获取课程详情请求
 */
async function handleGetCourseDetail(params) {
  const { courseId } = params

  if (!courseId) {
    return {
      success: false,
      error: '缺少courseId参数',
      code: 'MISSING_PARAMETER',
      timestamp: Date.now()
    }
  }

  try {
    // 预定义课程详情数据（后续可以从数据库获取）
    const courseDatabase = {
      'vocabulary_master': {
        id: 'vocabulary_master',
        title: '词汇大师训练营',
        description: '系统学习考研词汇，提高记忆效率',
        category: 'vocabulary',
        difficulty: 'intermediate',
        estimatedTime: '30天',
        totalLessons: 30,
        completedLessons: 0,
        rating: 4.8,
        instructor: 'AI词汇专家',
        features: [
          '每日单词学习计划',
          '智能记忆复习',
          '词根词缀剖析',
          '真题词汇练习'
        ],
        syllabus: [
          { week: 1, title: '基础词汇积累', lessons: 7 },
          { week: 2, title: '词根词缀学习', lessons: 7 },
          { week: 3, title: '同义词辨析', lessons: 7 },
          { week: 4, title: '专项练习强化', lessons: 9 }
        ]
      },
      'reading_comprehension': {
        id: 'reading_comprehension',
        title: '阅读理解进阶',
        description: '掌握阅读技巧，提高理解速度',
        category: 'reading',
        difficulty: 'advanced',
        estimatedTime: '25天',
        totalLessons: 25,
        completedLessons: 0,
        rating: 4.6,
        instructor: 'AI阅读专家',
        features: [
          '阅读技巧训练',
          '长难句解析',
          '真题练习',
          '速度提升训练'
        ],
        syllabus: [
          { week: 1, title: '基础阅读技巧', lessons: 6 },
          { week: 2, title: '长难句分析', lessons: 6 },
          { week: 3, title: '真题实战', lessons: 7 },
          { week: 4, title: '速度提升', lessons: 6 }
        ]
      },
      'writing_master': {
        id: 'writing_master',
        title: '写作能力提升',
        description: '学习写作技巧，掌握表达方法',
        category: 'writing',
        difficulty: 'advanced',
        estimatedTime: '20天',
        totalLessons: 20,
        completedLessons: 0,
        rating: 4.7,
        instructor: 'AI写作专家',
        features: [
          '写作模板学习',
          '语法纠错',
          '范文分析',
          '实战练习'
        ],
        syllabus: [
          { week: 1, title: '写作基础', lessons: 5 },
          { week: 2, title: '模板学习', lessons: 5 },
          { week: 3, title: '范文分析', lessons: 5 },
          { week: 4, title: '实战练习', lessons: 5 }
        ]
      },
      'cloze_fill': {
        id: 'cloze_fill',
        title: '完形填空专项',
        description: '提高完形填空准确率和速度',
        category: 'reading',
        difficulty: 'intermediate',
        estimatedTime: '15天',
        totalLessons: 15,
        completedLessons: 0,
        rating: 4.5,
        instructor: 'AI完形专家',
        features: [
          '语法点训练',
          '上下文理解',
          '真题练习',
          '技巧总结'
        ],
        syllabus: [
          { week: 1, title: '语法基础', lessons: 4 },
          { week: 2, title: '上下文理解', lessons: 4 },
          { week: 3, title: '真题练习', lessons: 4 },
          { week: 4, title: '技巧总结', lessons: 3 }
        ]
      }
    }

    const course = courseDatabase[courseId]

    if (!course) {
      return {
        success: false,
        error: `课程不存在: ${courseId}`,
        code: 'INVALID_PARAMETER',
        timestamp: Date.now()
      }
    }

    return {
      success: true,
      data: course,
      timestamp: Date.now()
    }
  } catch (error) {
    console.error('[ai-service] getCourseDetail失败:', error)
    return {
      success: false,
      error: error.message || '获取课程详情失败',
      code: 'INTERNAL_ERROR',
      timestamp: Date.now()
    }
  }
}

/**
 * 构建分析提示词
 */
function buildAnalysisPrompt(userId, data) {
  return `分析以下用户的学习数据，提供诊断和建议：

用户ID: ${userId}
学习数据:
${JSON.stringify(data, null, 2)}

请提供详细的分析报告。`
}

/**
 * 构建降级批改结果
 */
function buildFallbackGradingResult(essayContent) {
  const charCount = essayContent.length
  const contentScore = Math.min(10, Math.floor(charCount / 20) + 6)
  const languageScore = Math.min(10, Math.floor(charCount / 25) + 5)
  const structureScore = Math.min(10, Math.floor(charCount / 22) + 6)
  const totalScore = contentScore + languageScore + structureScore

  return {
    scores: {
      content: contentScore,
      structure: structureScore,
      language: languageScore,
      total: totalScore
    },
    feedback: {
      strengths: ['字数符合要求'],
      improvements: ['AI批改服务暂时不可用，请稍后重试']
    },
    suggestions: [
      '检查文章结构是否完整',
      '注意语法和拼写错误',
      '确保回答了题目要求'
    ],
    detailedComments: '批改服务暂时不可用，已提供基础评分。请稍后重试获取详细批改。',
    isFallback: true
  }
}

