import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { UserPreference } from "@/entities/UserPreference"; 
import { Settings, User as UserIcon, Bell, Eye, Palette, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [preferences, setPreferences] = useState({
    font_size: "medium",
    show_translation: false,
    study_mode: "practice",
    notification_enabled: true
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    setIsLoading(true);
    try {
      const userData = await User.me();
      setUser(userData);
      
      // Load preferences if they exist
      const userPrefs = await UserPreference.list();
      if (userPrefs.length > 0) {
        setPreferences(userPrefs[0]);
      }
    } catch (error) {
      console.error("Failed to load user data:", error);
    }
    setIsLoading(false);
  };

  const updatePreference = async (key, value) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    
    try {
      // Save preferences
      const existingPrefs = await UserPreference.list();
      if (existingPrefs.length > 0) {
        await UserPreference.update(existingPrefs[0].id, newPreferences);
      } else {
        await UserPreference.create(newPreferences);
      }
    } catch (error) {
      console.error("Failed to update preferences:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await User.logout();
      window.location.reload();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const fontSizeLabels = {
    small: "小号字体",
    medium: "中号字体", 
    large: "大号字体"
  };

  const studyModeLabels = {
    practice: "练习模式",
    exam: "模考模式"
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl p-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-32 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-48"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">个人设置</h1>
          <p className="text-gray-500 mt-1">管理账户信息和学习偏好</p>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* User Info */}
          <Card className="border-0 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-blue-600" />
                账户信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-xl font-bold text-white">
                    {user?.full_name?.[0] || user?.email?.[0] || "U"}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {user?.full_name || "用户"}
                  </h3>
                  <p className="text-gray-500 text-sm">{user?.email}</p>
                  <p className="text-blue-600 text-sm capitalize">
                    {user?.role || "user"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Study Preferences */}
          <Card className="border-0 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-600" />
                学习设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium text-gray-900">默认学习模式</h4>
                  <p className="text-sm text-gray-500">练习模式显示提示，模考模式不显示</p>
                </div>
                <Select
                  value={preferences.study_mode}
                  onValueChange={(value) => updatePreference("study_mode", value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(studyModeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium text-gray-900">学习提醒</h4>
                  <p className="text-sm text-gray-500">接收学习计划和进度提醒</p>
                </div>
                <Switch
                  checked={preferences.notification_enabled}
                  onCheckedChange={(checked) => updatePreference("notification_enabled", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Account Actions */}
          <Card className="border-0 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-orange-600" />
                账户操作
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4 mr-2" />
                退出登录
              </Button>
            </CardContent>
          </Card>

          {/* App Info */}
          <div className="text-center text-sm text-gray-500">
            <p>考研英语长文攻克 v1.0</p>
            <p className="mt-1">© 2024 版权所有</p>
          </div>
        </div>
      </div>
    </div>
  );
}