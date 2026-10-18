# Motorcycle Physics Model Report (`PHYSICS_MODEL.md`)

## 1. Coordinate System and Sign Conventions

The simulator uses a right-handed Three.js world coordinate system paired with a consistent vehicle-dynamics sign convention across steering, roll, and yaw:

- **World Axes**:
  - $+X$: East / Right ($\text{m}$)
  - $+Y$: Vertical Up against gravity ($\text{m}$, ground plane at $Y = 0$)
  - $-Z$: Initial forward heading direction ($\psi = 0\text{ rad}$)
- **Vehicle Attitude & Angular Sign Conventions**:
  - **Steering-Bar Angle ($\delta$)**:
    - $\delta < 0\text{ rad}$: Handlebars steered **Left** (`A` key)
    - $\delta > 0\text{ rad}$: Handlebars steered **Right** (`D` key)
  - **Motorcycle Roll / Lean Angle ($\phi$)**:
    - $\phi < 0\text{ rad}$: Motorcycle leaned **Left** (tilted toward left side)
    - $\phi > 0\text{ rad}$: Motorcycle leaned **Right** (tilted toward right side)
  - **Heading ($\psi$) and Yaw Rate ($r = \dot{\psi}$)**:
    - $r < 0\text{ rad/s}$: Turning **Left** (counter-clockwise viewed from above)
    - $r > 0\text{ rad/s}$: Turning **Right** (clockwise viewed from above)
  - **World Trajectory Integration**:
    $$\dot{x} = v \sin\psi, \qquad \dot{z} = -v \cos\psi$$

Using positive-right / negative-left consistently for $(\delta, \phi, r, a_y)$ makes counter-steering immediately transparent in telemetry: at riding speeds, a negative steering input ($\delta < 0$, left steer) generates positive out-tracking and gyroscopic roll moments ($M_{\text{roll}} > 0$), driving a positive lean angle ($\phi > 0$, right lean) and positive yaw rate ($r > 0$, right turn).

---

## 2. Physical Parameters and SI Units (`src/physics/config.js`)

All internal state variables and parameters strictly use SI units:

| Parameter | Symbol | Default Value | SI Unit | Description |
| :--- | :---: | :---: | :---: | :--- |
| Fixed Timestep | $\Delta t$ | $0.008333$ ($1/120$) | $\text{s}$ | Deterministic physics integration step |
| Max Catch-Up Substeps | $N_{\max}$ | $8$ | — | Maximum physics steps per rendered frame |
| Gravitational Acceleration | $g$ | $9.81$ | $\text{m/s}^2$ | Standard gravity |
| Air Density | $\rho$ | $1.225$ | $\text{kg/m}^3$ | Sea-level atmospheric density |
| Total Mass | $m$ | $215.0$ | $\text{kg}$ | Combined mass of motorcycle and rider (adjustable in UI) |
| Main Body Dimensions | $L_b \times H_b \times W_b$ | $2.0 \times 1.1 \times 0.35$ | $\text{m}$ | Reference black cuboid body dimensions |
| Wheelbase | $L$ | $1.42$ | $\text{m}$ | Distance between front and rear tire contact patches |
| Center of Gravity Height | $h$ | $0.62$ | $\text{m}$ | Height of combined CG above the ground plane |
| Rear Axle to CG Distance | $b$ | $0.68$ | $\text{m}$ | Longitudinal distance from rear contact patch to CG |
| Caster / Rake Angle | $\epsilon$ | $0.4189$ ($24^\circ$) | $\text{rad}$ | Steering head axis inclination from vertical |
| Mechanical Trail | $c$ | $0.095$ | $\text{m}$ | Ground trail of front contact patch behind steering axis |
| Roll Moment of Inertia | $I_{xx}$ | $92.0$ | $\text{kg}\cdot\text{m}^2$ | Roll inertia about ground contact roll axis |
| Wheel Effective Radius | $R_w$ | $0.31$ | $\text{m}$ | Front and rear tire rolling radius |
| Single-Wheel Polar Inertia | $I_{wy}$ | $0.68$ | $\text{kg}\cdot\text{m}^2$ | Rotational spin inertia of one wheel assembly |
| Max Engine Drive Force | $F_{\text{eng,max}}$ | $3450.0$ | $\text{N}$ | Peak low-speed rear-wheel tractive effort |
| Max Engine Power | $P_{\max}$ | $72000.0$ | $\text{W}$ | Power envelope limit at higher speeds ($\approx 96\text{ hp}$) |
| Aerodynamic Drag Area | $C_d A$ | $0.58$ | $\text{m}^2$ | Effective drag coefficient times frontal area |
| Rolling Resistance Coeff | $C_{rr}$ | $0.015$ | — | Tire rolling resistance coefficient |
| Max Rear Brake Force | $F_{\text{brake,max}}$ | $1750.0$ | $\text{N}$ | Maximum rear-wheel braking force (adjustable in UI) |
| Max Steering Angle | $\delta_{\max}$ | $0.4887$ ($28^\circ$) | $\text{rad}$ | Physical handlebar lock limit |
| Max Lean Angle | $\phi_{\max}$ | $0.9250$ ($53^\circ$) | $\text{rad}$ | Maximum bank angle limit |
| Regime Crossover Speed | $v_{\text{trans}}$ | $3.60$ ($13\text{ km/h}$) | $\text{m/s}$ | Characteristic transition speed between kinematic and counter-steer regimes |

