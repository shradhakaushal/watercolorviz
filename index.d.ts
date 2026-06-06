// Type definitions for watercolorviz.
//
// Hand-authored to match src/index.js. Charts are constructed with
// `new Chart(target, config)` where target is a selector, a <canvas>, or a
// container element to append a canvas into.

export type Selector = string | HTMLCanvasElement | HTMLElement;
export type ColorString = string;

/** A d3-format specifier ("$,.0f", ".0%", "~s", ",") or a formatting function. */
export type TickFormat = string | ((value: number) => string);

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LegendItem {
  label: string;
  color: ColorString;
}

// --- Annotations (available on every chart via `annotations`) ----------------

export type AnnotationPoint = [number, number] | [string, string];

export interface AnnotationCommon {
  color?: ColorString;
  seed?: number;
}
export interface CircleAnnotation extends AnnotationCommon {
  type: 'circle';
  at: AnnotationPoint;
  atPx?: [number, number];
  r?: number;
}
export interface ArrowAnnotation extends AnnotationCommon {
  type: 'arrow';
  at: AnnotationPoint;
  to: AnnotationPoint;
}
export interface TextAnnotation extends AnnotationCommon {
  type: 'text';
  at: AnnotationPoint;
  text: string;
}
export interface CalloutAnnotation extends AnnotationCommon {
  type: 'callout';
  at: AnnotationPoint;
  to: AnnotationPoint;
  text: string;
}
export interface BandAnnotation extends AnnotationCommon {
  type: 'band';
  from: number | string;
  to: number | string;
  label?: string;
}
export interface BracketAnnotation extends AnnotationCommon {
  type: 'bracket';
  from: AnnotationPoint;
  to: AnnotationPoint;
  label?: string;
}
export type Annotation =
  | CircleAnnotation
  | ArrowAnnotation
  | TextAnnotation
  | CalloutAnnotation
  | BandAnnotation
  | BracketAnnotation;

// --- Shared config -----------------------------------------------------------

export interface BaseConfig {
  /** Fixed width in px, or '100%' to fit the host element (responsive). */
  width?: number | '100%';
  height?: number;
  responsive?: boolean;
  /** Height/width ratio used when responsive and no height is given (default 0.6). */
  aspect?: number;
  /** Device-pixel ratio override (defaults to the screen's, capped at 3). */
  dpr?: number;
  margin?: Partial<Margin>;
  /** Deterministic seed for the watercolor texture. */
  seed?: number;

  title?: string;
  xLabel?: string;
  yLabel?: string;

  /** A single colour paints every mark; `colors` cycles a palette per mark/series. */
  color?: ColorString;
  colors?: ColorString[];
  /** Colour of all axes, ticks, outlines and labels. */
  ink?: ColorString;
  /** Colour of the paper sheet. */
  paper?: ColorString;
  font?: string;

  // Interactivity
  interactive?: boolean;
  selection?: boolean;
  tooltip?: boolean;
  /** Keyboard navigation of marks (arrow keys). Default true. */
  keyboard?: boolean;
  /** Override the generated screen-reader summary. */
  ariaLabel?: string;

  // Animation
  animation?: boolean;
  animate?: boolean;
  animationDuration?: number;
  animationStagger?: number;
  animationDelay?: number;
  selectionSpeed?: number;

  // Annotations
  annotations?: Annotation[];
  annotationColor?: ColorString;
}

/** Axis spine + legend configuration shared by the cartesian charts. */
export interface AxisLegendConfig {
  axes?: boolean;
  xAxis?: boolean | { position?: 'bottom' | 'top' };
  yAxis?: boolean | { position?: 'left' | 'right' };
  axisArrows?: boolean;
  grid?: boolean;
  legend?: boolean | LegendItem[];
  legendOrientation?: 'horizontal' | 'vertical';
  legendGap?: number;
  legendX?: number;
  legendY?: number;
}

/** Scale type + tick formatting shared by the cartesian charts. */
export interface ScaleConfig {
  xScale?: 'linear' | 'log' | 'time';
  yScale?: 'linear' | 'log';
  xFormat?: TickFormat;
  yFormat?: TickFormat;
  xTicks?: number;
  /** d3 time-format string for time-axis tooltips. */
  timeFormat?: string;
}

type CartesianConfig = BaseConfig & AxisLegendConfig & ScaleConfig;

// --- Per-chart data + config -------------------------------------------------

export type SeriesInput = Record<string, number[]>;

export interface BarConfig extends CartesianConfig {
  data: {
    labels: Array<string | number>;
    values?: number[] | number[][];
    series?: SeriesInput;
    names?: string[];
  };
  horizontal?: boolean;
}

