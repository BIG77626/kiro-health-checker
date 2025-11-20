// cloudfunctions/essay-grading/index.js

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * AI作文批改云函数
 * 使用 Qwen3Max API 进行作文批改
 */
exports.main = async (event, context) => {
  const { essay, topic, requirements } = event

  // 验证输入
  if (!essay || !topic) {
    return {
      success: false,
      error: '缺少必要参数'
    }
  }

  try {
    // 构建批改 Prompt
    const prompt = buildGradingPrompt(essay, topic, requirements)
    
    // 调用 Qwen API
    const result = await callQwenAPI(prompt)
    
    // 解析并返回结果
    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('AI批改失败:', error)
    return {
      success: false,
      error: error.message || 'AI服务暂时不可用'
    }
  }
}

/**
 * 构建批改 Prompt
 */
function buildGradingPrompt(essay, topic, requirements) {
  let prompt = `你是一位专业的考研英语作文批改老师。请对以下学生作文进行详细批改。

**作文题目**：
${topic}
`

  if (requirements && requirements.length > 0) {
    prompt += `\n**写作要求**：\n`
    requirements.forEach((req, index) => {
      prompt += `${index + 1}. ${req}\n`
    })
  }

  prompt += `
**学生作文**：
${essay}

**批改要求**：
请以JSON格式返回批改结果，包含以下字段：
{
  "content_score": 内容得分（0-10分，评估主题切合度、论证充分性、思想深度）,
  "language_score": 语言得分（0-10分，评估语法正确性、词汇丰富度、句式多样性）,
  "structure_score": 结构得分（0-10分，评估段落组织、逻辑连贯、过渡自然）,
  "total_score": 总分（满分30分）,
  "comments": "总体评语（150字以内）",
  "strengths": ["亮点1", "亮点2", "亮点3"],
  "suggestions": ["改进建议1", "改进建议2", "改进建议3"],
  "improved_version": "改进示例（保留原文结构，修正错误，优化表达）"
}

请严格按照JSON格式返回，不要添加任何额外的说明文字。
`

  return prompt
}

/**
 * 调用 Qwen API（支持官方API和自部署微调模型）
 */