---

## 3. Governing Equations

### 3.1 Longitudinal Motion (`src/physics/forces.js`)

Given persistent throttle command $u_{\text{thr}} \in [0, 1]$ and rear-brake engagement $u_{\text{brk}} \in [0, 1]$:

1. **Drive Force** (with power roll-off above $8\text{ m/s}$):
   $$F_{\text{drive}}(u_{\text{thr}}, v) = u_{\text{thr}} \cdot \min\!\left(F_{\text{eng,max}},\, \frac{P_{\max}}{\max(v, 8.0)}\right)$$

2. **Aerodynamic Drag**:
   $$F_{\text{drag}}(v) = \frac{1}{2} \rho (C_d A) v |v|$$

3. **Coulomb Rolling Resistance**:
   $$F_{\text{roll}}(v) = \begin{cases} C_{rr} m g & v > 0 \text{ or } F_{\text{drive}} > 0 \\ 0 & \text{otherwise} \end{cases}$$

4. **Closed-Throttle Engine Compression Braking**:
   $$F_{\text{eng,brk}}(u_{\text{thr}}, v) = \max(0, 1 - 2.5\,u_{\text{thr}}) \cdot (c_{\text{base}} + c_{\text{lin}} v) \quad (\text{for } v > 0)$$

5. **Rear-Wheel Braking Force**:
   $$F_{\text{brake}}(u_{\text{brk}}, v) = \begin{cases} u_{\text{brk}} F_{\text{brake,max}} & v > 0 \text{ or } F_{\text{drive}} > 0 \\ 0 & \text{otherwise} \end{cases}$$

6. **Newton's Second Law & Non-Negative Speed Clamping**:
   $$F_{\text{net}} = F_{\text{drive}} - \left(F_{\text{drag}} + F_{\text{roll}} + F_{\text{eng,brk}} + F_{\text{brake}}\right)$$
   If $v = 0$ and $F_{\text{net}} < 0$, static friction clamps $F_{\text{net}} = 0$ and $a_x = 0$. Otherwise:
   $$a_x = \frac{F_{\text{net}}}{m}, \qquad v(t + \Delta t) = \max\!\left(0,\, v(t) + a_x \Delta t\right)$$

---

### 3.2 Steering Geometry and Trail Alignment (`src/physics/steering.js`)

The rider controls normalized steering input $u_{\text{steer}} \in [-1, 1]$ via `A` ($-1$) and `D` ($+1$), scaled by adjustable steering sensitivity $S \in [0.25, 2.50]$.

1. **Neutral Self-Aligning Steering Angle ($\delta_{\text{neutral}}$)**:
   When banked at lean angle $\phi$ at riding speeds, front-end mechanical trail and tire camber cause the front wheel to align slightly into the turn:
   $$\delta_{\text{neutral}}(\phi, v) = k_{\text{align}} \arctan\!\left(\frac{L g \tan\phi}{(v^2 + v_0^2)\cos\epsilon}\right)$$

