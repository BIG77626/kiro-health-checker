/**
 * 获取推荐课程用例
 * 获取AI推荐的课程列表
 */
class GetRecommendedCoursesUseCase {
  constructor(aiService) {
    if (!aiService) {
      throw new Error('aiService is required');
    }
    this.aiService = aiService;
  }

  /**
   * 执行获取推荐课程
   * @param {Object} params - 查询参数
   * @param {string} params.category - 课程类别 (可选)
   * @param {number} params.limit - 限制数量 (默认10)
   * @returns {Promise<Array>} 推荐课程列表
   */
  async execute({ category = 'all', limit = 10 } = {}) {
    try {
      const courses = await this.aiService.getRecommendedCourses({
        category,
        limit
      });

      return courses.map(course => ({
        id: course.id,
        title: course.title,
        instructor: course.instructor,
        category: course.category,
        rating: course.rating,
        students: course.students,
        lessons: course.lessons,
        duration: course.duration,
        difficulty: course.difficulty,
        progress: course.progress || 0,
        cover: course.cover || ''
      }));
    } catch (error) {
      console.error('GetRecommendedCoursesUseCase execute error:', error);
      throw new Error(`获取推荐课程失败: ${error.message}`);
    }
  }
}

module.exports = GetRecommendedCoursesUseCase;