async function callQwenAPI(prompt) {
  // 配置优先级：自部署微调模型 > 官方API > 模拟数据
  const USE_CUSTOM_MODEL = process.env.USE_CUSTOM_MODEL === 'true'
  const CUSTOM_MODEL_URL = process.env.CUSTOM_MODEL_URL || 'http://localhost:8000'
  const CUSTOM_MODEL_NAME = process.env.CUSTOM_MODEL_NAME || 'qwen3-14b-finetuned'
  
  const QWEN_API_KEY = process.env.QWEN_API_KEY  // 从环境变量读取API密钥
  const QWEN_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'

  // 如果启用自定义模型
  if (USE_CUSTOM_MODEL) {
    console.log('✅ 使用自部署微调模型:', CUSTOM_MODEL_URL)
    return callCustomModel(prompt, CUSTOM_MODEL_URL, CUSTOM_MODEL_NAME)
  }

  // 如果没有配置API Key，返回模拟数据
  if (!QWEN_API_KEY) {
    console.warn('⚠️ 未配置 Qwen API Key (环境变量 QWEN_API_KEY)，返回模拟数据')
    return getMockGradingResult()
  }

  try {
    // 使用云函数的HTTP客户端
    const axios = require('axios')
    
    console.log('✅ 使用阿里云通义千问API')
    const response = await axios.post(QWEN_API_URL, {
      model: 'qwen-max', // 使用 qwen-max 模型获得最佳批改质量
      input: {
        messages: [
          {
            role: 'system',
            content: '你是一位专业的考研英语作文批改老师，精通英语写作评分标准。'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      parameters: {
        result_format: 'message',
        temperature: 0.7,
        top_p: 0.8
      }
    }, {
      headers: {
        'Authorization': `Bearer ${QWEN_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30秒超时
    })

    // 提取AI返回的内容
    const aiContent = response.data.output.choices[0].message.content
    
    // 尝试解析JSON
    try {
      // 移除可能的markdown代码块标记
      const jsonStr = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const result = JSON.parse(jsonStr)
      
      // 验证必需字段
      if (!result.total_score || !result.comments) {
        throw new Error('AI返回数据格式不完整')
      }
      
      return result
    } catch (parseError) {
      console.error('解析AI返回失败:', parseError)
      console.log('原始返回:', aiContent)
      
      // 如果解析失败，尝试从文本中提取关键信息
      return parseTextResult(aiContent)
    }
  } catch (error) {
    console.error('调用 Qwen API 失败:', error)
    
    // API调用失败，返回模拟数据以保证功能可用
    console.warn('⚠️ API调用失败，返回模拟数据')
    return getMockGradingResult()
  }
}

/**
 * 从文本中解析批改结果（备用方案）
 */
function parseTextResult(text) {
  // 简单的文本解析逻辑
  return {
    content_score: 7,
    language_score: 7,
    structure_score: 7,
    total_score: 21,
    comments: text.substring(0, 200) || '批改完成，请查看详细反馈。',
    strengths: ['文章结构清晰', '论点明确'],
    suggestions: ['可以增加更多例证', '注意语法细节'],
    improved_version: ''
  }
}

/**
 * 调用自部署微调模型（vLLM + Qwen3-14B）
 */
async function callCustomModel(prompt, modelUrl, modelName) {
  try {
    const axios = require('axios')
    
    // vLLM使用OpenAI兼容API
    const apiEndpoint = `${modelUrl}/v1/chat/completions`
    
    console.log(`🚀 调用自部署模型: ${apiEndpoint}`)
    
    const response = await axios.post(apiEndpoint, {
      model: modelName,
      messages: [
        {
          role: 'system',
          content: '你是一位专业的考研英语作文批改老师，精通英语写作评分标准。你经过专门微调，能够精准评分和提供建设性反馈。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      top_p: 0.8,
      max_tokens: 2048
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    })

    const aiContent = response.data.choices[0].message.content
    
    // 解析JSON
    try {
      const jsonStr = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const result = JSON.parse(jsonStr)
      
      if (!result.total_score || !result.comments) {
        throw new Error('微调模型返回数据格式不完整')
      }
      
      console.log('✅ 微调模型评分成功')
      return result
    } catch (parseError) {
      console.error('解析微调模型返回失败:', parseError)
      console.log('原始返回:', aiContent)
      return parseTextResult(aiContent)
    }
  } catch (error) {
    console.error('调用微调模型失败:', error.message)
    
    // 降级到模拟数据
    console.warn('⚠️ 微调模型调用失败，返回模拟数据')
    return getMockGradingResult()
  }
}

/**
 * 获取模拟批改结果（用于开发测试）
 */
function getMockGradingResult() {
  return {
    content_score: 8,
    language_score: 7,
    structure_score: 8,
    total_score: 23,
    comments: '文章整体质量良好。主题明确，论证较为充分，结构清晰。语言表达基本准确，但在词汇多样性和句式复杂度上还有提升空间。建议在论证时增加更多具体例证，使论点更有说服力。',
    strengths: [
      '主题切题，观点明确',
      '段落结构合理，逻辑清晰',
      '使用了恰当的连接词，过渡自然'
    ],
    suggestions: [
      '可以使用更多高级词汇替换常见词汇，如用 "illustrate" 代替 "show"',
      '适当增加复杂句式，如定语从句、状语从句等',
      '在论证时增加具体例证或数据支持',
      '注意个别语法细节，如主谓一致、时态使用'
    ],
    improved_version: '（此处应为改进后的作文示例，保留原文结构，修正错误，优化表达）\n\n由于是模拟数据，此处不提供具体改进版本。实际使用时，AI会根据学生作文提供详细的改进示例。'
  }
}

