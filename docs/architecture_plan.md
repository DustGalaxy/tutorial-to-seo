# Architecture Blueprint: Maximus Core SEO Course Platform

**Permanent Reference Document**  
*Saved: 2026-09-21*

---

## 1. Guiding Principles & Strategy

1. **Core First, Content Later**:
   - Focus 100% on building the **solid, modular core engine**.
   - The existing 17-mission course (*"Сходинки в SEO — Максимус"*) serves as our golden benchmark.
2. **Swappable Backend (Strategy Pattern)**:
   - Client and server decoupled through an abstract `StorageProvider` / `CourseProvider` interface.
   - Allows switching between **Local Offline (`localStorage`)** and **Full-Stack API (FastAPI / SQLite)** via a single configuration toggle.
3. **Headless Accessible Primitives in Retro Skin (Radix UI / shadcn)**:
   - We deliberately adopt Radix UI primitives (`Dialog`, `Progress`, `Tooltip`, `Accordion`, etc.) to inherit reliable, battle-tested accessibility, keyboard focus trapping, and modal behavior out of the box.
   - We customize them with our signature **retro 90s OS styling**: sharp edges (`rounded-none`), 3D bevels, classic royal blue title bars, tactile push buttons, and the paper/ink color palette.
4. **No-Graphic-Skills Board System**:
   - Course creators do not need to paint heavy graphic illustrations.
   - The board engine supports procedural retro vector backgrounds (dot-grid, blueprint, parchment) **OR** custom image backgrounds.
   - Node positions `(x, y)` are free-form, and the SVG engine auto-calculates and renders connection paths based on prerequisites (`requires: [...]`).
5. **"Free Space" Extensible Step Registry**:
   - The 4 core step types (`choice`, `assemble`, `match`, `number`) are formalized into a pluggable `StepRegistry`.
   - Clean extension points ("free space") are reserved so specialized SEO tools (SERP crafter, robots.txt validator, audit table) can be plugged in later without modifying core engine logic.
6. **Configurable Mentor Personas**:
   - Mentor profiles are decoupled (`{ id, name, title, avatar, voice }`). Maximus remains the flagship mentor, with support for future hardware companions.

---

## 2. System Architecture

```
+-------------------------------------------------------------------------+
|                              Maximus Core                               |
+-------------------------------------------------------------------------+
|                                                                         |
|  [ Content Provider Strategy ]          [ Storage Provider Strategy ]   |
|  +----------------------------+         +----------------------------+  |
|  | - LocalCourseProvider      |         | - LocalStorageProvider     |  |
|  | - ApiCourseProvider        |         | - ApiStorageProvider       |  |
|  +----------------------------+         +----------------------------+  |
|                 \                                     /                 |
|                  \                                   /                  |
|                   v                                 v                   |
|  +-------------------------------------------------------------------+  |
|  |                           Course Engine                           |  |
|  |   - Course State Machine (Progression DAG, Unlock Resolver)       |  |
|  |   - Mentor / Dialog Controller (Maximus & future avatars)         |  |
|  |   - Web Audio FX Synthesizer (Triangle wave chimes & buzzes)      |  |
|  +-------------------------------------------------------------------+  |
|                 /                                   \                   |
|                /                                     \                  |
|               v                                       v                 |
|  +-------------------------+             +---------------------------+  |
|  |     Roadmap Board       |             |       Step Registry       |  |
|  | - Configurable BG       |             | - 'choice'                |  |
|  |   (Grid/Tiles/Image)    |             | - 'assemble'              |  |
|  | - SVG Road Auto-Router  |             | - 'match'                 |  |
|  | - Responsive Viewport   |             | - 'number'                |  |
|  +-------------------------+             | - [Free Space for Future] |  |
|                                          +---------------------------+  |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |               Retro Desktop UI Presentation Layer                 |  |
|  |    - Headless Radix UI / shadcn Primitives in Retro OS Skin       |  |
|  |    - Windows 95/98 Window Chrome, 3D Bevels, CSS Design Tokens    |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## 3. Component Specifications

### 1. Swappable Backend Layer (Strategy Pattern)

```typescript
// Data & Storage Contracts
export interface CourseProvider {
  getCourse(courseId: string): Promise<CourseManifest>;
  listCourses(): Promise<CourseSummary[]>;
}

