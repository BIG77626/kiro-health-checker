"""
Property Tests for SkillParser

=== SKILL COMPLIANCE DECLARATION ===
Task: DYNAMIC-RULE-SCALING (Task 1.2)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types
===================================

Property 1: Skill声明解析完整性
"""

from __future__ import annotations

import pytest
from hypothesis import given, settings, strategies as st

from ..skill_parser import (
    SKILL_BLOCK_END,
    SKILL_BLOCK_START,
    SkillDeclaration,
    SkillParser,
    parse_skill_declaration,
    parse_skill_declaration_tolerant,
)


# =============================================================================
# Test Fixtures
# =============================================================================

VALID_SKILL_BLOCK = '''"""
=== SKILL COMPLIANCE DECLARATION ===
Task: ARCHITECTURE-SIMPLIFICATION
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING
Level: Expert (P0)

Rule: SEC-001 (安全检查)
  - Evidence: 使用了安全的API

Rule: ERR-002 (错误处理)
  - Evidence: 所有异常都被捕获
===================================
"""

def main():
    pass
'''

MINIMAL_SKILL_BLOCK = '''"""
=== SKILL COMPLIANCE DECLARATION ===
Skills: SECURITY
===================================
"""
'''

NO_SKILL_BLOCK = '''"""
This is a regular docstring without skill declaration.
"""

def main():
    pass
'''

INCOMPLETE_SKILL_BLOCK = '''"""
=== SKILL COMPLIANCE DECLARATION ===
Task: TEST-TASK
Skills: PYDANTIC-TYPE-SAFETY

This block is missing the end marker.
"""
'''


# =============================================================================
# Property 1: Skill声明解析完整性
# =============================================================================


class TestSkillDeclarationCompleteness:
    """Property 1: 解析后的SkillDeclaration应包含所有声明的Skill名称"""

    def test_parse_valid_block_extracts_all_skills(self) -> None:
        """有效声明块应提取所有Skill"""
        parser = SkillParser()
        result = parser.parse(VALID_SKILL_BLOCK)

        assert "PYDANTIC-TYPE-SAFETY" in result.skills
        assert "ERROR-HANDLING" in result.skills
        assert len(result.skills) == 2

    def test_parse_valid_block_extracts_all_rules(self) -> None:
        """有效声明块应提取所有规则ID"""
        parser = SkillParser()
        result = parser.parse(VALID_SKILL_BLOCK)

        assert "SEC-001" in result.rule_ids
        assert "ERR-002" in result.rule_ids
        assert len(result.rule_ids) == 2

    def test_parse_valid_block_extracts_task_name(self) -> None:
        """有效声明块应提取任务名称"""
        parser = SkillParser()
        result = parser.parse(VALID_SKILL_BLOCK)

        assert result.task_name == "ARCHITECTURE-SIMPLIFICATION"

    def test_parse_valid_block_extracts_level(self) -> None:
        """有效声明块应提取技能等级"""
        parser = SkillParser()
        result = parser.parse(VALID_SKILL_BLOCK)

        assert result.level == "Expert (P0)"

    def test_parse_valid_block_extracts_skill_tags(self) -> None:
        """有效声明块应提取skill_tags"""
        parser = SkillParser()
        result = parser.parse(VALID_SKILL_BLOCK)

        # PYDANTIC-TYPE-SAFETY 映射到 ["type-safety", "pydantic", "validation"]
        # ERROR-HANDLING 映射到 ["error-handling", "exception", "defensive"]
        assert "type-safety" in result.skill_tags
        assert "pydantic" in result.skill_tags
        assert "error-handling" in result.skill_tags

    def test_parse_minimal_block(self) -> None:
        """最小声明块应正确解析"""
        parser = SkillParser()
        result = parser.parse(MINIMAL_SKILL_BLOCK)

        assert "SECURITY" in result.skills
        assert result.task_name is None
        assert result.level is None

    def test_parse_no_skill_block_returns_empty(self) -> None:
        """没有声明块时返回空声明"""
        parser = SkillParser()
        result = parser.parse(NO_SKILL_BLOCK)

        assert result.is_empty()
        assert result.skills == []
        assert result.rule_ids == []
        assert result.raw_block == ""


# =============================================================================
# 容错解析测试 (REQ-2.4)
# =============================================================================


class TestTolerantParsing:
    """测试容错解析功能"""

    def test_tolerant_parse_incomplete_block(self) -> None:
        """不完整的声明块应容错解析"""
        parser = SkillParser()
        result = parser.parse_tolerant(INCOMPLETE_SKILL_BLOCK)

        # 应该能提取到部分信息
        assert result.task_name == "TEST-TASK"
        assert "PYDANTIC-TYPE-SAFETY" in result.skills

    def test_tolerant_parse_empty_string(self) -> None:
        """空字符串应返回空声明"""
        parser = SkillParser()
        result = parser.parse_tolerant("")

        assert result.is_empty()

    def test_tolerant_parse_invalid_format(self) -> None:
        """无效格式应返回空声明而不抛异常"""
        parser = SkillParser()
        result = parser.parse_tolerant("random text without any structure")

        assert result.is_empty()


# =============================================================================
# Skill Tags 提取测试
# =============================================================================


