# Implementation Plan

## Overview

实现需求层覆盖检查和双向追踪机制，在已完成的规则测试样本库基础上增量扩展。

**当前状态**：
- ✅ Day 0-1 核心功能已完成（物理边界、策略层、数据填充）
- ✅ Stage 4 资产化已完成（CI/CD、知识库、Onboarding）
- ✅ "看到数字"里程碑已达成
- ⏳ P1 任务待执行（案例沉淀、开源准备）
- ⏳ 验收测试待执行（需要 GitHub 环境）

**验收标准**：
- ✅ Day 1：`python -m simplified.health_check` 显示 `[需求层] 总数: 3 / 完全覆盖: 1`
- ⏳ Day 2：执行验收测试 22，CI 真实阻塞破坏性 PR
- ⏳ Day 3：`pip install kiro-health-checker` 可运行

**重要定位**：
> 需求覆盖度是 **Risk Radar（风险雷达）**，不是 Safety Proof（安全证明）

---

## Phase 1 - 核心功能（已完成）

- [x] 1. Day 0 - 创建物理边界和策略层

  - [x] 1.1 Create requirements/ directory structure
  - [x] 1.2 Create scenarios/ directory (预留)
  - [x] 1.3 Create rollback script
  - [x] 1.4 Create health_config.yml with structured policy
  - [x] 1.5 Create HealthConfig Pydantic models

- [x] 2. Checkpoint - Verify directory structure

- [x] 3. Implement Requirement model and loader

  - [x] 3.1 Create Requirement Pydantic model
  - [x] 3.3 Create RequirementLoader class

- [x] 4. Checkpoint - Verify Requirement loading works

- [x] 5. Create first REQ file and verify loading

  - [x] 5.1 Create REQ-NET-001.yml (high risk)
  - [x] 5.2 Verify RequirementLoader loads REQ-NET-001

- [x] 6. Extend Rule model with requirement_ids

  - [x] 6.1 Add requirement_ids field to Rule model
  - [x] 6.3 Update NET-007 rule with requirement_ids

- [x] 7. Data Population Sprint - 数据填充冲刺



  - [x] 7.1 Create REQ-SEC-001.yml for SEC-001, SEC-006, SEC-007 (risk_level: high)
  - [x] 7.2 Create REQ-ERR-001.yml for ERR-001, ERR-002, ERR-003 (risk_level: medium)
  - [x] 7.3 Update rules with requirement_ids backlinks
  - [x] 7.4 Fix bug in rule_registry.py (requirement_ids loading)
  - [x] 7.5 Verify "看到数字" milestone achieved

---

## Phase 2 - Stage 4 资产化（已完成）

- [x] 16. CI/CD Pipeline

  - [x] 16.1 Create `.github/workflows/review-verification.yml`
    - `fast-check` job: Python version matrix (3.10/3.11/3.12), 59 tests
    - `performance-baseline` job: Triggered by `run-performance` label, non-blocking
    - `review-summary` job: Auto-comments PR with test results

- [x] 17. Review Knowledge Base

  - [x] 17.1 Create `docs/review/README.md`
  - [x] 17.2 Create `docs/review/WORKFLOW.md`
  - [x] 17.3 Create `docs/review/STAGE1_SCOPE.md`
  - [x] 17.4 Create `docs/review/STAGE2_IMPLEMENTATION.md`
  - [x] 17.5 Create `docs/review/STAGE3_PERFORMANCE.md`
  - [x] 17.6 Create `docs/review/CASE_STUDIES.md`

- [x] 18. Onboarding Toolkit

  - [x] 18.1 Create `scripts/onboarding/setup_dev.sh`
  - [x] 18.2 Create `scripts/onboarding/run_first_review.sh`
  - [x] 18.3 Create `scripts/onboarding/review_cheat_sheet.md`

- [x] 19. verify_review.py Enhancement

  - [x] 19.1 Add `--xml FILE` parameter for JUnit XML report generation

- [x] 20. Stage 4 Verification

  - Test Statistics: 75 passed (default), 78 passed (--slow)

- [x] 21. Operations Manual (第零号资产)

  - [x] 21.1 Create `docs/review/OPERATIONS.md`
  - [x] 21.2 Create `tests/test_review_meta.py` - 16 个自指性测试

---

## Phase 3 - P1 任务（当前重点）

> **STATUS: IN PROGRESS**
> 
> 数据填充 + 案例资产沉淀 + 开源准备
> 
> **行业对标**：需求可追溯性矩阵 (RTM) + 基于风险的测试 + 需求即代码 (RaC)