export interface StorageProvider {
  loadProgress(courseId: string): Promise<UserCourseProgress>;
  saveProgress(courseId: string, state: UserCourseProgress): Promise<void>;
  resetProgress(courseId: string): Promise<void>;
}
```

- **`LocalStrategy` (Default)**: Reads bundled course JSON, persists in `localStorage` / `IndexedDB`. Zero server required; runs anywhere as static/PWA.
- **`ApiStrategy` (Full-Stack)**: Communicates with FastAPI/SQLite backend for multi-device sync and progress analytics.

---

### 2. UI Component Strategy: Radix Primitives + Retro Skin

We extract what we need from Radix UI / shadcn for accessibility and wrap them in retro CSS classes:

| Primitive | Underlying Radix Primitive | Retro Adaptation |
| :--- | :--- | :--- |
| **`WindowDialog`** | `@radix-ui/react-dialog` | Sharp corners (`rounded-none`), blue title bar with `[×]` button, 3D beveled borders (`box-shadow: inset 1px 1px 0 #fff, inset -1px -1px 0 #8a887e`), classic backdrop. |
| **`ProgressMeter`**| `@radix-ui/react-progress` | Segmented pixel block meter instead of a smooth pill. |
| **`TactileButton`**| Base component / Slot | Chunky raised button with inverted inset shadow on `:active`. |
| **`CodexAccordion`**| `@radix-ui/react-accordion`| Classic collapsible tree/folder view for glossary & sources. |
| **`DesktopTooltip`**| `@radix-ui/react-tooltip` | Retro pale-yellow desktop tooltip with 1px black border. |

---

### 3. Roadmap Board Engine

- **Visual Themes**:
  - `procedural-grid`: Subtle retro dot-grid or blueprint grid.
  - `retro-parchment`: Classic warm manual paper texture (`#fffdf0`).
  - `custom-image`: Image asset if supplied (like the existing Maximus PNG).
- **Auto-Routed SVG Roads**: Automatically draws quadratic/cubic Bezier curves or 90-degree orthogonal circuit traces between node dependencies (`requires: ['m1']`).
- **Dynamic Camera**: Auto-focuses and centers on the current active milestone.

---

### 4. Step Registry & "Free Space" Extension Points

```typescript
export interface StepHandler<T = any> {
  render(step: T, props: StepRunnerProps): JSX.Element;
  validate(step: T, answer: any): boolean;
}
```

- **Core Handlers**:
  1. `choice`: Multiple-choice situational judgment.
  2. `assemble`: Word token arrangement (SERP Title construction).
  3. `match`: Pairing items (e.g. search query $\leftrightarrow$ intent).
  4. `number`: Numeric calculation (CTR formulas, traffic drop %).
- **Reserved Slots for Future SEO Tools**:
  - `serp-preview`, `robots-tester`, `audit-table`.

---

### 5. Unified Course Manifest

```json
{
  "id": "seo-fundamentals",
  "version": 2,
  "title": "Сходинки в SEO — Максимус и тайны поиска",
  "description": "Базовый курс по поисковой оптимизации",
  "board": {
    "theme": "custom-image",
    "background": "assets/images/map-background.png",
    "aspectRatio": "3/2"
  },
  "mentor": {
    "id": "maximus",
    "name": "Максимус",
    "title": "Куратор курса, системный блок",
    "avatar": "assets/images/maximus.png",
    "voice": {
      "greeting": "Ладно, начнём с того, как страницы попадают в поиск.",
      "completed": "Всё прошёл. Надо же."
    }
  },
  "missions": [],
  "sources": {},
  "glossary": []
}
```

---

## 4. Phased Implementation Roadmap

### Phase 1: Core Engine Architecture & Strategy Layer
1. Set up engine state machine and DAG unlock resolver.
2. Implement `StorageProvider` (Local / API strategies).
3. Implement `StepRegistry` with the 4 core step types.
4. Adapt the Roadmap Board to support both custom image backgrounds and procedural vector grids.
5. Validate full parity against the 17-mission reference course.

### Phase 2: Swappable Backend (FastAPI / Server Mode)
1. Lightweight Python backend with `uv` (`FastAPI` + `SQLite`).
2. Implement `ApiStrategy` for multi-device sync.

### Phase 3: Future Enhancements (Reserved)
1. Add new specialized SEO tools via the Step Registry.
2. Additional mentors and modular course authoring.
