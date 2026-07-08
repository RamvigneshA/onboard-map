# Frontend Health Report: onboard-map

## 1 Overview
- **Project Name:** onboard-map
- **Overall Health Score:** **63 / 100**
- **Files Scanned:** 57
- **Import Edges:** 154
- **Scan Duration:** 3.8s

## 2 Architecture
- **Framework:** React
- **Framework Version:** 19.0.1
- **Language:** TypeScript
- **Language Version:** 5.8.2

## 3 Tooling
- **Build Tool:** Vite 6
- **Linting & Formatting:** ESLint (Missing), Prettier (Missing)
- **Testing Setup:** Unit: None detected | E2E: None detected

## 4 Quality
- **TypeScript Strict Mode:** Disabled
- **TypeScript noImplicitAny:** Disabled
- **Linter Status:** ESLint configured: No
- **Formatter Status:** Prettier configured: No
- **Git Hooks (Husky/Lint-Staged):** Not configured

## 5 Risks
- **Duplicate Packages:** None detected
- **Security Issues:**
  - `.gitignore` configured: Yes
  - `.env` files ignored: Yes
  - Automated security audit: No

## 6 Recommendations
### 🔴 Critical
- **Sync .env.example with active local keys:** We found 3 variables used in your code but missing from .env.example.
### 🟡 Warning
- **Enable TypeScript strict mode:** Strict mode catches common runtime bugs and null/undefined issues earlier during compilation.
- **Configure both ESLint & Prettier:** Automated code standards catch common anti-patterns and enforce uniform formatting team-wide.
- **Add automated tests:** No testing framework was detected. Automated tests (unit, integration, or E2E) prevent regressions and ensure code safety.

## 7 Score Breakdown

| Category | Score / 10 | Status |
| :--- | :---: | :--- |
| Project | **8 / 10** | `■■■■■■■■░░` |
| Framework | **10 / 10** | `■■■■■■■■■■` |
| TypeScript | **4 / 10** | `■■■■░░░░░░` |
| Quality | **0 / 10** | `░░░░░░░░░░` |
| Testing | **0 / 10** | `░░░░░░░░░░` |
| Deployment | **10 / 10** | `■■■■■■■■■■` |
| CI/CD | **10 / 10** | `■■■■■■■■■■` |
| Documentation | **9 / 10** | `■■■■■■■■■░` |
| Security | **10 / 10** | `■■■■■■■■■■` |
| Structure | **2 / 10** | `■■░░░░░░░░` |
