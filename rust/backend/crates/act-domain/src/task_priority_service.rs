use crate::{TaskContext, TaskImportance};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriorityAnalysis {
    pub suggested_importance: TaskImportance,
    pub confidence: f32, // 0.0 to 1.0
    pub reasons: Vec<String>,
    pub keywords_found: Vec<String>,
    pub flags: Vec<PriorityFlag>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PriorityFlag {
    ProductionBug,
    SecurityIssue,
    CustomerReported,
    TechDebt,
    BreakingChange,
    Performance,
    DataLoss,
    UiUx,
    Documentation,
    Testing,
}

pub struct TaskPriorityService {
    // Priority keywords and their weights
    high_priority_keywords: HashMap<String, f32>,
    medium_priority_keywords: HashMap<String, f32>,
    low_priority_keywords: HashMap<String, f32>,

    // Compiled regex patterns for efficiency
    production_patterns: Vec<Regex>,
    security_patterns: Vec<Regex>,
    customer_patterns: Vec<Regex>,
    tech_debt_patterns: Vec<Regex>,
}

impl TaskPriorityService {
    pub fn new() -> Self {
        let mut service = Self {
            high_priority_keywords: HashMap::new(),
            medium_priority_keywords: HashMap::new(),
            low_priority_keywords: HashMap::new(),
            production_patterns: Vec::new(),
            security_patterns: Vec::new(),
            customer_patterns: Vec::new(),
            tech_debt_patterns: Vec::new(),
        };

        service.initialize_keywords();
        service.initialize_patterns();
        service
    }

    fn initialize_keywords(&mut self) {
        // High priority keywords (weight 0.8-1.0)
        let high_priority = vec![
            ("critical", 1.0),
            ("urgent", 0.9),
            ("production", 0.9),
            ("down", 0.9),
            ("crash", 0.8),
            ("broken", 0.8),
            ("security", 0.9),
            ("vulnerability", 0.9),
            ("data loss", 1.0),
            ("customer", 0.8),
            ("client", 0.7),
            ("breaking", 0.8),
            ("blocker", 0.9),
            ("outage", 1.0),
            ("error", 0.6),
            ("bug", 0.6),
            ("issue", 0.5),
            ("problem", 0.5),
            ("emergency", 1.0),
            ("hotfix", 0.9),
        ];

        for (keyword, weight) in high_priority {
            self.high_priority_keywords
                .insert(keyword.to_string(), weight);
        }

        // Medium priority keywords (weight 0.3-0.7)
        let medium_priority = vec![
            ("feature", 0.5),
            ("enhancement", 0.4),
            ("improvement", 0.4),
            ("optimize", 0.5),
            ("performance", 0.6),
            ("refactor", 0.3),
            ("update", 0.3),
            ("upgrade", 0.4),
            ("migrate", 0.5),
            ("implement", 0.4),
            ("add", 0.3),
            ("change", 0.3),
            ("modify", 0.3),
        ];

        for (keyword, weight) in medium_priority {
            self.medium_priority_keywords
                .insert(keyword.to_string(), weight);
        }

        // Low priority keywords (weight 0.1-0.3)
        let low_priority = vec![
            ("documentation", 0.2),
            ("docs", 0.2),
            ("readme", 0.1),
            ("comment", 0.1),
            ("cleanup", 0.2),
            ("formatting", 0.1),
            ("style", 0.1),
            ("lint", 0.1),
            ("typo", 0.1),
            ("test", 0.2),
            ("unit test", 0.2),
            ("todo", 0.1),
            ("nice to have", 0.1),
            ("cosmetic", 0.1),
        ];

        for (keyword, weight) in low_priority {
            self.low_priority_keywords
                .insert(keyword.to_string(), weight);
        }
    }

    fn initialize_patterns(&mut self) {
        // Production-related patterns
        let production_patterns = vec![
            r"(?i)\bprod(uction)?\b.*\b(down|broken|error|issue)\b",
            r"(?i)\b(live|prod)\b.*\b(site|server|app)\b",
            r"(?i)\boutage\b",
            r"(?i)\bhotfix\b",
            r"(?i)\bemergency\b.*\b(deploy|fix|patch)\b",
        ];

        for pattern in production_patterns {
            if let Ok(regex) = Regex::new(pattern) {
                self.production_patterns.push(regex);
            }
        }

        // Security-related patterns
        let security_patterns = vec![
            r"(?i)\bsecurity\b.*\b(vulnerability|breach|exploit|attack)\b",
            r"(?i)\b(sql injection|xss|csrf|auth|authentication)\b",
            r"(?i)\b(password|credential|token|secret)\b.*\b(exposed|leaked|compromised)\b",
            r"(?i)\b(cve|vulnerability|exploit)\b",
            r"(?i)\bpermission\b.*\b(escalation|bypass)\b",
        ];

        for pattern in security_patterns {
            if let Ok(regex) = Regex::new(pattern) {
                self.security_patterns.push(regex);
            }
        }

        // Customer-related patterns
        let customer_patterns = vec![
            r"(?i)\b(customer|client|user)\b.*\b(report|complaint|issue|problem)\b",
            r"(?i)\b(support ticket|help desk|customer service)\b",
            r"(?i)\bcustomers?\b.*\b(affected|impacted|experiencing)\b",
            r"(?i)\b(user experience|ux)\b.*\b(broken|poor|bad)\b",
        ];

        for pattern in customer_patterns {
            if let Ok(regex) = Regex::new(pattern) {
                self.customer_patterns.push(regex);
            }
        }

        // Tech debt patterns
        let tech_debt_patterns = vec![
            r"(?i)\b(tech debt|technical debt|refactor|cleanup)\b",
            r"(?i)\b(deprecated|legacy|old|outdated)\b.*\b(code|library|dependency)\b",
            r"(?i)\b(code smell|anti-pattern|bad practice)\b",
            r"(?i)\b(improve|optimize|modernize)\b.*\b(code|architecture|structure)\b",
            r"(?i)\btodo\b.*\b(remove|fix|replace|update)\b",
        ];

        for pattern in tech_debt_patterns {
            if let Ok(regex) = Regex::new(pattern) {
                self.tech_debt_patterns.push(regex);
            }
        }
    }

    /// Analyze task priority based on title, description, and code context
    pub fn analyze_priority(
        &self,
        title: &str,
        description: Option<&str>,
        code_context: Option<&TaskContext>,
    ) -> PriorityAnalysis {
        let mut score = 0.0;
        let mut reasons = Vec::new();
        let mut keywords_found = Vec::new();
        let mut flags = Vec::new();

        // Combine all text for analysis
        let mut text = title.to_lowercase();
        if let Some(desc) = description {
            text.push(' ');
            text.push_str(&desc.to_lowercase());
        }
        if let Some(context) = code_context {
            if let Some(snippet) = &context.context_snippet {
                text.push(' ');
                text.push_str(&snippet.to_lowercase());
            }
        }

        debug!("Analyzing priority for text: {}", text);

        // Check for high priority keywords
        for (keyword, weight) in &self.high_priority_keywords {
            if text.contains(keyword) {
                score += weight;
                keywords_found.push(keyword.clone());
                reasons.push(format!("Contains high-priority keyword: '{}'", keyword));
            }
        }

        // Check for medium priority keywords (but don't let them override high priority)
        if score < 0.7 {
            for (keyword, weight) in &self.medium_priority_keywords {
                if text.contains(keyword) {
                    score += weight * 0.5; // Reduce weight for medium priority
                    keywords_found.push(keyword.clone());
                    reasons.push(format!("Contains medium-priority keyword: '{}'", keyword));
                }
            }
        }

        // Check for low priority keywords (only if no high/medium priority found)
        if score < 0.3 {
            for (keyword, weight) in &self.low_priority_keywords {
                if text.contains(keyword) {
                    score -= weight; // Subtract for low priority
                    keywords_found.push(keyword.clone());
                    reasons.push(format!("Contains low-priority keyword: '{}'", keyword));
                }
            }
        }

        // Pattern-based analysis
        self.analyze_patterns(&text, &mut score, &mut reasons, &mut flags);

        // Context-based analysis
        if let Some(context) = code_context {
            self.analyze_code_context(context, &mut score, &mut reasons, &mut flags);
        }

        // Determine final importance and confidence
        let (importance, confidence) = self.calculate_importance_and_confidence(score, &flags);

        // Add flag-based reasons
        for flag in &flags {
            reasons.push(format!("Detected: {:?}", flag));
        }

        info!(
            "Priority analysis complete: score={}, importance={:?}, confidence={}",
            score, importance, confidence
        );

        PriorityAnalysis {
            suggested_importance: importance,
            confidence,
            reasons,
            keywords_found,
            flags,
        }
    }

    fn analyze_patterns(
        &self,
        text: &str,
        score: &mut f32,
        reasons: &mut Vec<String>,
        flags: &mut Vec<PriorityFlag>,
    ) {
        // Check production patterns
        for pattern in &self.production_patterns {
            if pattern.is_match(text) {
                *score += 1.0;
                reasons.push("Matches production issue pattern".to_string());
                flags.push(PriorityFlag::ProductionBug);
                break;
            }
        }

        // Check security patterns
        for pattern in &self.security_patterns {
            if pattern.is_match(text) {
                *score += 1.2; // Security issues are highest priority
                reasons.push("Matches security issue pattern".to_string());
                flags.push(PriorityFlag::SecurityIssue);
                break;
            }
        }

        // Check customer patterns
        for pattern in &self.customer_patterns {
            if pattern.is_match(text) {
                *score += 0.8;
                reasons.push("Matches customer-reported issue pattern".to_string());
                flags.push(PriorityFlag::CustomerReported);
                break;
            }
        }

        // Check tech debt patterns
        for pattern in &self.tech_debt_patterns {
            if pattern.is_match(text) {
                *score -= 0.3; // Tech debt is typically lower priority
                reasons.push("Matches technical debt pattern".to_string());
                flags.push(PriorityFlag::TechDebt);
                break;
            }
        }
    }

    fn analyze_code_context(
        &self,
        context: &TaskContext,
        score: &mut f32,
        reasons: &mut Vec<String>,
        flags: &mut Vec<PriorityFlag>,
    ) {
        // Analyze file path for clues
        let file_path = &context.file.to_lowercase();

        // Production/critical files
        if file_path.contains("prod") || file_path.contains("production") {
            *score += 0.5;
            reasons.push("Code context involves production files".to_string());
            flags.push(PriorityFlag::ProductionBug);
        }

        // Security-related files
        if file_path.contains("auth")
            || file_path.contains("security")
            || file_path.contains("crypto")
        {
            *score += 0.6;
            reasons.push("Code context involves security-related files".to_string());
            flags.push(PriorityFlag::SecurityIssue);
        }

        // Performance-critical files
        if file_path.contains("perf")
            || file_path.contains("optimization")
            || file_path.contains("cache")
        {
            *score += 0.4;
            reasons.push("Code context involves performance-critical files".to_string());
            flags.push(PriorityFlag::Performance);
        }

        // Database/data files
        if file_path.contains("db")
            || file_path.contains("database")
            || file_path.contains("migration")
        {
            *score += 0.5;
            reasons.push("Code context involves database/data files".to_string());
            flags.push(PriorityFlag::DataLoss);
        }

        // Test files (lower priority)
        if file_path.contains("test") || file_path.contains("spec") {
            *score -= 0.2;
            reasons.push("Code context involves test files".to_string());
            flags.push(PriorityFlag::Testing);
        }

        // Documentation files (lowest priority)
        if file_path.contains("doc") || file_path.contains("readme") || file_path.ends_with(".md") {
            *score -= 0.4;
            reasons.push("Code context involves documentation files".to_string());
            flags.push(PriorityFlag::Documentation);
        }
    }

    fn calculate_importance_and_confidence(
        &self,
        score: f32,
        flags: &[PriorityFlag],
    ) -> (TaskImportance, f32) {
        // Priority flags override score-based calculation
        for flag in flags {
            match flag {
                PriorityFlag::SecurityIssue
                | PriorityFlag::ProductionBug
                | PriorityFlag::DataLoss => {
                    return (TaskImportance::High, 0.9);
                }
                PriorityFlag::CustomerReported | PriorityFlag::BreakingChange => {
                    return (TaskImportance::High, 0.8);
                }
                PriorityFlag::TechDebt | PriorityFlag::Documentation | PriorityFlag::Testing => {
                    if score > 0.5 {
                        return (TaskImportance::Normal, 0.6);
                    } else {
                        return (TaskImportance::Low, 0.7);
                    }
                }
                _ => {}
            }
        }

        // Score-based calculation
        let (importance, base_confidence) = if score >= 0.8 {
            (TaskImportance::High, 0.8)
        } else if score >= 0.4 {
            (TaskImportance::Normal, 0.6)
        } else if score <= -0.2 {
            (TaskImportance::Low, 0.7)
        } else {
            (TaskImportance::Normal, 0.5)
        };

        // Adjust confidence based on number of indicators
        let indicator_count = flags.len() as f32;
        let confidence = (base_confidence + (indicator_count * 0.1)).min(1.0);

        (importance, confidence)
    }

    /// Get auto-flag rules summary
    pub fn get_auto_flag_rules(&self) -> Vec<String> {
        vec![
            "Production bugs → High priority".to_string(),
            "Security issues → High priority".to_string(),
            "Customer-reported issues → High priority".to_string(),
            "Data loss risks → High priority".to_string(),
            "Breaking changes → High priority".to_string(),
            "Performance issues → Normal priority".to_string(),
            "Technical debt → Low priority (unless specified)".to_string(),
            "Documentation → Low priority".to_string(),
            "Tests → Low priority".to_string(),
        ]
    }
}

impl Default for TaskPriorityService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_security_issue_high_priority() {
        let service = TaskPriorityService::new();
        let analysis = service.analyze_priority(
            "Fix SQL injection vulnerability in login",
            Some("Critical security issue affecting user authentication"),
            None,
        );

        assert_eq!(analysis.suggested_importance, TaskImportance::High);
        assert!(analysis.confidence > 0.8);
        assert!(analysis.flags.contains(&PriorityFlag::SecurityIssue));
    }

    #[test]
    fn test_production_bug_high_priority() {
        let service = TaskPriorityService::new();
        let analysis = service.analyze_priority(
            "Production site is down",
            Some("Critical outage affecting all users"),
            None,
        );

        assert_eq!(analysis.suggested_importance, TaskImportance::High);
        assert!(analysis.confidence > 0.8);
        assert!(analysis.flags.contains(&PriorityFlag::ProductionBug));
    }

    #[test]
    fn test_documentation_low_priority() {
        let service = TaskPriorityService::new();
        let analysis = service.analyze_priority(
            "Update README documentation",
            Some("Add installation instructions to docs"),
            None,
        );

        assert_eq!(analysis.suggested_importance, TaskImportance::Low);
        assert!(analysis.flags.contains(&PriorityFlag::Documentation));
    }

    #[test]
    fn test_customer_reported_high_priority() {
        let service = TaskPriorityService::new();
        let analysis = service.analyze_priority(
            "Customer reports data not saving",
            Some("Multiple customers experiencing issues with data persistence"),
            None,
        );

        assert_eq!(analysis.suggested_importance, TaskImportance::High);
        assert!(analysis.flags.contains(&PriorityFlag::CustomerReported));
    }
}