export interface LineConfig extends CartesianConfig {
  data: {
    x: Array<number | string | Date>;
    y?: number[] | number[][];
    series?: SeriesInput;
    names?: string[];
  };
  markers?: boolean;
  radius?: number;
  lineColor?: ColorString;
}

export interface AreaConfig extends CartesianConfig {
  data: { x: Array<number | string | Date>; y: number[] };
  intensity?: number;
}

export interface ScatterConfig extends CartesianConfig {
  data: { x: number[]; y: number[]; r?: number[] };
  radius?: number;
  maxRadius?: number;
}

export interface HistogramConfig extends BaseConfig, AxisLegendConfig {
  data: { values: number[] };
  bins?: number;
  xFormat?: TickFormat;
  yFormat?: TickFormat;
}

export interface HeatmapConfig extends BaseConfig {
  data: { xLabels: string[]; yLabels: string[]; values: number[][] };
}

export interface PieConfig extends BaseConfig {
  data: { labels: string[]; values: number[] };
  /** 0..1 of the radius → donut hole. */
  innerRadius?: number;
  percent?: boolean;
}

export interface RadarConfig extends BaseConfig {
  data: { axes: string[]; series: number[][] };
  max?: number;
  seriesNames?: string[];
}

export interface StackedAreaConfig extends CartesianConfig {
  data: { x: number[]; series: SeriesInput };
  stream?: boolean;
  maxSeries?: number;
  boundaryColor?: ColorString;
  boundaryWidth?: number;
  separator?: ColorString;
}

export interface RidgelineConfig extends BaseConfig {
  data: { labels: string[]; x: number[]; series: number[][] };
}

export interface NetworkNode {
  x: number;
  y: number;
  r?: number;
  color?: ColorString;
  label?: string;
}
export interface NetworkConfig extends BaseConfig {
  data: { nodes: NetworkNode[]; links: Array<[number, number]> };
  /** Treat node x/y as pixels rather than [0,1] fractions. */
  pixels?: boolean;
  radius?: number;
  edgeColor?: ColorString;
}

export interface SankeyLink {
  source: string | number;
  target: string | number;
  value: number;
}
export interface SankeyConfig extends BaseConfig {
  data: { nodes: Array<string | { name: string }>; links: SankeyLink[] };
  soft?: boolean;
  nodeWidth?: number;
  nodePadding?: number;
  linkColor?: ColorString;
}

export interface IntervalConfig extends CartesianConfig {
  data: { x: number[]; y: number[]; lo: number[]; hi: number[] };
}

export interface ForestStudy {
  name: string;
  est: number;
  lo: number;
  hi: number;
  weight?: number;
}
export interface ForestConfig extends BaseConfig {
  data: { studies: ForestStudy[]; summary?: { est: number; lo: number; hi: number } };
}

export interface LikertConfig extends BaseConfig {
  data: { questions: string[]; levels: string[]; values: number[][] };
}

export interface CalendarConfig extends BaseConfig {
  data: { values: Array<{ date: string | Date; value: number }> } | { dates: Array<string | Date>; values: number[] };
}

export interface ChordConfig extends BaseConfig {
  data: { names: string[]; matrix: number[][] };
}

export interface SparklineConfig extends BaseConfig {
  data: { values: number[] } | { y: number[] };
}

// --- Chart classes -----------------------------------------------------------

export class Chart {
  constructor(el: Selector, config?: BaseConfig);
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** Repaint the chart, annotations and tooltip. */
  draw(): void;
  /** Resize to new logical dimensions and repaint. */
  resize(width: number, height: number): void;
  /** Detach observers, listeners and pending animation frames. */
  destroy(): void;
  render(): void;
}

export class Bar extends Chart { constructor(el: Selector, config: BarConfig); }
export class Histogram extends Chart { constructor(el: Selector, config: HistogramConfig); }
export class Heatmap extends Chart { constructor(el: Selector, config: HeatmapConfig); }
export class Area extends Chart { constructor(el: Selector, config: AreaConfig); }
export class Ridgeline extends Chart { constructor(el: Selector, config: RidgelineConfig); }
export class StackedArea extends Chart { constructor(el: Selector, config: StackedAreaConfig); }
export class Scatter extends Chart { constructor(el: Selector, config: ScatterConfig); }
export class Pie extends Chart { constructor(el: Selector, config: PieConfig); }
export class Radar extends Chart { constructor(el: Selector, config: RadarConfig); }
export class Line extends Chart { constructor(el: Selector, config: LineConfig); }
export class Network extends Chart { constructor(el: Selector, config: NetworkConfig); }
export class Sankey extends Chart { constructor(el: Selector, config: SankeyConfig); }
export class Interval extends Chart { constructor(el: Selector, config: IntervalConfig); }
export class Sparkline extends Chart { constructor(el: Selector, config: SparklineConfig); }
export class Likert extends Chart { constructor(el: Selector, config: LikertConfig); }
export class Forest extends Chart { constructor(el: Selector, config: ForestConfig); }
export class Calendar extends Chart { constructor(el: Selector, config: CalendarConfig); }
export class Chord extends Chart { constructor(el: Selector, config: ChordConfig); }