- [x] 26. 数据填充冲刺（P0 紧急）




  - [x] 26.1 批量创建 REQ 文件（复制 NET-001 模板）

    - 目标：从 3 个 REQ 扩展到 10 个
    - 覆盖：DBA-003, FILE-001, FILE-002, NET-001, TYP-001, TYP-002
    - 每个 REQ 文件 < 2 分钟完成
    - _Requirements: 数据层填充_

  - [x] 26.2 为新 REQ 添加 requirement_ids 到规则

    - 更新 `database_rules.yml`, `file_rules.yml`, `network_rules.yml`
    - 验证双向追踪无孤儿/悬空
    - _Requirements: 双向可追溯性_

- [x] 27. 需求版本控制（优化点1）

  - [x] 27.1 在 REQ 文件中增加版本元数据
    - 新增字段：`version`, `last_modified`, `changelog`
    - 更新 `requirement_models.py` 支持新字段
    - _Requirements: 需求变更影响分析_

- [x] 28. 案例资产自动沉淀机制

  - [x] 28.1 Create `scripts/add_case_asset.sh`
    - 用法：`./scripts/add_case_asset.sh "悬空引用" "Rule引用了不存在的REQ" "修复方案"`
    - 自动生成 `docs/review/cases/{DATE}-{ID}.md`
    - 自动更新 `CASE_STUDIES.md` 索引
    - 嵌入结构化元数据：`tags`, `impact_scope`
    - _Requirements: 知识库持续强化_

  - [x] 28.2 Create `docs/review/cases/` directory
    - Add `.gitkeep` to ensure directory is tracked
    - _Requirements: 案例存储位置_

- [x] 29. 开源准备 - pyproject.toml

  - [x] 29.1 Create `pyproject.toml` for packaging
    - Package name: `kiro-health-checker`
    - Version: `0.1.0`
    - Entry point: `kiro-health-check` CLI command
    - Dependencies: pydantic, pyyaml
    - _Requirements: pip install 可用_

  - [x] 29.2 Add `schema_version` to JSON output
    - Add `"schema_version": "v1.0"` to health_check.py JSON output
    - Ensure backward compatibility
    - _Requirements: 外部工具可依赖稳定契约_

- [x] 30. Checkpoint - P1 验证

  - ✅ 运行 `python health_check.py` 显示 `[需求层] 总数: 10`
  - ✅ `scripts/add_case_asset.sh` 已创建
  - ✅ `docs/review/cases/` 目录已创建
  - ✅ `pyproject.toml` 已创建
  - ✅ `schema_version: "v1.0"` 已添加到 JSON 输出

---

## Phase 4 - 验收测试（需要 GitHub 环境）

> **STATUS: ✅ 验收 22 已完成**
> 
> GitHub 仓库已创建，CI 阻断功能验证成功

**GitHub 仓库**: https://github.com/BIG77626/kiro-health-checker
**PR #1**: https://github.com/BIG77626/kiro-health-checker/pull/1 (已关闭)

- [x] 22. 验收 1：CI 真实阻塞（验证 R-01 缓解措施） ✅ **已完成**


  - [x] 22.1 提交破坏性 PR


    - ✅ 创建 `test-ci-blocking` 分支
    - ✅ 故意破坏 `test_review_stage1.py::test_review_scope_files_exist`
      - 添加不存在的文件: `THIS_FILE_DOES_NOT_EXIST.py`
    - ✅ 推送到 GitHub 并创建 PR #1
    - ✅ CI 运行并显示 ❌ 失败（Python 3.10/3.11/3.12 全部失败）

  - [x] 22.2 验证 CI 评论内容
    - ✅ PR 评论包含「🔍 审核验证摘要」
    - ✅ 评论包含测试统计（Total Tests / Passed / Failed / Skipped）
    - ✅ 评论包含「📦 下载证据」链接
    - ✅ PR 显示「部分检查未成功」阻止合并
    
  **验收结论**: CI 阻断功能正常工作，破坏性 PR 无法合并。PR 已关闭。

- [ ] 23. 验收 2：新人 Onboarding 验证

  - [ ] 23.1 新成员按文档执行审查
    - 按 `docs/review/README.md` 成功运行审查
    - 30 分钟内完成首次审查并生成证据包

  - [ ] 23.2 理解核心概念
    - 能区分「行为级测试」vs「实现级测试」
    - 能解释 Config-as-Policy 原则

