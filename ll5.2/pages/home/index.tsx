import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { StudyRecord } from "@/entities/StudyRecord";
import { User } from "@/entities/User";
import { createPageUrl } from "@/utils";
import { BookOpen, ArrowRight, Clock, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [stats, setStats] = useState({
    todayStudyTime: 0,
    weekAccuracy: 0,
    totalQuestions: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRealStats();
  }, []);

  const loadRealStats = async () => {
    setIsLoading(true);
    try {
      const studyRecords = await StudyRecord.list("-created_date", 100);
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      // 计算今日学习时长（分钟）
      const todayRecords = studyRecords.filter(record => 
        record.created_date?.startsWith(today)
      );
      const todayStudyTime = Math.round(
        todayRecords.reduce((sum, record) => sum + (record.time_spent || 0), 0) / 60
      );

      // 计算本周正确率
      const weekRecords = studyRecords.filter(record => 
        new Date(record.created_date) >= weekAgo
      );
      const weekCorrect = weekRecords.filter(record => record.is_correct).length;
      const weekAccuracy = weekRecords.length > 0 
        ? ((weekCorrect / weekRecords.length) * 100).toFixed(1) 
        : 0;

      // 总完成题目数
      const totalQuestions = studyRecords.length;

      setStats({
        todayStudyTime,
        weekAccuracy,
        totalQuestions
      });
    } catch (error) {
      console.error("Failed to load stats:", error);
      // 保持默认值
    }
    setIsLoading(false);
  };

  const recentStats = [
    { 
      label: "今日学习", 
      value: isLoading ? "..." : `${stats.todayStudyTime}分钟`,
      icon: Clock
    },
    { 
      label: "本周正确率", 
      value: isLoading ? "..." : `${stats.weekAccuracy}%`,
      icon: Target
    },
    { 
      label: "完成题目", 
      value: isLoading ? "..." : `${stats.totalQuestions}道`,
      icon: BookOpen
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      {/* Learning Stats (Top) */}
      <div className="w-full px-6 pt-8">
        <div className="max-w-md mx-auto flex justify-around items-center text-center bg-transparent">
          {recentStats.map((stat, index) => (
            <div key={index} className="flex flex-col items-center">
              <stat.icon className="w-5 h-5 text-blue-600 mb-1" />
              <p className="text-xl font-semibold text-gray-800">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
      
      {/* Main Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-10">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-600 rounded-3xl mb-6 shadow-lg">
            <BookOpen className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            考研英语长文攻克
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            精准定位证据句，系统分析改写链，科学提升阅读理解能力。
          </p>
        </div>

        <Link to={createPageUrl("Study")}>
          <Button 
            size="lg" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 h-16 text-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            开始学习
            <ArrowRight className="w-6 h-6 ml-3" />
          </Button>
        </Link>
      </div>

      {/* Spacer for bottom nav */}
      <div className="h-16 md:h-0"></div> 
    </div>
  );
}