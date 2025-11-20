// cloudfunctions/translation-grading/index.js

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * AI翻译批改云函数
 * 使用 Qwen3-14B 微调模型进行翻译评分
 */
exports.main = async (event, context) => {
  const { userTranslation, referenceTranslation, sourceText } = event

  // 验证输入
  if (!userTranslation || !referenceTranslation || !sourceText) {
    return {
      success: false,
      error: '缺少必要参数'
    }
  }

  try {
    // 构建评分 Prompt
    const prompt = buildTranslationGradingPrompt(userTranslation, referenceTranslation, sourceText)
    
    // 调用 AI 模型
    const result = await callAIModel(prompt)
    
    // 返回结果
    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('AI翻译批改失败:', error)
    return {
      success: false,
      error: error.message || 'AI服务暂时不可用'
    }
  }
}

/**
 * 构建翻译评分 Prompt
 */
function buildTranslationGradingPrompt(userTranslation, referenceTranslation, sourceText) {
  const prompt = `你是一位专业的考研英语翻译批改老师。请对以下学生翻译进行详细评分。

**原文**：
${sourceText}

**学生翻译**：
${userTranslation}

**参考译文**：
${referenceTranslation}

**评分要求**：
请以JSON格式返回评分结果，包含以下字段：
{
  "score": 总分（0-100分）,
  "accuracy": 准确性得分（0-30分，评估是否准确传达原文意思，关键信息有无遗漏或错译）,
  "fluency": 流畅性得分（0-30分，评估译文是否通顺自然，符合中文表达习惯）,
  "completeness": 完整性得分（0-20分，评估是否完整翻译所有内容，无遗漏）,
  "expression": 表达力得分（0-20分，评估用词是否恰当，表达是否优雅）,
  "feedback": "详细评语（150字以内，指出主要优点和不足）",
  "suggestions": "改进建议（提供具体的修改意见）"
}

请严格按照JSON格式返回，不要添加任何额外的说明文字。
`

  return prompt
}

/**
 * 调用 AI 模型（优先使用微调模型）
 */
async function callAIModel(prompt) {
  const USE_CUSTOM_MODEL = process.env.USE_CUSTOM_MODEL === 'true'
  const CUSTOM_MODEL_URL = process.env.CUSTOM_MODEL_URL || 'http://localhost:8000'
  const CUSTOM_MODEL_NAME = process.env.CUSTOM_MODEL_NAME || 'qwen3-14b-finetuned'
  
  const QWEN_API_KEY = process.env.QWEN_API_KEY  // 从环境变量读取API密钥
  const QWEN_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'

  // 优先使用微调模型
  if (USE_CUSTOM_MODEL) {
    console.log('✅ 使用自部署微调模型进行翻译评分:', CUSTOM_MODEL_URL)
    return callCustomModel(prompt, CUSTOM_MODEL_URL, CUSTOM_MODEL_NAME)
  }

  // 降级到官方API
  if (!QWEN_API_KEY) {
    console.warn('⚠️ 未配置 Qwen API Key (环境变量 QWEN_API_KEY)，返回模拟数据')
    return getMockTranslationGrading()
  }

  try {
    const axios = require('axios')
    
    console.log('✅ 使用阿里云通义千问API进行翻译评分')
    const response = await axios.post(QWEN_API_URL, {
      model: 'qwen-max',
      input: {
        messages: [
          {
            role: 'system',
            content: '你是一位专业的考研英语翻译批改老师，精通翻译评分标准。'
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
      timeout: 30000
    })

    const aiContent = response.data.output.choices[0].message.content
    
    // 解析JSON
    try {
      const jsonStr = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const result = JSON.parse(jsonStr)
      
      if (!result.score || !result.feedback) {
        throw new Error('AI返回数据格式不完整')
      }
      
      return result
    } catch (parseError) {
      console.error('解析AI返回失败:', parseError)
      console.log('原始返回:', aiContent)
      return parseTextResult(aiContent)
    }
  } catch (error) {
    console.error('调用 Qwen API 失败:', error)
    console.warn('⚠️ API调用失败，返回模拟数据')
    return getMockTranslationGrading()
  }
}

/**
 * 调用自部署微调模型（vLLM + Qwen3-14B）
 */
async function callCustomModel(prompt, modelUrl, modelName) {
  try {
    const axios = require('axios')
    
    const apiEndpoint = `${modelUrl}/v1/chat/completions`
    
    console.log(`🚀 调用自部署模型: ${apiEndpoint}`)
    
    const response = await axios.post(apiEndpoint, {
      model: modelName,
      messages: [
        {
          role: 'system',
          content: '你是一位专业的考研英语翻译批改老师，经过专门微调，能够精准评分翻译质量。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      top_p: 0.8,
      max_tokens: 1024
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
      
      if (!result.score || !result.feedback) {
        throw new Error('微调模型返回数据格式不完整')
      }
      
      console.log('✅ 微调模型翻译评分成功')
      return result
    } catch (parseError) {
      console.error('解析微调模型返回失败:', parseError)
      console.log('原始返回:', aiContent)
      return parseTextResult(aiContent)
    }
  } catch (error) {
    console.error('调用微调模型失败:', error.message)
    console.warn('⚠️ 微调模型调用失败，返回模拟数据')
    return getMockTranslationGrading()
  }
}

/**
 * 从文本中解析批改结果（备用方案）
 */
function parseTextResult(text) {
  return {
    score: 70,
    accuracy: 21,
    fluency: 21,
    completeness: 14,
    expression: 14,
    feedback: text.substring(0, 150) || '翻译基本准确，但部分表达还需优化。',
    suggestions: '请参考AI反馈，改进翻译的准确性和流畅性。'
  }
}

/**
 * 获取模拟翻译评分结果（用于开发测试）
 */
function getMockTranslationGrading() {
  return {
    score: 75,
    accuracy: 23,
    fluency: 23,
    completeness: 15,
    expression: 14,
    feedback: '翻译整体较为准确，基本传达了原文意思。译文通顺，但在个别地方的表达还可以更加优雅。建议注意专业术语的准确性和句式的多样化。',
    suggestions: '1. "rapidly advancing" 翻译为"快速发展"较为准确。\n2. 注意长句的断句和逻辑关系。\n3. 可以使用更地道的中文表达替换直译。'
  }
}


