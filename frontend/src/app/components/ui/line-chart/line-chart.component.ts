import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** One series' worth of (x, y) points — x 是時間戳（epoch ms），y 是百分比（0-100）。 */
export interface LineChartSeries {
  label: string;
  /** CSS 顏色（含 CSS var），直接塞進 SVG 的 stroke 屬性。同一個帳號的所有視窗共用同一個顏色——
   *  顏色代表「這是哪個帳號」，用 dashed 分辨「這是哪個視窗」，兩件事分開表達，不要混在一起用
   *  顏色數量去區分每一種帳號＋視窗組合，不然使用者看不出同帳號的兩條線其實是同一個帳號。 */
  color: string;
  /** true＝虛線（次要視窗，例如 Claude/Codex 的 7 天），false/undefined＝實線（主要視窗）。 */
  dashed?: boolean;
  points: { x: number; y: number }[];
}

/**
 * 手畫的輕量折線圖——不引入 Chart.js 之類的圖表庫，這個 app 的 bundle 已經超過
 * angular.json 設的 500kB 警告門檻（見 frontend/angular.json 的 budgets），資料型態
 * 又單純（就是時間 + 百分比），沒必要為了畫幾條線多背一顆依賴。
 *
 * 只負責畫圖，不做互動（沒有 hover tooltip/zoom）——這是刻意的第一版範圍，跟使用者
 * 討論過，之後真的需要再加。
 */
@Component({
  selector: 'sanring-line-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block w-full',
  },
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
      [attr.width]="width()"
      [attr.height]="height()"
      preserveAspectRatio="none"
      class="w-full h-auto"
    >
      <!-- y 軸參考線：0% / 50% / 100%，讓折線的高低有個對照基準，不用另外畫座標軸刻度數字。 -->
      @for (gridPercent of gridLines; track gridPercent) {
        <line
          x1="0"
          [attr.x2]="width()"
          [attr.y1]="yFor(gridPercent)"
          [attr.y2]="yFor(gridPercent)"
          stroke="var(--sanring-border)"
          stroke-width="1"
        />
      }

      @for (s of series(); track s.label) {
        <polyline
          [attr.points]="pointsFor(s)"
          fill="none"
          [attr.stroke]="s.color"
          [attr.stroke-dasharray]="s.dashed ? '4 3' : null"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      }
    </svg>
  `,
})
export class LineChartComponent {
  readonly series = input.required<LineChartSeries[]>();
  /** X 軸（時間）的資料範圍——所有 series 共用同一個時間刻度，不是各自的 min/max，
   *  不然點數少的 series 線段會被拉伸得跟點數多的一樣長，看起來像記錄頻率一樣密。 */
  readonly minX = input.required<number>();
  readonly maxX = input.required<number>();
  readonly width = input(320);
  readonly height = input(120);

  protected readonly gridLines = [0, 50, 100];

  protected yFor(percent: number): number {
    // SVG 的 y 軸原點在左上角、往下遞增——百分比 0 要畫在底部、100 在頂部，方向相反，
    // 所以要用高度減。
    return this.height() - (percent / 100) * this.height();
  }

  protected pointsFor(s: LineChartSeries): string {
    const range = this.maxX() - this.minX();
    return s.points
      .map((p) => {
        const x = range > 0 ? ((p.x - this.minX()) / range) * this.width() : 0;
        return `${x},${this.yFor(p.y)}`;
      })
      .join(' ');
  }
}
