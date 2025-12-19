"""
Property Tests for Scenario Mapper

=== SKILL COMPLIANCE DECLARATION ===
Task: ARCHITECTURE-SIMPLIFICATION (Task 2.1)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types
===================================

Property 1: 场景映射确定性 - 多次调用返回相同结果
"""

from __future__ import annotations

from pathlib import Path

import pytest
from hypothesis import given, settings, strategies as st, HealthCheck

from ..scenario_mapper import ScenarioMapper


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mapper() -> ScenarioMapper:
    """创建场景映射器"""
    return ScenarioMapper()


# =============================================================================
# Property 1: 场景映射确定性
# =============================================================================


class TestScenarioMappingDeterminism:
    """Property 1: 场景映射是确定性的，多次调用返回相同结果"""

    def test_list_scenarios_deterministic(self, mapper: ScenarioMapper) -> None:
        """list_scenarios() 多次调用返回相同结果"""
        result1 = mapper.list_scenarios()
        result2 = mapper.list_scenarios()
        result3 = mapper.list_scenarios()

        assert result1 == result2
        assert result2 == result3

    def test_map_to_ruleset_deterministic(self, mapper: ScenarioMapper) -> None:
        """map_to_ruleset() 多次调用返回相同结果"""
        scenarios = mapper.list_scenarios()
        if len(scenarios) == 0:
            pytest.skip("No scenarios available")

        scenario_id = scenarios[0].id

        result1 = mapper.map_to_ruleset(scenario_id)
        result2 = mapper.map_to_ruleset(scenario_id)
        result3 = mapper.map_to_ruleset(scenario_id)

        # 比较规则集ID和规则数量
        assert result1.id == result2.id == result3.id
        assert len(result1.rules) == len(result2.rules) == len(result3.rules)

        # 比较规则ID列表
        ids1 = result1.get_rule_ids()
        ids2 = result2.get_rule_ids()
        ids3 = result3.get_rule_ids()
        assert ids1 == ids2 == ids3

    def test_get_default_ruleset_deterministic(self, mapper: ScenarioMapper) -> None:
        """get_default_ruleset() 多次调用返回相同结果"""
        result1 = mapper.get_default_ruleset()
        result2 = mapper.get_default_ruleset()
        result3 = mapper.get_default_ruleset()

        assert result1.id == result2.id == result3.id
        assert len(result1.rules) == len(result2.rules) == len(result3.rules)

    @given(call_count=st.integers(min_value=2, max_value=10))
    @settings(max_examples=20, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_multiple_calls_same_result(
        self,
        mapper: ScenarioMapper,
        call_count: int,
    ) -> None:
        """多次调用返回相同结果（参数化测试）"""
        scenarios = mapper.list_scenarios()
        if len(scenarios) == 0:
            return

        scenario_id = scenarios[0].id
        results = [mapper.map_to_ruleset(scenario_id) for _ in range(call_count)]

        # 所有结果应该相同
        first = results[0]
        for result in results[1:]:
            assert result.id == first.id
            assert result.get_rule_ids() == first.get_rule_ids()


# =============================================================================
# 场景配置测试
# =============================================================================


class TestScenarioConfiguration:
    """场景配置测试"""

    def test_scenarios_have_required_fields(self, mapper: ScenarioMapper) -> None:
        """所有场景必须有必填字段"""
        scenarios = mapper.list_scenarios()

        for scenario in scenarios:
            assert len(scenario.id) > 0
            assert len(scenario.name) > 0
            assert len(scenario.ruleset_id) > 0

    def test_default_scenario_exists(self, mapper: ScenarioMapper) -> None:
        """默认场景必须存在"""
        default_ruleset = mapper.get_default_ruleset()
        assert default_ruleset is not None
        assert len(default_ruleset.id) > 0

    def test_scenario_summary_not_empty(self, mapper: ScenarioMapper) -> None:
        """场景摘要不能为空"""
        scenarios = mapper.list_scenarios()
        if len(scenarios) == 0:
            pytest.skip("No scenarios available")

        summary = mapper.get_scenario_summary(scenarios[0].id)
        assert len(summary) > 0


# =============================================================================
# 错误处理测试
# =============================================================================


class TestErrorHandling:
    """错误处理测试"""

    def test_invalid_scenario_raises_error(self, mapper: ScenarioMapper) -> None:
        """无效场景ID应该抛出异常"""
        from ..models import ScenarioNotFoundError

        with pytest.raises(ScenarioNotFoundError):
            mapper.map_to_ruleset("nonexistent_scenario_id")

    def test_invalid_scenario_summary_returns_message(
        self,
        mapper: ScenarioMapper,
    ) -> None:
        """无效场景ID的摘要应该返回错误信息"""
        summary = mapper.get_scenario_summary("nonexistent_scenario_id")
        assert "无法获取摘要" in summary


# =============================================================================
# 规则集内容测试
# =============================================================================


class TestRuleSetContent:
    """规则集内容测试"""

    def test_ruleset_has_rules(self, mapper: ScenarioMapper) -> None:
        """规则集必须包含规则"""
        default_ruleset = mapper.get_default_ruleset()
        assert len(default_ruleset.rules) > 0

    def test_rules_have_required_fields(self, mapper: ScenarioMapper) -> None:
        """规则必须有必填字段"""
        default_ruleset = mapper.get_default_ruleset()

        for rule in default_ruleset.rules:
            assert len(rule.id) > 0
            assert len(rule.description) > 0
            assert len(rule.human_description) > 0
            assert rule.severity in ["mandatory", "recommended"]

    def test_different_scenarios_may_have_different_rules(
        self,
        mapper: ScenarioMapper,
    ) -> None:
        """不同场景可能有不同的规则集"""
        scenarios = mapper.list_scenarios()
        if len(scenarios) < 2:
            pytest.skip("Need at least 2 scenarios")

        ruleset1 = mapper.map_to_ruleset(scenarios[0].id)
        ruleset2 = mapper.map_to_ruleset(scenarios[1].id)

        # 规则集ID应该不同（除非是同一个场景）
        if scenarios[0].ruleset_id != scenarios[1].ruleset_id:
            assert ruleset1.id != ruleset2.id
