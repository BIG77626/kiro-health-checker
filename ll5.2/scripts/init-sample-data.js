// 数据库示例数据初始化脚本
const cloud = require('wx-server-sdk')

// 动态环境配置 - 脚本通过环境变量指定环境
// 使用方式：ENV_ID=cloud1-dev-xxx node scripts/init-sample-data.js
const ENV_ID = process.env.ENV_ID

if (!ENV_ID) {
  console.error('❌ 错误: 必须通过环境变量 ENV_ID 指定云环境')
  console.error('   使用方式: ENV_ID=cloud1-dev-xxx node scripts/init-sample-data.js')
  process.exit(1)
}

cloud.init({
  env: ENV_ID
})

console.log(`[初始化脚本] 使用环境ID: ${ENV_ID}`)

const db = cloud.database()

// 示例试卷数据
const samplePapers = [
  {
    _id: 'sample_reading_comprehension',
    title: '阅读理解练习 - 技术与现代社会',
    year: 2024,
    type: 'reading',
    sections: ['reading_a'],
    difficulty: 'medium',
    estimated_time: 30,
    content: {
      passages: [
        {
          id: 'passage_1',
          title: 'Technology and Modern Society',
          paragraphs: [
            {
              number: 1,
              text: 'The rapid advancement of technology has fundamentally transformed how we interact with the world around us. From smartphones that connect us globally to artificial intelligence that assists in decision-making, technology permeates every aspect of modern life.',
              translation: '技术的快速发展从根本上改变了我们与周围世界的互动方式。从连接全球的智能手机到协助决策的人工智能，技术渗透到现代生活的各个方面。'
            },
            {
              number: 2,
              text: 'However, this technological revolution brings both opportunities and challenges. While digital tools enhance productivity and create new possibilities for communication and learning, they also raise concerns about privacy, employment displacement, and social isolation.',
              translation: '然而，这场技术革命既带来了机遇也带来了挑战。虽然数字工具提高了生产力，为沟通和学习创造了新的可能性，但它们也引发了对隐私、就业替代和社会孤立的担忧。'
            },
            {
              number: 3,
              text: 'As we navigate this digital landscape, it becomes crucial to develop digital literacy and maintain a balanced approach to technology adoption. The key lies not in avoiding technology, but in understanding how to harness its benefits while mitigating its potential drawbacks.',
              translation: '当我们在这个数字化环境中穿行时，培养数字素养并保持技术采用的平衡方法变得至关重要。关键不在于避免技术，而在于了解如何利用其优势同时减轻其潜在缺点。'
            }
          ]
        }
      ],
      questions: [
        {
          id: 'q1',
          type: 'reading_a',
          passage_id: 'passage_1',
          question: 'According to the passage, what is the main impact of technology on modern life?',
          options: [
            'A. It has made life more complicated and stressful',
            'B. It has transformed how we interact with the world',
            'C. It has reduced our productivity significantly',
            'D. It has eliminated traditional communication methods'
          ],
          correct_answer: 'B',
          evidence_paragraphs: [1],
          evidence_sentences: ['The rapid advancement of technology has fundamentally transformed how we interact with the world around us'],
          explanation: '文章开头明确指出技术的快速发展从根本上改变了我们与周围世界的互动方式。',
          difficulty_tips: ['注意关键词"transformed"', '理解"interact"的含义']
        },
        {
          id: 'q2',
          type: 'reading_a',
          passage_id: 'passage_1',
          question: 'What does the author suggest about dealing with technology?',
          options: [
            'A. We should completely avoid using technology',
            'B. We should use technology without any restrictions',
            'C. We should maintain a balanced approach to technology',
            'D. We should rely entirely on artificial intelligence'
          ],
          correct_answer: 'C',
          evidence_paragraphs: [3],
          evidence_sentences: ['maintain a balanced approach to technology adoption'],
          explanation: '文章第三段提到需要保持技术采用的平衡方法。',
          difficulty_tips: ['关注"balanced approach"这个关键短语']
        },
        {
          id: 'q3',
          type: 'reading_a',
          passage_id: 'passage_1',
          question: 'The phrase "digital landscape" in paragraph 3 most likely refers to:',
          options: [
            'A. Physical locations where technology is used',
            'B. The overall environment of digital technology',
            'C. Geographical maps created by computers',
            'D. Artistic representations of digital concepts'
          ],
          correct_answer: 'B',
          evidence_paragraphs: [3],
          evidence_sentences: ['As we navigate this digital landscape'],
          explanation: '"Digital landscape"在这里是比喻用法，指的是整个数字技术环境。',
          difficulty_tips: ['理解比喻用法', '结合上下文理解词汇含义']
        }
      ]
    }
  },
  {
    _id: 'sample_cloze_test',
    title: '完形填空练习 - 互联网与社会',
    year: 2024,
    type: 'cloze',
    sections: ['cloze'],
    difficulty: 'easy',
    estimated_time: 20,
    content: {
      passages: [],
      questions: [
        {
          id: 'cloze_1',
          type: 'cloze',
          question: 'The internet has _____ the way we communicate with each other.',
          options: [
            'A. revolutionized',
            'B. complicated',
            'C. simplified',
            'D. eliminated'
          ],
          correct_answer: 'A',
          explanation: '互联网"革命性地改变"了我们彼此沟通的方式，revolutionized最符合语境。',
          difficulty_tips: ['理解动词含义', '注意语境暗示']
        },
        {
          id: 'cloze_2',
          type: 'cloze',
          question: 'Social media platforms allow users to _____ their thoughts and experiences instantly.',
          options: [
            'A. hide',
            'B. share',
            'C. delete',
            'D. forget'
          ],
          correct_answer: 'B',
          explanation: '社交媒体平台让用户能够即时"分享"他们的想法和经历。',
          difficulty_tips: ['理解社交媒体的作用', '注意副词instantly的提示']
        }
      ]
    }
  }
]

async function initSampleData() {
  try {
    console.log('🚀 开始初始化示例数据...')
    
    // 检查并创建示例试卷
    for (const paper of samplePapers) {
      try {
        const _existing = await db.collection('papers').doc(paper._id).get()
        console.log(`✅ 试卷 ${paper._id} 已存在，跳过创建`)
      } catch (error) {
        if (error.code === 'DOCUMENT_NOT_FOUND') {
          // 文档不存在，创建新文档
          await db.collection('papers').add({
            data: paper
          })
          console.log(`✅ 创建示例试卷: ${paper.title}`)
        } else {
          console.error(`❌ 检查试卷 ${paper._id} 失败:`, error)
        }
      }
    }
    
    console.log('🎉 示例数据初始化完成！')
    
  } catch (error) {
    console.error('❌ 初始化示例数据失败:', error)
  }
}

// 执行初始化
initSampleData()