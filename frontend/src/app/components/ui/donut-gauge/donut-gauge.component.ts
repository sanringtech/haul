import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * 手畫的甜甜圈量表——單一數值（目前用量 %）的「快照」畫法，跟 sanring-line-chart（時間序列）
 * 是互補而非取代關係：折線圖回答「這條線的走勢」，這個回答「現在是多少」。同樣不用圖表庫，
 * 理由跟 line-chart 一樣（bundle 已經超過 budget，資料型態單純沒必要背依賴）。
 *
 * 只畫「已用」跟「未用」兩段弧——不是拿多個帳號的 % 拼成同一個圓餅（那樣切片加起來會是
 * 100%，會誤導使用者以為這些帳號共用同一份額度，但實際上每個帳號的用量 % 是各自獨立算的）。
 */
@Component({
  selector: 'sanring-donut-gauge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-block',
  },
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 100 100">
      <!-- 底層軌道：未用的部分，畫滿一整圈。 -->
      <circle cx="50" cy="50" [attr.r]="radius" fill="none" stroke="var(--sanring-border)" stroke-width="10" />
      <!-- 已用弧：從 12 點鐘方向（-90deg）順時針畫到對應百分比。stroke-dasharray 的第一個值是
           「畫出來」的弧長，第二個值補到圓周長讓沒畫到的部分變成間隙（也就是看不見），
           這是純 CSS/SVG 畫弧線比例最常見的手法，不用算圓弧的起訖座標。 -->
      <circle
        cx="50"
        cy="50"
        [attr.r]="radius"
        fill="none"
        [attr.stroke]="color()"
        stroke-width="10"
        stroke-linecap="round"
        transform="rotate(-90 50 50)"
        [attr.stroke-dasharray]="dashArray()"
      />
      <text x="50" y="50" text-anchor="middle" dominant-baseline="central" class="fill-[var(--sanring-fg)]" font-size="22" font-weight="600">
        {{ displayPercent() }}%
      </text>
    </svg>
  `,
})
export class DonutGaugeComponent {
  readonly percent = input.required<number>();
  readonly color = input.required<string>();
  readonly size = input(72);

  protected readonly radius = 42;
  private readonly circumference = 2 * Math.PI * this.radius;

  /** 中間文字容許顯示超過 100（例如已超額的來源），但弧線本身夾到 100，不然畫出來的弧長會
   *  超過一整圈，變成疊在自己身上，看起來反而像沒滿。 */
  protected readonly displayPercent = computed(() => Math.round(this.percent()));

  protected readonly dashArray = computed(() => {
    const clamped = Math.max(0, Math.min(100, this.percent()));
    const dash = (clamped / 100) * this.circumference;
    return `${dash} ${this.circumference}`;
  });
}