class TestSkillTagsExtraction:
    """测试 skill_tags 提取功能"""

    def test_extract_known_skill_tags(self) -> None:
        """已知Skill应映射到正确的tags"""
        parser = SkillParser()
        tags = parser.extract_skill_tags(["PYDANTIC-TYPE-SAFETY"])

        assert "type-safety" in tags
        assert "pydantic" in tags
        assert "validation" in tags

    def test_extract_unknown_skill_uses_name(self) -> None:
        """未知Skill应使用名称本身作为tag"""
        parser = SkillParser()
        tags = parser.extract_skill_tags(["CUSTOM-SKILL"])

        assert "custom-skill" in tags

    def test_extract_multiple_skills_deduplicates(self) -> None:
        """多个Skill的tags应去重"""
        parser = SkillParser()
        # PYDANTIC-TYPE-SAFETY 和 PYDANTIC-VALIDATION 都有 "validation" tag
        tags = parser.extract_skill_tags(["PYDANTIC-TYPE-SAFETY", "PYDANTIC-VALIDATION"])

        # 应该去重
        assert tags.count("validation") == 1

    def test_extract_empty_skills_returns_empty(self) -> None:
        """空Skill列表应返回空tags"""
        parser = SkillParser()
        tags = parser.extract_skill_tags([])

        assert tags == []

    @given(st.lists(st.text(min_size=1, max_size=50), min_size=1, max_size=5))
    @settings(max_examples=50)
    def test_extract_skill_tags_always_returns_list(self, skills: list) -> None:
        """任何输入都应返回列表"""
        parser = SkillParser()
        tags = parser.extract_skill_tags(skills)

        assert isinstance(tags, list)


# =============================================================================
# 便捷函数测试
# =============================================================================


class TestConvenienceFunctions:
    """测试便捷函数"""

    def test_parse_skill_declaration_function(self) -> None:
        """parse_skill_declaration 便捷函数应正常工作"""
        result = parse_skill_declaration(VALID_SKILL_BLOCK)

        assert "PYDANTIC-TYPE-SAFETY" in result.skills
        assert "ERROR-HANDLING" in result.skills

    def test_parse_skill_declaration_tolerant_function(self) -> None:
        """parse_skill_declaration_tolerant 便捷函数应正常工作"""
        result = parse_skill_declaration_tolerant(INCOMPLETE_SKILL_BLOCK)

        assert result.task_name == "TEST-TASK"


# =============================================================================
# SkillDeclaration 模型测试
# =============================================================================


class TestSkillDeclarationModel:
    """测试 SkillDeclaration 模型"""

    def test_is_empty_true_for_empty_declaration(self) -> None:
        """空声明的 is_empty() 应返回 True"""
        decl = SkillDeclaration()
        assert decl.is_empty()

    def test_is_empty_false_with_skills(self) -> None:
        """有Skill的声明的 is_empty() 应返回 False"""
        decl = SkillDeclaration(skills=["SECURITY"])
        assert not decl.is_empty()

    def test_is_empty_false_with_rules(self) -> None:
        """有规则的声明的 is_empty() 应返回 False"""
        decl = SkillDeclaration(rule_ids=["SEC-001"])
        assert not decl.is_empty()

    def test_model_serialization_roundtrip(self) -> None:
        """模型序列化往返"""
        original = SkillDeclaration(
            skills=["SECURITY", "ERROR-HANDLING"],
            rule_ids=["SEC-001", "ERR-002"],
            skill_tags=["security", "error-handling"],
            raw_block="test block",
            task_name="TEST-TASK",
            level="Expert (P0)",
        )
        dumped = original.model_dump()
        restored = SkillDeclaration.model_validate(dumped)

        assert original == restored


# =============================================================================
# Property-Based Tests
# =============================================================================


class TestPropertyBasedParsing:
    """Property-based tests for SkillParser"""

    @given(
        task_name=st.text(
            alphabet=st.characters(whitelist_categories=("L", "N", "P"), whitelist_characters="-_"),
            min_size=1,
            max_size=50,
        ).filter(lambda x: x.strip()),
        skills=st.lists(
            st.text(
                alphabet=st.characters(whitelist_categories=("L", "N"), whitelist_characters="-_"),
                min_size=1,
                max_size=30,
            ).filter(lambda x: x.strip() and "," not in x),
            min_size=1,
            max_size=5,
        ),
    )
    @settings(max_examples=30)
    def test_generated_skill_block_parses_correctly(
        self,
        task_name: str,
        skills: list,
    ) -> None:
        """生成的Skill声明块应能正确解析"""
        # 生成声明块
        skills_str = ", ".join(skills)
        block = f'''"""
{SKILL_BLOCK_START}
Task: {task_name}
Skills: {skills_str}
{SKILL_BLOCK_END}
"""
'''
        parser = SkillParser()
        result = parser.parse(block)

        # 验证解析结果（strip后比较，因为解析器会strip）
        assert result.task_name == task_name.strip()
        assert len(result.skills) == len(skills)
        for skill in skills:
            assert skill.strip() in result.skills

    @given(st.text(max_size=1000))
    @settings(max_examples=50)
    def test_parse_never_raises_on_any_input(self, code: str) -> None:
        """parse_tolerant 对任何输入都不应抛出异常"""
        parser = SkillParser()
        # 不应抛出异常
        result = parser.parse_tolerant(code)
        assert isinstance(result, SkillDeclaration)