2. **Speed-Scaled Rider Deflection Authority**:
   $$\alpha_{\text{speed}}(v) = \max\!\left(0.22,\, \frac{1}{1 + (v / v_{\text{scale}})^{1.35}}\right)$$
   $$\delta_{\text{target}} = \begin{cases} \operatorname{clamp}\!\left(u_{\text{steer}} \cdot \delta_{\max} \cdot \alpha_{\text{speed}}(v) \cdot (0.55 + 0.45 S),\, -\delta_{\max},\, \delta_{\max}\right) & |u_{\text{steer}}| > 0 \\ \delta_{\text{neutral}}(\phi, v) & u_{\text{steer}} = 0 \end{cases}$$

3. **First-Order Handlebar Actuator Dynamics**:
   $$\delta(t + \Delta t) = \delta(t) + \left(\delta_{\text{target}} - \delta(t)\right)\left(1 - e^{-\lambda_{\text{steer}} \Delta t}\right), \qquad \dot{\delta} = \frac{\delta(t+\Delta t) - \delta(t)}{\Delta t}$$
   The **active counter-steering deflection** relative to the steady-turn kinematic alignment is:
   $$\delta_{\text{active}} = \delta - \delta_{\text{neutral}}(\phi, v)$$

---

### 3.3 Counter-Steering, Gyroscopic Precession, and Transient Roll Dynamics (`src/physics/leanDynamics.js`)

Roll angle $\phi$ and roll angular rate $\dot{\phi}$ evolve according to the rotational equation of motion about the tire-ground contact line:

$$I_{xx} \ddot{\phi} = M_{\text{outtrack}} + M_{\text{gyro}} + M_{\text{low}} + M_{\text{restore}} + M_{\text{damp}}$$

1. **Regime Weighting Functions**:
   $$w_{\text{low}}(v) = \exp\!\left(-1.35 \left(\frac{v}{v_{\text{trans}}}\right)^2\right), \qquad w_{\text{high}}(v) = 1 - w_{\text{low}}(v)$$

2. **Centrifugal Out-Tracking Roll Moment ($M_{\text{outtrack}}$)**:
   When the rider deflects the front wheel by $\delta_{\text{active}}$ at riding speed, the front tire contact patch tracks laterally beneath the elevated center of mass ($h = 0.62\text{ m}$), producing an opposing centrifugal capsize torque:
   $$v_{\text{eff}}^2 = \frac{0.48\,v^2}{1 + (v / 14.5)^2}$$
   $$M_{\text{outtrack}} = -w_{\text{high}}(v)\, m h \left[ \frac{v_{\text{eff}}^2}{L} \tan(\delta_{\text{active}} \cos\epsilon) + 0.25 \frac{b}{L} \min(v, 18) \dot{\delta} \cos\epsilon \right]$$
   - Because of the leading minus sign, steering **left** ($\delta_{\text{active}} < 0$, $\dot{\delta} < 0$) yields $M_{\text{outtrack}} > 0$, rolling the motorcycle **right** ($\ddot{\phi} > 0 \implies \phi > 0$).

3. **Wheel Gyroscopic Precession Roll Moment ($M_{\text{gyro}}$)**:
   Each wheel spins at angular velocity $\omega_w = v / R_w$ with polar angular momentum $H_w = I_{wy} \omega_w$. Turning the spinning front wheel about the steering axis at rate $\dot{\delta}$ (and deflection $\delta_{\text{active}}$) produces a gyroscopic reaction moment about the roll axis:
   $$M_{\text{gyro}} = -0.65\, w_{\text{high}}(v)\, I_{wy} \frac{v}{R_w} \cos\epsilon \left( \dot{\delta} + 0.85 \frac{v}{L} \delta_{\text{active}} \right)$$
   - Steering **left** ($\dot{\delta} < 0$) produces $M_{\text{gyro}} > 0$ (rightward roll torque), reinforcing the out-tracking counter-steer initiation.

4. **Low-Speed Kinematic Balance Moment ($M_{\text{low}}$)**:
   At walking speeds ($v \ll v_{\text{trans}}$), $w_{\text{low}}(v) \to 1$ and the motorcycle leans gently into the direct kinematic turn curvature:
   $$\phi_{\text{low,target}} = \arctan\!\left(\frac{k_{\text{low}} a_{y,\text{kin}}}{g}\right), \qquad M_{\text{low}} = w_{\text{low}}(v) K_{\text{base}} (\phi_{\text{low,target}} - \phi)$$