// --- Scales ------------------------------------------------------------------

export interface BuiltScale {
  /** The underlying d3 scale (linear / log / time / point). */
  scale: (value: number | Date) => number;
  type: 'linear' | 'log' | 'time';
  ticks: number[];
  format: (value: number) => string;
}

export function buildScale(opts: {
  type?: 'linear' | 'log' | 'time';
  values?: Array<number | Date>;
  range: [number, number];
  includeZero?: boolean;
  nice?: boolean;
  tickCount?: number;
  format?: TickFormat;
}): BuiltScale;

export function tickFormat(format?: TickFormat): (value: number) => string;

// --- Palette -----------------------------------------------------------------

export const VIVID: ColorString[];
export const INK: ColorString;
export function colorAt(index: number): ColorString;
export function hexToRgb(hex: string): [number, number, number];
export function shades(hex: string, n: number): ColorString[];
export function diverging(n: number): ColorString[];
export function sequential(n: number): ColorString[];

// --- Low-level paint engine + helpers ---------------------------------------
// These draw directly on a 2D context; opts are passed through to the engine.

export type Point = [number, number];
export type PaintOptions = Record<string, unknown>;

export function paintPolygon(ctx: CanvasRenderingContext2D, points: Point[], opts?: PaintOptions): void;
export function regularPolygon(cx: number, cy: number, radius: number, sides?: number): Point[];
export function clearMarkCache(): void;
export function paintPaper(ctx: CanvasRenderingContext2D, width: number, height: number, opts?: PaintOptions): void;

export function inkLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, opts?: PaintOptions): void;
export function inkPath(ctx: CanvasRenderingContext2D, points: Point[], opts?: PaintOptions): void;
export function arrowhead(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, opts?: PaintOptions): void;
export function tick(ctx: CanvasRenderingContext2D, x: number, y: number, horizontal: boolean, opts?: PaintOptions): void;

export function rectPoints(x: number, y: number, w: number, h: number, perSide?: number): Point[];
export function areaPolygon(top: Point[], baseline: number): Point[];
export function bandPolygon(top: Point[], bottom: Point[]): Point[];
export function wedgePolygon(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, segs?: number): Point[];
export function paintRectWash(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, opts?: PaintOptions): void;
export function paintRectWashReveal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, opts?: PaintOptions): void;
export function paintRectSelection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, opts?: PaintOptions): void;
export function paintPolygonSelection(ctx: CanvasRenderingContext2D, points: Point[], opts?: PaintOptions): void;
export function withRevealClip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, progress: number, fn: () => void): void;
export function paintAreaWash(ctx: CanvasRenderingContext2D, top: Point[], baseline: number, opts?: PaintOptions): void;
export function paintBandWash(ctx: CanvasRenderingContext2D, top: Point[], bottom: Point[], opts?: PaintOptions): void;
export function paintWedge(ctx: CanvasRenderingContext2D, cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, opts?: PaintOptions): void;
export function paintClosedWash(ctx: CanvasRenderingContext2D, points: Point[], opts?: PaintOptions): void;
export function paintFillWash(ctx: CanvasRenderingContext2D, points: Point[], opts?: PaintOptions): void;
export function paintDot(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, opts?: PaintOptions): void;

// --- Annotation primitives (draw on any canvas) ------------------------------

export function annotateArrow(ctx: CanvasRenderingContext2D, from: Point, to: Point, opts?: PaintOptions): void;
export function annotateCircle(ctx: CanvasRenderingContext2D, at: Point, r: number, opts?: PaintOptions): void;
export function annotateText(ctx: CanvasRenderingContext2D, at: Point, text: string, opts?: PaintOptions): void;
export function annotateCallout(ctx: CanvasRenderingContext2D, at: Point, to: Point, text: string, opts?: PaintOptions): void;
export function annotateBand(ctx: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, opts?: PaintOptions): void;
export function annotateBracket(ctx: CanvasRenderingContext2D, from: Point, to: Point, opts?: PaintOptions): void;
