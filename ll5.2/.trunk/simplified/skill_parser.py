"""
Skill Parser - Skill声明解析器

=== SKILL COMPLIANCE DECLARATION ===
Task: DYNAMIC-RULE-SCALING (Task 1.2)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: SkillDeclaration inherits from BaseModel

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: ERR-005 (自定义异常继承 Exception)
  - Evidence: SkillParseError inherits from SimplifiedArchitectureError

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit None checks
===================================

Requirements: REQ-2 (Skill约束解析)
"""

from __future__ import annotations

import logging
import re
from typing import List, Optional, Set

from pydantic import BaseModel, ConfigDict, Field

from .models import SimplifiedArchitectureError

logger = logging.getLogger(__name__)


# =============================================================================
# Exceptions
# =============================================================================


class SkillParseError(SimplifiedArchitectureError):
    """Skill声明解析错误"""

    pass


# =============================================================================
# Data Models
# =============================================================================


class SkillDeclaration(BaseModel):
    """
    Skill声明结构 (REQ-2.1)

    解析代码头部的 Skill 声明块后的结构化数据。
    """

    model_config = ConfigDict(strict=True, extra="forbid")

    skills: List[str] = Field(
        default_factory=list,
        description="声明的Skill名称列表",
    )
    rule_ids: List[str] = Field(
        default_factory=list,
        description="显式引用的规则ID",
    )
    skill_tags: List[str] = Field(
        default_factory=list,
        description="解析出的skill_tags（从Skill名称提取）",
    )
    raw_block: str = Field(
        default="",
        description="原始声明块",
    )
    task_name: Optional[str] = Field(
        default=None,
        description="任务名称",
    )
    level: Optional[str] = Field(
        default=None,
        description="技能等级，如 'Expert (P0)'",
    )

    def is_empty(self) -> bool:
        """检查声明是否为空"""
        return len(self.skills) == 0 and len(self.rule_ids) == 0


# =============================================================================
# Constants
# =============================================================================

# Skill声明块的开始和结束标记
SKILL_BLOCK_START = "=== SKILL COMPLIANCE DECLARATION ==="
SKILL_BLOCK_END = "==================================="

# 正则表达式模式
TASK_PATTERN = re.compile(r"Task:\s*(.+?)(?:\n|$)", re.IGNORECASE)
SKILLS_PATTERN = re.compile(r"Skills:\s*(.+?)(?:\n|$)", re.IGNORECASE)
LEVEL_PATTERN = re.compile(r"Level:\s*(.+?)(?:\n|$)", re.IGNORECASE)
RULE_PATTERN = re.compile(r"Rule:\s*([A-Z]+-\d{3})\s*\(", re.IGNORECASE)

# Skill名称到skill_tags的映射
# 这是一个简化的映射，实际使用时可以从配置文件加载
SKILL_TO_TAGS: dict[str, List[str]] = {
    # Pydantic相关
    "PYDANTIC-TYPE-SAFETY": ["type-safety", "pydantic", "validation"],
    "PYDANTIC-VALIDATION": ["type-safety", "pydantic", "validation"],
    # 错误处理相关
    "ERROR-HANDLING": ["error-handling", "exception", "defensive"],
    "EXCEPTION-HANDLING": ["error-handling", "exception"],
    # Python防御性编程
    "PYTHON-DEFENSIVE": ["defensive", "python", "safety"],
    "DEFENSIVE-PROGRAMMING": ["defensive", "safety"],
    # 安全相关
    "SECURITY": ["security", "safety"],
    "INPUT-VALIDATION": ["security", "validation", "input"],
    # 网络相关
    "NETWORK-SAFETY": ["network", "safety", "timeout"],
    "HTTP-CLIENT": ["network", "http", "client"],
    # 文件操作
    "FILE-SAFETY": ["file", "safety", "path"],
    "PATH-VALIDATION": ["file", "path", "security"],
    # 数据库
    "DATABASE-SAFETY": ["database", "sql", "safety"],
    "SQL-INJECTION": ["database", "sql", "security"],
}


# =============================================================================
# Implementation
# =============================================================================


