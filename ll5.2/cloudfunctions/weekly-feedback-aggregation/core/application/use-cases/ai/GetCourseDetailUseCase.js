/**
 * 获取课程详情用例
 * 获取单个课程的详细信息
 */
class GetCourseDetailUseCase {
  constructor(aiService) {
    if (!aiService) {
      throw new Error('aiService is required');
    }
    this.aiService = aiService;
  }

  /**
   * 执行获取课程详情
   * @param {string} courseId - 课程ID
   * @returns {Promise<Object>} 课程详情
   */
  async execute(courseId) {
    if (!courseId) {
      throw new Error('Course ID is required');
    }

    try {
      const course = await this.aiService.getCourseDetail(courseId);

      return {
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
        cover: course.cover || '',
        description: course.description || '',
        syllabus: course.syllabus || [],
        reviews: course.reviews || []
      };
    } catch (error) {
      console.error('GetCourseDetailUseCase execute error:', error);
      throw new Error(`获取课程详情失败: ${error.message}`);
    }
  }
}

module.exports = GetCourseDetailUseCase;
