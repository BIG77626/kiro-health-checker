"""
Property Tests for SkillRuleMapping

=== SKILL COMPLIANCE DECLARATION ===
Task: DYNAMIC-RULE-SCALING (Task 1.3)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types
===================================

Property 4: 标签检索正确性
"""

from __future__ import annotations

from pathlib import Path
from tempfile import NamedTemporaryFile

import pytest
import yaml
from hypothesis import given, settings, strategies as st

from ..skill_mapping import (
    SkillMappingManager,
    SkillRuleMapping,
    create_skill_mapping_manager,
    get_rule_ids_for_skill,
)


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def temp_mappings_file(tmp_path: Path) -> Path:
    """创建临时映射文件"""
    mappings_file = tmp_path / "skill_mappings.yml"
    data = {
        "version": "1.0.0",
        "mappings": [
            {
                "skill_name": "BASE-SKILL",
                "rule_ids": ["SEC-001", "ERR-001"],
                "skill_tags": ["base", "safety"],
                "description": "Base skill",
            },
            {
                "skill_name": "CHILD-SKILL",
                "rule_ids": ["TYP-001"],
                "inherits_from": "BASE-SKILL",
                "skill_tags": ["child", "type-safety"],
                "description": "Child skill",
            },
            {
                "skill_name": "GRANDCHILD-SKILL",
                "rule_ids": ["NET-001"],
                "inherits_from": "CHILD-SKILL",
                "skill_tags": ["grandchild", "network"],
                "description": "Grandchild skill",
            },
        ],
    }
    with open(mappings_file, "w", encoding="utf-8") as f:
        yaml.dump(data, f)
    return mappings_file


@pytest.fixture
def circular_mappings_file(tmp_path: Path) -> Path:
    """创建循环继承的映射文件"""
    mappings_file = tmp_path / "circular_mappings.yml"
    data = {
        "version": "1.0.0",
        "mappings": [
            {
                "skill_name": "SKILL-A",
                "rule_ids": ["SEC-001"],
                "inherits_from": "SKILL-B",
                "skill_tags": ["a"],
            },
            {
                "skill_name": "SKILL-B",
                "rule_ids": ["ERR-001"],
                "inherits_from": "SKILL-A",
                "skill_tags": ["b"],
            },
        ],
    }
    with open(mappings_file, "w", encoding="utf-8") as f:
        yaml.dump(data, f)
    return mappings_file


# =============================================================================
# SkillRuleMapping 模型测试
# =============================================================================


class TestSkillRuleMappingModel:
    """测试 SkillRuleMapping 模型"""

    def test_create_minimal_mapping(self) -> None:
        """创建最小映射"""
        mapping = SkillRuleMapping(skill_name="TEST-SKILL")
        assert mapping.skill_name == "TEST-SKILL"
        assert mapping.rule_ids == []
        assert mapping.inherits_from is None
        assert mapping.skill_tags == []

    def test_create_full_mapping(self) -> None:
        """创建完整映射"""
        mapping = SkillRuleMapping(
            skill_name="TEST-SKILL",
            rule_ids=["SEC-001", "ERR-001"],
            inherits_from="BASE-SKILL",
            skill_tags=["test", "safety"],
            description="Test skill",
        )
        assert mapping.skill_name == "TEST-SKILL"
        assert mapping.rule_ids == ["SEC-001", "ERR-001"]
        assert mapping.inherits_from == "BASE-SKILL"
        assert mapping.skill_tags == ["test", "safety"]
        assert mapping.description == "Test skill"

    def test_model_serialization_roundtrip(self) -> None:
        """模型序列化往返"""
        original = SkillRuleMapping(
            skill_name="TEST-SKILL",
            rule_ids=["SEC-001"],
            inherits_from="BASE-SKILL",
            skill_tags=["test"],
            description="Test",
        )
        dumped = original.model_dump()
        restored = SkillRuleMapping.model_validate(dumped)
        assert original == restored


# =============================================================================
# SkillMappingManager 测试
# =============================================================================


class TestSkillMappingManager:
    """测试 SkillMappingManager"""

    def test_load_mappings_from_file(self, temp_mappings_file: Path) -> None:
        """从文件加载映射"""
        manager = SkillMappingManager(mappings_file=temp_mappings_file)
        
        assert len(manager.get_all_mappings()) == 3
        assert "BASE-SKILL" in manager.get_all_skill_names()
        assert "CHILD-SKILL" in manager.get_all_skill_names()

    def test_get_mapping(self, temp_mappings_file: Path) -> None:
        """获取映射"""
        manager = SkillMappingManager(mappings_file=temp_mappings_file)
        
        mapping = manager.get_mapping("BASE-SKILL")
        assert mapping is not None
        assert mapping.skill_name == "BASE-SKILL"
        assert "SEC-001" in mapping.rule_ids

    def test_get_mapping_case_insensitive(self, temp_mappings_file: Path) -> None:
        """获取映射（大小写不敏感）"""
        manager = SkillMappingManager(mappings_file=temp_mappings_file)
        
        mapping = manager.get_mapping("base-skill")
        assert mapping is not None
        assert mapping.skill_name == "BASE-SKILL"

    def test_get_mapping_not_found(self, temp_mappings_file: Path) -> None:
        """获取不存在的映射"""
        manager = SkillMappingManager(mappings_file=temp_mappings_file)
        
        mapping = manager.get_mapping("NON-EXISTENT")
        assert mapping is None


# =============================================================================
# Property 4: 标签检索正确性 - 继承测试
# =============================================================================