5. **Roll Restoring Equilibrium & Damping ($M_{\text{restore}}, M_{\text{damp}}$)**:
   $$M_{\text{restore}} = -\left(w_{\text{high}}(v) K_{\text{high}} + (1 - w_{\text{high}}(v)) K_0 + K_{\text{bound}}(\phi)\right)\phi$$
   $$M_{\text{damp}} = -(C_{\phi,0} + C_{\phi,v} \min(v, 35))\dot{\phi}$$
   When the rider releases the handlebars ($u_{\text{steer}} = 0$), $\delta \to \delta_{\text{neutral}}(\phi, v)$ so $\delta_{\text{active}} \to 0$, and $K_{\text{high}}$ switches to the gentle weave/capsize self-righting stiffness ($95\text{ N}\cdot\text{m/rad}$), allowing the motorcycle to hold its banked turn trajectory and smoothly return upright over several seconds.

---

### 3.4 Lateral Tire Response, Turning Trajectory, and Steady-State Lean Relation (`src/physics/forces.js`)

1. **Low-Speed Kinematic vs. High-Speed Camber Thrust**:
   - Kinematic front-wheel yaw rate:
     $$r_{\text{kin}} = \frac{v}{L} \tan(\delta \cos\epsilon), \qquad a_{y,\text{kin}} = v\,r_{\text{kin}}$$
   - High-speed camber-thrust lateral acceleration and yaw rate:
     $$a_{y,\text{camber}} = g \tan\phi, \qquad r_{\text{camber}} = \frac{g \tan\phi}{v}$$
   - Combined target response:
     $$a_{y,\text{target}} = w_{\text{low}}(v)\,a_{y,\text{kin}} + w_{\text{high}}(v)\,a_{y,\text{camber}}$$
     $$r_{\text{target}} = w_{\text{low}}(v)\,r_{\text{kin}} + w_{\text{high}}(v)\,r_{\text{camber}}$$

2. **First-Order Tire Relaxation**:
   $$a_y(t + \Delta t) = a_y(t) + \left(a_{y,\text{target}} - a_y(t)\right)\left(1 - e^{-k_{\text{tire}} \Delta t}\right)$$
   $$r(t + \Delta t) = r(t) + \left(r_{\text{target}} - r(t)\right)\left(1 - e^{-k_{\text{tire}} \Delta t}\right)$$

3. **Consistency with Idealized Steady-Turn Reference**:
   In any steady or quasi-steady turn at riding speed ($w_{\text{high}}(v) \approx 1$), $a_y \to g \tan\phi$, satisfying:
   $$\tan(\phi) = \frac{a_y}{g} = \frac{v\,r}{g}$$
   Both the actual dynamic roll angle $\phi$ and the idealized steady-state reference $\phi_{\text{ref}} = \arctan(a_y / g)$ are computed and displayed side-by-side in the Telemetry panel so users can observe transient roll lead during counter-steering versus steady-state convergence during sustained cornering.

---

## 4. Assumptions and Differences from Real-World Motorcycle Dynamics

1. **Lumped Single-Track Roll Equilibrium**: In a physical motorcycle, the gravitational roll moment $m g h \sin\phi$ and centrifugal roll moment $-m v r h \cos\phi$ cancel at $\tan\phi = v r / g$, while the front steering assembly is a free second-order rotational body driven by mechanical trail forces, tire pneumatic trail, caster vertical lift, and rider hand torque. To guarantee unconditional numerical stability across all frame rates and keyboard inputs without high-frequency wobble oscillations, handlebar deflection $\delta$ is modeled as a speed-scaled actuator with trail alignment $\delta_{\text{neutral}}(\phi, v)$, and the net roll moment is expanded around the steady-turn equilibrium.
2. **Rigid Suspension & Flat Ground**: Pitch squat/dive is represented visually in the rider camera ($\pm 2^\circ$ proportional to $a_x$), while the physical wheelbase $L$, caster $\epsilon$, and CG height $h$ remain constant.
3. **Bounded Bank Envelope**: Instead of simulating tire slide-out (lowside) when $\tan\phi$ exceeds the tire friction coefficient $\mu$, bank angle is bounded at $\pm 53^\circ$ ($\pm 0.925\text{ rad}$).
