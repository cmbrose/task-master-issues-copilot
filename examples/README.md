# Task Master Issues - Examples

This directory contains example PRD (Product Requirements Document) files and their expected outputs to help you understand how Task Master Issues processes requirements and generates GitHub issues.

## Directory Structure

```
examples/
├── prds/                           # Example PRD files
│   ├── user-authentication-system.prd.md
│   ├── ecommerce-checkout-system.prd.md
│   └── mobile-push-notifications.prd.md
├── outputs/                        # Expected system outputs
│   ├── user-authentication-system-expected-issues.md
│   ├── ecommerce-checkout-expected-issues.md
│   └── mobile-push-notifications-expected-issues.md
└── README.md                       # This file
```

## Example PRDs

### 1. User Authentication System (Complex Epic)
**File**: `prds/user-authentication-system.prd.md`
- **Complexity**: 9 (Epic-level)
- **Estimated Hours**: 80
- **Expected Issues**: ~24 issues
- **Demonstrates**: 
  - Epic breakdown into features and tasks
  - Complex dependency relationships
  - Security and compliance requirements
  - Multiple integration points

### 2. E-commerce Checkout System (Large Feature)
**File**: `prds/ecommerce-checkout-system.prd.md`
- **Complexity**: 8 (High complexity feature)
- **Estimated Hours**: 64
- **Expected Issues**: ~18 issues
- **Demonstrates**:
  - Shopping cart management
  - Payment processing integration
  - Multi-step user flows
  - Third-party service dependencies

### 3. Mobile Push Notifications (Medium Feature)
**File**: `prds/mobile-push-notifications.prd.md`
- **Complexity**: 6 (Medium complexity feature)
- **Estimated Hours**: 32
- **Expected Issues**: ~12 issues
- **Demonstrates**:
  - Cross-platform mobile development
  - Third-party service integration
  - User experience considerations
  - Analytics and monitoring

## How to Use These Examples

### 1. Copy and Customize
You can use these examples as templates for your own PRDs:

```bash
# Copy an example to your docs directory
cp examples/prds/user-authentication-system.prd.md docs/my-feature.prd.md

# Edit the copied file to match your requirements
# Update the YAML frontmatter and content sections
```

### 2. Test with Dry Run
Test how the system would process your PRD:

```bash
# Place your PRD in the docs/ directory
# Run in dry-run mode to see expected output
gh workflow run taskmaster.yml -f dry_run=true
```

### 3. Study the Expected Outputs
Review the expected output files to understand:
- How epics get broken down into features and tasks
- How dependencies are established between issues
- What labels and metadata are automatically generated
- How complexity affects task breakdown

## PRD Writing Guidelines

Based on these examples, here are key guidelines for writing effective PRDs:

### YAML Frontmatter Requirements
```yaml
---
task_id: unique-identifier        # Required: Unique ID for the task
title: Human Readable Title       # Required: Clear, descriptive title
complexity: 7                     # Required: 1-10 scale
priority: high                    # Optional: low, medium, high, critical
labels:                          # Optional: List of relevant labels
  - backend
  - frontend
  - api
estimated_hours: 40              # Optional: Time estimate
dependencies:                    # Optional: List of blocking task IDs
  - other-task-id
milestone: "Sprint 1"            # Optional: Target milestone
assignee: "team-name"            # Optional: Default assignee
---
```

### Content Structure Best Practices

1. **Overview Section**: Clear problem statement and solution summary
2. **Epic Breakdown**: Logical grouping of features (for epics)
3. **Technical Requirements**: Detailed implementation specifications
4. **Acceptance Criteria**: Testable, measurable success criteria
5. **Dependencies**: Clear identification of blocking requirements
6. **Implementation Timeline**: Realistic phase breakdown

### Complexity Guidelines

- **1-3 (Low)**: Simple tasks, < 8 hours
- **4-6 (Medium)**: Features requiring multiple tasks, 8-40 hours  
- **7-8 (High)**: Complex features with integrations, 40-80 hours
- **9-10 (Epic)**: Large initiatives spanning multiple features, 80+ hours

## Performance Characteristics

These examples demonstrate the system's performance capabilities:

### User Authentication System (Epic)
- **Processing Time**: ~45 seconds
- **Generated Issues**: 24
- **API Calls**: ~72
- **Memory Usage**: ~15MB

### E-commerce Checkout (High Complexity)
- **Processing Time**: ~30 seconds
- **Generated Issues**: 18
- **API Calls**: ~54
- **Memory Usage**: ~12MB

### Mobile Push Notifications (Medium Complexity)
- **Processing Time**: ~20 seconds
- **Generated Issues**: 12
- **API Calls**: ~36
- **Memory Usage**: ~8MB

All examples complete well within the 5-minute performance requirement.

## Common Patterns

### Epic Pattern (Complexity 9-10)
```
Epic Issue (Parent)
├── Feature 1 (3-5 tasks)
├── Feature 2 (3-5 tasks)  
├── Feature 3 (3-5 tasks)
└── Feature N (3-5 tasks)
```

### Feature Pattern (Complexity 6-8)
```
Feature Issue (Parent)
├── Task 1 (Implementation)
├── Task 2 (Testing)
├── Task 3 (Documentation)
└── Task 4 (Integration)
```

### Simple Task Pattern (Complexity 1-5)
```
Single Issue (No breakdown)
- Direct implementation
- Self-contained work
- Clear deliverables
```

## Testing Your PRDs

### Validation Checklist
- [ ] YAML frontmatter is valid
- [ ] Required fields are present (task_id, title, complexity)
- [ ] Complexity matches content scope
- [ ] Dependencies reference valid task IDs
- [ ] Acceptance criteria are testable
- [ ] Implementation sections are detailed enough

### Common Issues to Avoid
- **Missing YAML frontmatter**: System cannot parse the PRD
- **Invalid complexity values**: Must be 1-10
- **Circular dependencies**: Tasks cannot depend on themselves
- **Overly broad scope**: High complexity with minimal detail
- **Unclear acceptance criteria**: Not testable or measurable

## Integration with Development Workflow

### Recommended Workflow
1. **Planning**: Write comprehensive PRDs during planning phases
2. **Review**: Team reviews PRDs before committing to repository
3. **Generation**: Commit PRDs to trigger automatic issue creation
4. **Refinement**: Use `/breakdown` commands for additional decomposition
5. **Execution**: Developers work on generated issues in dependency order
6. **Tracking**: Monitor progress through GitHub issue status

### Branch Strategy
```
main
├── feature/auth-system          # Work on authentication epic
├── feature/checkout-flow        # Work on checkout feature  
└── feature/push-notifications   # Work on notification feature
```

### Issue Labels Strategy
- **Complexity**: `low-complexity`, `medium-complexity`, `high-complexity`, `epic`
- **Type**: `epic`, `feature`, `task`
- **Domain**: `backend`, `frontend`, `mobile`, `api`, `database`
- **Status**: `blocked`, `in-progress`, `review`, `done`

## Customization Options

You can customize the system behavior through configuration:

### Custom Label Mapping
```yaml
# .taskmaster/config.yml
label_mapping:
  backend: [backend, server, api]
  frontend: [frontend, ui, web]
  mobile: [mobile, ios, android]
```

### Custom Complexity Thresholds
```yaml
complexity_mapping:
  1-2: trivial
  3-4: low
  5-6: medium
  7-8: high
  9-10: epic
```

### Custom Issue Templates
```yaml
templates:
  epic:
    title_format: "[EPIC] {title}"
    labels: [epic, taskmaster-generated]
  feature:
    title_format: "[FEATURE] {title}"
    labels: [feature, taskmaster-generated]
```

## Next Steps

1. **Try the Examples**: Process these examples in your repository
2. **Write Your First PRD**: Use the templates to create your own PRD
3. **Configure the System**: Customize labels and templates to match your workflow
4. **Integrate with Planning**: Incorporate PRD writing into your planning process
5. **Train Your Team**: Share these examples with your development team

For more information, see:
- [Setup Instructions](../docs/setup-instructions.md)
- [User Guide](../docs/user-guide.md)
- [Configuration Options](../docs/configuration-options.md)
- [Troubleshooting Guide](../docs/troubleshooting-guide.md)