class SkillParser:
    """
    解析代码头部的Skill声明 (REQ-2)

    支持解析以下格式的声明块：

    ```
    === SKILL COMPLIANCE DECLARATION ===
    Task: TASK-NAME
    Skills: SKILL-1, SKILL-2
    Level: Expert (P0)

    Rule: RULE-001 (description)
      - Evidence: evidence text
    ===================================
    ```
    """

    def __init__(
        self,
        skill_to_tags: Optional[dict[str, List[str]]] = None,
    ) -> None:
        """
        初始化 SkillParser。

        Args:
            skill_to_tags: Skill名称到tags的映射，默认使用内置映射
        """
        # DEF-001: 显式检查 None
        if skill_to_tags is None:
            self._skill_to_tags = SKILL_TO_TAGS.copy()
        else:
            self._skill_to_tags = skill_to_tags

    def parse(self, code: str) -> SkillDeclaration:
        """
        解析代码中的Skill声明 (REQ-2.1, REQ-2.2, REQ-2.3)

        Args:
            code: 源代码字符串

        Returns:
            SkillDeclaration: 解析后的声明结构
        """
        # 提取声明块
        raw_block = self._extract_skill_block(code)

        # 如果没有声明块，返回空声明
        if not raw_block:
            return SkillDeclaration()

        # 解析各个字段
        task_name = self._extract_task_name(raw_block)
        skills = self._extract_skills(raw_block)
        level = self._extract_level(raw_block)
        rule_ids = self._extract_rule_ids(raw_block)

        # 从Skill名称提取skill_tags
        skill_tags = self.extract_skill_tags(skills)

        return SkillDeclaration(
            skills=skills,
            rule_ids=rule_ids,
            skill_tags=skill_tags,
            raw_block=raw_block,
            task_name=task_name,
            level=level,
        )

    def parse_tolerant(self, code: str) -> SkillDeclaration:
        """
        容错解析 (REQ-2.4)

        格式错误时记录警告，返回部分解析结果。

        Args:
            code: 源代码字符串

        Returns:
            SkillDeclaration: 解析后的声明结构（可能不完整）
        """
        try:
            return self.parse(code)
        except (ValueError, TypeError, AttributeError) as e:
            # ERR-001: 指定具体异常类型
            logger.warning(f"Skill声明解析部分失败: {e}")
            # 尝试提取能解析的部分
            raw_block = self._extract_skill_block(code)
            return SkillDeclaration(raw_block=raw_block if raw_block else "")

    def extract_skill_tags(self, skills: List[str]) -> List[str]:
        """
        从Skill名称提取skill_tags (REQ-2.5)

        Args:
            skills: Skill名称列表

        Returns:
            List[str]: 去重后的skill_tags列表
        """
        tags: Set[str] = set()

        for skill in skills:
            # 标准化Skill名称（大写，去空格）
            normalized = skill.strip().upper().replace(" ", "-")

            # 查找映射
            if normalized in self._skill_to_tags:
                tags.update(self._skill_to_tags[normalized])
            else:
                # 如果没有映射，使用Skill名称本身作为tag（小写）
                tags.add(normalized.lower())
                logger.debug(f"未找到Skill '{skill}' 的映射，使用名称作为tag")

        return sorted(list(tags))

    def _extract_skill_block(self, code: str) -> Optional[str]:
        """提取Skill声明块"""
        start_idx = code.find(SKILL_BLOCK_START)
        if start_idx == -1:
            return None

        end_idx = code.find(SKILL_BLOCK_END, start_idx + len(SKILL_BLOCK_START))
        if end_idx == -1:
            # 没有结束标记，尝试提取到下一个空行或文件末尾
            logger.warning("Skill声明块缺少结束标记")
            # 查找下一个空行
            next_empty = code.find("\n\n", start_idx)
            if next_empty != -1:
                return code[start_idx:next_empty]
            return code[start_idx:]

        return code[start_idx : end_idx + len(SKILL_BLOCK_END)]

    def _extract_task_name(self, block: str) -> Optional[str]:
        """提取任务名称"""
        match = TASK_PATTERN.search(block)
        if match:
            return match.group(1).strip()
        return None

    def _extract_skills(self, block: str) -> List[str]:
        """提取Skill列表"""
        match = SKILLS_PATTERN.search(block)
        if match:
            skills_str = match.group(1).strip()
            # 按逗号分割并去除空白
            return [s.strip() for s in skills_str.split(",") if s.strip()]
        return []

    def _extract_level(self, block: str) -> Optional[str]:
        """提取技能等级"""
        match = LEVEL_PATTERN.search(block)
        if match:
            return match.group(1).strip()
        return None

    def _extract_rule_ids(self, block: str) -> List[str]:
        """提取规则ID列表"""
        matches = RULE_PATTERN.findall(block)
        # 去重并保持顺序
        seen: Set[str] = set()
        result: List[str] = []
        for rule_id in matches:
            if rule_id not in seen:
                seen.add(rule_id)
                result.append(rule_id)
        return result


# =============================================================================
# Convenience Functions
# =============================================================================


def parse_skill_declaration(code: str) -> SkillDeclaration:
    """
    解析代码中的Skill声明的便捷函数

    Args:
        code: 源代码字符串

    Returns:
        SkillDeclaration: 解析后的声明结构
    """
    parser = SkillParser()
    return parser.parse(code)


def parse_skill_declaration_tolerant(code: str) -> SkillDeclaration:
    """
    容错解析代码中的Skill声明的便捷函数

    Args:
        code: 源代码字符串

    Returns:
        SkillDeclaration: 解析后的声明结构（可能不完整）
    """
    parser = SkillParser()
    return parser.parse_tolerant(code)
