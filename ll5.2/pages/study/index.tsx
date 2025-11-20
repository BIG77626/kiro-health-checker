import React, { useState, useEffect } from "react";
import { Paper } from "@/entities/Paper";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, Filter, Clock, BookOpen, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SearchHeader from "../components/study/SearchHeader";
import PaperCard from "../components/study/PaperCard";
import FilterSheet from "../components/study/FilterSheet";

export default function Study() {
  const [papers, setPapers] = useState([]);
  const [filteredPapers, setFilteredPapers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    type: "all", // all, english1, english2
    sections: [], // reading_a, reading_b, translation, cloze, writing
    difficulty: "all", // all, easy, medium, hard
    year: "all" // all, 2020, 2021, etc.
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPapers();
  }, []);

  useEffect(() => {
    // Filter papers based on search and filters
    let filtered = papers;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(paper => 
        paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        paper.year.toString().includes(searchQuery)
      );
    }

    // Type filter
    if (filters.type !== "all") {
      filtered = filtered.filter(paper => paper.type === filters.type);
    }

    // Difficulty filter
    if (filters.difficulty !== "all") {
      filtered = filtered.filter(paper => paper.difficulty === filters.difficulty);
    }

    // Year filter
    if (filters.year !== "all") {
      filtered = filtered.filter(paper => paper.year.toString() === filters.year);
    }

    // Section filter
    if (filters.sections.length > 0) {
      filtered = filtered.filter(paper => 
        filters.sections.every(section => paper.sections?.includes(section))
      );
    }

    setFilteredPapers(filtered);
  }, [papers, searchQuery, filters]);

  const loadPapers = async () => {
    setIsLoading(true);
    try {
      const data = await Paper.list("-year", 50);
      setPapers(data);
    } catch (error) {
      console.error("Failed to load papers:", error);
    }
    setIsLoading(false);
  };

  const typeLabels = {
    english1: "英语一",
    english2: "英语二"
  };

  const sectionLabels = {
    reading_a: "阅读A",
    reading_b: "阅读B", 
    translation: "翻译",
    cloze: "完形填空",
    writing: "写作"
  };

  const difficultyLabels = {
    easy: "简单",
    medium: "中等",
    hard: "困难"
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search Header */}
      <SearchHeader 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => setShowFilters(true)}
        resultsCount={filteredPapers.length}
      />

      {/* Active Filters */}
      {(filters.type !== "all" || filters.difficulty !== "all" || filters.sections.length > 0) && (
        <div className="px-6 py-4 bg-white border-b border-gray-200">
          <div className="flex flex-wrap gap-2">
            {filters.type !== "all" && (
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                {typeLabels[filters.type]}
              </Badge>
            )}
            {filters.difficulty !== "all" && (
              <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">
                {difficultyLabels[filters.difficulty]}
              </Badge>
            )}
            {filters.sections.map(section => (
              <Badge key={section} variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                {sectionLabels[section]}
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({ type: "all", sections: [], difficulty: "all", year: "all" })}
              className="text-gray-500 hover:text-gray-700"
            >
              清除筛选
            </Button>
          </div>
        </div>
      )}

      {/* Papers List */}
      <div className="px-6 py-6">
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="space-y-4">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-6 animate-pulse">
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-2">
                      <div className="h-6 bg-gray-200 rounded w-48"></div>
                      <div className="h-4 bg-gray-200 rounded w-32"></div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                  </div>
                  <div className="flex gap-2 mb-4">
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </div>
              ))}
            </div>
          ) : filteredPapers.length > 0 ? (
            <div className="space-y-4">
              {filteredPapers.map(paper => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  typeLabels={typeLabels}
                  sectionLabels={sectionLabels}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">未找到相关试卷</h3>
              <p className="text-gray-500 mb-6">请尝试调整搜索条件或筛选器</p>
              <Button onClick={() => {
                setSearchQuery("");
                setFilters({ type: "all", sections: [], difficulty: "all", year: "all" });
              }}>
                重置筛选条件
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Sheet */}
      <FilterSheet
        open={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFiltersChange={setFilters}
        typeLabels={typeLabels}
        sectionLabels={sectionLabels}
        difficultyLabels={difficultyLabels}
      />
    </div>
  );
}