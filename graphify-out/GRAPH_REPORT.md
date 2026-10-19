# Graph Report - motorcycle-simulator  (2026-10-19)

## Corpus Check
- Corpus is ~23,090 words - fits in a single context window. You may not need a graph.

## Summary
- 307 nodes · 425 edges · 25 communities (13 shown, 12 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- 3D Scene and Application Loop
- Physics Engine and Dynamics
- Three.js Core 3D Types
- HUD Dashboard and Telemetry
- LaTeX Math and Dynamics SVGs
- Package Dependencies and Manifest
- LaTeX SVG Generator Script
- Fallback 3D Geometries
- Keyboard Input and Controls
- Fallback Color and Fog Shading
- Fallback Scene Graph Meshes
- Fallback Matrix Transform and Clipping
- Braking and Longitudinal Motion
- Fallback Euler and Quaternion Math
- Fallback Perspective Camera
- Fallback Canvas WebGL Renderer
- Fall Mechanics and Crash UI
- Liang-Barsky Line Clipping
- First-Person Rider Viewport
- Fixed-Timestep Physics Integration
- Steering Regime Transition
- Infinite Grid Ground System
- Project Overview and Structure
- Three.js Import Map Configuration
- Browser Frame Loop Benchmark

## God Nodes (most connected - your core abstractions)
1. `MotorcyclePhysics` - 21 edges
2. `FallbackVector3` - 14 edges
3. `ControlsManager` - 13 edges
4. `FallbackColor` - 11 edges
5. `FallbackObject3D` - 11 edges
6. `SimulationScene` - 10 edges
7. `DashboardUI` - 9 edges
8. `MotorcycleSimulatorApp` - 8 edges
9. `FallbackMatrix4` - 8 edges
10. `MotorcycleModel` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Model Limitations` --semantically_similar_to--> `Model Assumptions and Simplifications`  [INFERRED] [semantically similar]
  README.md → reports/PHYSICS_MODEL.md
- `Counter-Steering Mechanics` --conceptually_related_to--> `Transient Roll Differential Equation`  [EXTRACTED]
  README.md → reports/PHYSICS_MODEL.md
- `Fixed-Timestep Numerical Integration` --conceptually_related_to--> `Physics Step Benchmark`  [INFERRED]
  feature/FEATURES.md → reports/PERFORMANCE_REPORT.md
- `Qwen Documentation Protocol` --references--> `Changelog Release 1.0.0`  [EXTRACTED]
  Qwen.md → changelog/CHANGELOG.md
- `Qwen Documentation Protocol` --references--> `Interactive HUD, Dashboard and Telemetry`  [EXTRACTED]
  Qwen.md → feature/FEATURES.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Counter-Steering Dynamics System** — readme_countersteering, reports_physics_model_outtrack_moment, reports_physics_model_gyroscopic_moment, feature_features_steering_countersteering, reports_test_report_countersteering_test [EXTRACTED 1.00]
- **Fall and Momentum Mechanics Subsystem** — changelog_changelog_v1_1_0, feature_features_momentum_balance_fall, index_fall_overlay [EXTRACTED 1.00]
- **Coulomb Braking Verification Pipeline** — changelog_changelog_coulomb_brake_fix, reports_test_report_bug_coulomb_braking, reports_physics_model_longitudinal_motion, feature_features_rear_wheel_braking [EXTRACTED 1.00]
- **Steering Angle Sign and Deflection Conventions** — assets_latex_delta_steering_angle, assets_latex_minus_delta_steer_left, assets_latex_plus_delta_steer_right [INFERRED 0.95]
- **Steady-State Cornering Balance Equations** — assets_latex_a_y_lateral_acceleration, assets_latex_atan_ay_g_roll_formula, assets_latex_phi_lean_angle [INFERRED 0.95]
- **Yaw Heading and Turn Rate Kinematics** — assets_latex_psi_yaw_angle, assets_latex_psi_dot_yaw_rate, assets_latex_r_eq_psi_dot_yaw_rate_equivalence [INFERRED 0.95]
- **Planar Motorcycle Dynamics Degrees of Freedom** — assets_latex_a_x_longitudinal_acceleration, assets_latex_a_y_lateral_acceleration, assets_latex_delta_steering_angle, assets_latex_phi_lean_angle, assets_latex_psi_yaw_angle [INFERRED 0.85]

## Communities (25 total, 12 thin omitted)

### Community 0 - "3D Scene and Application Loop"
Cohesion: 0.08
Nodes (7): three, RiderCamera, MotorcycleSimulatorApp, MotorcycleModel, SimulationScene, DashboardUI, TelemetryUI

### Community 1 - "Physics Engine and Dynamics"
Cohesion: 0.08
Nodes (22): createPhysicsConfig, DEFAULT_PHYSICS_CONFIG, compute_gyroscopic_effects(), compute_lateral_tire_dynamics(), compute_longitudinal_forces(), computeGyroscopicEffects, computeLateralTireDynamics, computeLongitudinalForces (+14 more)

### Community 2 - "Three.js Core 3D Types"
Cohesion: 0.08
Nodes (24): AmbientLight, BoxGeometry, BufferGeometry, Color, CylinderGeometry, DirectionalLight, Euler, Fog (+16 more)

### Community 3 - "HUD Dashboard and Telemetry"
Cohesion: 0.10
Nodes (20): Changelog Release 1.0.0, Steering Actuator and Counter-Steering Dynamics, Interactive HUD, Dashboard and Telemetry, Wheel Spin and Gyroscopic Precession Moments, HUD Controls Panel, Dashboard Speedometer, Physics Telemetry Panel, Qwen Documentation Protocol (+12 more)

### Community 4 - "LaTeX Math and Dynamics SVGs"
Cohesion: 0.12
Nodes (10): Longitudinal Acceleration (a_x), Lateral Acceleration (a_y), Steady-State Roll Angle Equilibrium (arctan(a_y/g)), Steering Angle (delta), Negative Steering Angle / Steer Left (-delta), Motorcycle Roll / Lean Angle (phi), Positive Steering Angle / Steer Right (+delta), Yaw Rate (psi_dot) (+2 more)

### Community 5 - "Package Dependencies and Manifest"
Cohesion: 0.10
Nodes (19): author, dependencies, katex, mathjax-full, three, description, engines, node (+11 more)

### Community 6 - "LaTeX SVG Generator Script"
Cohesion: 0.12
Nodes (13): mathjax-full, adaptor, __dirname, __filename, html, out_dir, root_dir, symbols (+5 more)

### Community 7 - "Fallback 3D Geometries"
Cohesion: 0.13
Nodes (5): FallbackBoxGeometry, FallbackBufferGeometry, FallbackCylinderGeometry, FallbackPlaneGeometry, FallbackVector3

### Community 9 - "Fallback Color and Fog Shading"
Cohesion: 0.17
Nodes (4): FallbackColor, FallbackFog, FallbackLight, FallbackMaterial

### Community 10 - "Fallback Scene Graph Meshes"
Cohesion: 0.20
Nodes (5): FallbackGridHelper, FallbackGroup, FallbackMesh, FallbackObject3D, FallbackScene

### Community 12 - "Braking and Longitudinal Motion"
Cohesion: 0.29
Nodes (5): Coulomb Brake Stiction Fix, Longitudinal Dynamics and Aerodynamic Drag, Rear-Wheel Friction Braking, Longitudinal Equations of Motion, Centralized SI Physical Parameters

### Community 16 - "Fall Mechanics and Crash UI"
Cohesion: 1.00
Nodes (3): Changelog Release 1.1.0, Lean-Angle Momentum Balance and Fall Mechanics, Fall / Crash Notification Overlay

### Community 18 - "First-Person Rider Viewport"
Cohesion: 0.67
Nodes (3): First-Person Rider Camera with Roll Coupling, Simulation Viewport Canvas, End-to-End Headless Browser Verification

## Knowledge Gaps
- **22 isolated node(s):** `katex`, `3D Motorcycle Physics Simulator Overview`, `Project Structure`, `Model Limitations`, `Changelog Release 1.0.0` (+17 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 138 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `3D Scene and Application Loop` to `Package Dependencies and Manifest`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **What connects `katex`, `3D Motorcycle Physics Simulator Overview`, `Project Structure` to the rest of the system?**
  _22 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `3D Scene and Application Loop` be split into smaller, more focused modules?**
  _Cohesion score 0.07653061224489796 - nodes in this community are weakly interconnected._
- **Why does `MotorcyclePhysics` connect `Physics Engine and Dynamics` to `3D Scene and Application Loop`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `Physics Engine and Dynamics` be split into smaller, more focused modules?**
  _Cohesion score 0.07585568917668825 - nodes in this community are weakly interconnected._
- **Why does `mathjax-full` connect `LaTeX SVG Generator Script` to `Package Dependencies and Manifest`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Should `Three.js Core 3D Types` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._