- [ ] 24. 验收 3：知识库可检索验证

  - [x] 24.1 搜索「悬空引用」
    - 在 `CASE_STUDIES.md` 中能找到定义、测试方法、修复模式

  - [x] 24.2 搜索「孤儿需求」
    - 在 `CASE_STUDIES.md` 中能找到定义、测试方法、修复模式

- [x] 25. 验收 4：GitHub 分支保护配置 ✅ **已完成**

  - [x] 25.1 配置分支保护规则
    - ✅ Branch name pattern: `main`
    - ✅ Require status checks: `review-verification / Fast Review Check`
    - ✅ Require conversation resolution
    - ✅ Do not allow bypassing

---

## Phase 5 - 本周克制执行计划（2024-12-19）

> **STATUS: IN PROGRESS**
> 
> 聚焦"让第一个真实用户能用"，砍掉花哨功能

### P0 - 修复 CI 评论测试数为 0（30分钟）

- [x] 31. 修复 workflow XML 解析逻辑

  - [x] 31.1 问题诊断：grep -oP 在某些情况下解析失败
  - [x] 31.2 修复方案：改用 Python xml.etree 解析 JUnit XML
  - [x] 31.3 添加调试输出：打印 XML 前 20 行便于排查
  - [ ] 31.4 验证：提交 PR 后评论显示 "Total Tests: 75"

### P1 - 扩展 REQ 到全覆盖（2小时）

- [ ] 32. 识别无 REQ 的高风险规则

  - [ ] 32.1 统计当前规则总数和 REQ 覆盖情况
  - [ ] 32.2 找出剩余无 REQ 的 high-risk 规则（约 5-8 个）
  - [ ] 32.3 批量创建 REQ 文件（复制模板 + sed 修改）
  - [ ] 32.4 给规则添加 requirement_ids 反向引用
  - [ ] 32.5 验证：`health_check` 显示 `[需求层] 总数: 15+`

### P2 - 集成 False Green Rate（1小时）

- [ ] 33. 在 health_check 输出中显示误报率

  - [ ] 33.1 在 HealthCheckReport 中添加 false_green_rate 字段
  - [ ] 33.2 在 print_text_report 中显示误报率统计
  - [ ] 33.3 验证：`health_check --verbose` 显示误报率

### 本周验收标准

- [ ] **周一**：PR 评论显示 "Total Tests: 75"（截图）
- [ ] **周三**：REQ 总数 15，覆盖率 > 80%（截图）
- [ ] **周五**：False Green Rate 集成并显示（截图）

### 砍掉的功能（不能开始）

- ❌ --fix 模式（自动修复）
- ❌ HTML 报告生成
- ❌ 增量检查（git diff）
- ❌ CLI 颜色/进度条优化

---

## Phase 6 - 可选增强（Future Tasks）

> **STATUS: NOT IN SCOPE FOR V1**

### P2 - 场景层（Day 3+）

- **FT-1**: 实现 Scenario 模型和 ScenarioLoader
- **FT-2**: 实现 scenario_test_runner.py
- **FT-3**: 在 health_check 中增加场景层统计

### P3 - 质量门禁（V2）

- **FT-4**: 开启 high_risk_gate_enabled
- **FT-5**: 开启 exit_on_failure
- **FT-6**: REQ 文件命名冲突检测

### P4 - 辅助工具

- **FT-7**: 自动推断 covered_by_rules 候选

### P5 - 可选测试（已标记 *）

- [ ]* 3.2 Write property test for Requirement schema validation
- [ ]* 3.4 Write unit tests for RequirementLoader
- [ ]* 6.2 Write property test for Rule backward compatibility
- [ ]* 8.3 Write property test for coverage calculation
- [ ]* 11.2 Write property test for orphan reference detection
- [ ]* 11.3 Write property test for missing backlink detection
- [ ]* 13.2 Write property test for risk level grouping

---

## 执行优先级总结

| 优先级 | 任务 | 状态 | 依赖 |
|--------|------|------|------|
| **P0** | Phase 1 核心功能 | ✅ done | - |
| **P0** | Phase 2 资产化 | ✅ done | - |
| **P1** | 26. 案例沉淀脚本 | ⏳ next | 无 |
| **P1** | 27. 开源准备 | ⏳ next | 无 |
| **P1** | 22-25 验收测试 | ⏳ pending | GitHub 环境 |
| **P2** | Phase 5 可选增强 | ❌ not-started | V2 |