class TestInheritance:
    """测试继承机制"""

    def test_get_rule_ids_no_inheritance(self, temp_mappings_file: Path) -> None:
        """获取规则ID（无继承）"""
        manager = SkillMappingManager(mappings_file=temp_mappings_file)
        
        rule_ids = manager.get_rule_ids("BASE-SKILL")
        assert "SEC-001" in rule_ids
        assert "ERR-001" in rule_ids
        assert len(rule_ids) == 2

    def test_get_rule_ids_with_inheritance(self, temp_mappings_file: Path) -> None:
        """获取规则ID（有继承）"""
        manager = SkillMappingManager(mappings_file=temp_mappings_file)
        
        rule_ids = manager.get_rule_ids("CHILD-SKILL")
        # 应该包含自己的规则和父Skill的规则
        assert "TYP-001" in rule_ids  # 自己的
        assert "SEC-001" in rule_ids  # 继承的
        assert "ERR-001" in rule_ids  # 继承的

    def test_get_rule_ids_multi_level_inheritance(self, temp_mappings_file: Path) -> None:
        """获取规则ID（多级继承）"""
        manager = SkillMappingManager(mappings_file=temp_mappings_file)
        
        rule_ids = manager.get_rule_ids("GRANDCHILD-SKILL")
        # 应该包含所有层级的规则
        assert "NET-001" in rule_ids  # 自己的
        assert "TYP-001" in rule_ids  # 父级的
        assert "SEC-001" in rule_ids  # 祖父级的
        assert "ERR-001" in rule_ids  # 祖父级的

    def test_get_skill_tags_with_inheritance(self, temp_mappings_file: Path) -> None:
        """获取标签（有继承）"""
        manager = SkillMappingManager(mappings_file=temp_mappings_file)
        
        tags = manager.get_skill_tags("CHILD-SKILL")
        # 应该包含自己的标签和父Skill的标签
        assert "child" in tags
        assert "type-safety" in tags
        assert "base" in tags
        assert "safety" in tags

    def test_circular_inheritance_detection(self, circular_mappings_file: Path) -> None:
        """检测循环继承"""
        manager = SkillMappingManager(mappings_file=circular_mappings_file)
        
        # 不应该无限循环，应该返回部分结果
        rule_ids = manager.get_rule_ids("SKILL-A")
        # 应该至少包含自己的规则
        assert "SEC-001" in rule_ids


# =============================================================================
# 添加和移除映射测试
# =============================================================================


class TestMappingManagement:
    """测试映射管理"""

    def test_add_mapping(self, temp_mappings_file: Path) -> None:
        """添加映射"""
        manager = SkillMappingManager(mappings_file=temp_mappings_file)
        
        new_mapping = SkillRuleMapping(
            skill_name="NEW-SKILL",
            rule_ids=["NEW-001"],
            skill_tags=["new"],
        )
        manager.add_mapping(new_mapping)
        
        assert "NEW-SKILL" in manager.get_all_skill_names()
        assert manager.get_mapping("NEW-SKILL") is not None

    def test_remove_mapping(self, temp_mappings_file: Path) -> None:
        """移除映射"""
        manager = SkillMappingManager(mappings_file=temp_mappings_file)
        
        assert manager.remove_mapping("BASE-SKILL")
        assert "BASE-SKILL" not in manager.get_all_skill_names()

    def test_remove_nonexistent_mapping(self, temp_mappings_file: Path) -> None:
        """移除不存在的映射"""
        manager = SkillMappingManager(mappings_file=temp_mappings_file)
        
        assert not manager.remove_mapping("NON-EXISTENT")


# =============================================================================
# 便捷函数测试
# =============================================================================


class TestConvenienceFunctions:
    """测试便捷函数"""

    def test_create_skill_mapping_manager(self, temp_mappings_file: Path) -> None:
        """create_skill_mapping_manager 便捷函数"""
        manager = create_skill_mapping_manager(mappings_file=temp_mappings_file)
        assert len(manager.get_all_mappings()) == 3


# =============================================================================
# Property-Based Tests
# =============================================================================


class TestPropertyBased:
    """Property-based tests"""

    @given(
        skill_name=st.text(
            alphabet=st.characters(whitelist_categories=("L", "N"), whitelist_characters="-_"),
            min_size=1,
            max_size=30,
        ).filter(lambda x: x.strip()),
        rule_ids=st.lists(
            st.from_regex(r"^[A-Z]{3}-\d{3}$", fullmatch=True),
            min_size=0,
            max_size=5,
        ),
        skill_tags=st.lists(
            st.text(min_size=1, max_size=20).filter(lambda x: x.strip()),
            min_size=0,
            max_size=5,
        ),
    )
    @settings(max_examples=30)
    def test_mapping_roundtrip(
        self,
        skill_name: str,
        rule_ids: list,
        skill_tags: list,
    ) -> None:
        """映射序列化往返"""
        original = SkillRuleMapping(
            skill_name=skill_name,
            rule_ids=rule_ids,
            skill_tags=skill_tags,
        )
        dumped = original.model_dump()
        restored = SkillRuleMapping.model_validate(dumped)
        assert original == restored

    def test_rule_ids_deduplication(self, temp_mappings_file: Path) -> None:
        """规则ID去重"""
        manager = SkillMappingManager(mappings_file=temp_mappings_file)
        
        rule_ids = manager.get_rule_ids("CHILD-SKILL")
        # 应该没有重复
        assert len(rule_ids) == len(set(rule_ids))

    def test_skill_tags_deduplication(self, temp_mappings_file: Path) -> None:
        """标签去重"""
        manager = SkillMappingManager(mappings_file=temp_mappings_file)
        
        tags = manager.get_skill_tags("CHILD-SKILL")
        # 应该没有重复
        assert len(tags) == len(set(tags))
