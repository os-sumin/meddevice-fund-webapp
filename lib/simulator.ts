// fund-multiplier-simulator/scripts/simulate.py 의 TS 포팅.
// 계산 에이전트(kind: compute)는 모델을 부르지 않고 이 결정적 계산을 실행한다.
export type SimScenario = { name: string; private_multiple: number; first_loss_pct?: number };
export type SimConfig = {
  base: {
    gov_contribution: number;
    years: number;
    annual_gov_weights?: number[];
    death_valley_split?: Record<string, number>;
  };
  scenarios: SimScenario[];
};

function weights(base: SimConfig["base"]): number[] {
  const y = base.years;
  let w = base.annual_gov_weights ?? Array(y).fill(1 / y);
  if (w.length !== y) throw new Error(`annual_gov_weights 길이(${w.length}) != years(${y})`);
  const s = w.reduce((a, b) => a + b, 0);
  if (Math.abs(s - 1) > 1e-6) w = w.map((x) => x / s);
  return w;
}

export function simulate(config: SimConfig) {
  const base = config.base;
  const gov = base.gov_contribution;
  const w = weights(base);
  let dv = base.death_valley_split ?? { 임상: 0.4, 초기사업화: 0.6 };
  const dvSum = Object.values(dv).reduce((a, b) => a + b, 0);
  if (Math.abs(dvSum - 1) > 1e-6) {
    dv = Object.fromEntries(Object.entries(dv).map(([k, v]) => [k, v / dvSum]));
  }

  const rows = config.scenarios.map((sc) => {
    const pm = sc.private_multiple;
    const flp = sc.first_loss_pct ?? 0;
    const priv = gov * pm;
    const total = gov + priv;
    const multiplier = gov ? total / gov : 0;
    const firstLoss = gov * flp;
    const cover = firstLoss ? priv / firstLoss : null;
    const schedule = w.map((wt, i) => {
      const g = gov * wt;
      const p = g * pm;
      return { year: i + 1, gov: g, private: p, total: g + p };
    });
    const dvAlloc = Object.fromEntries(Object.entries(dv).map(([k, v]) => [k, total * v]));
    return {
      name: sc.name, gov, private: priv, total, multiplier,
      first_loss: firstLoss, first_loss_pct: flp, private_cover: cover,
      schedule, dv_alloc: dvAlloc,
    };
  });

  const summary = rows
    .map((r) => `${r.name}: 총 ${Math.round(r.total).toLocaleString()}억, 승수 ${r.multiplier.toFixed(2)}배, first-loss ${Math.round(r.first_loss).toLocaleString()}억`)
    .join("\n");

  return { summary, rows, sources: [] as string[] };
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  base: {
    gov_contribution: 1000,
    years: 5,
    annual_gov_weights: [0.3, 0.25, 0.2, 0.15, 0.1],
    death_valley_split: { 임상: 0.4, 초기사업화: 0.6 },
  },
  scenarios: [
    { name: "보수(매칭 1.5x)", private_multiple: 1.5, first_loss_pct: 0.2 },
    { name: "기본(매칭 2.0x)", private_multiple: 2.0, first_loss_pct: 0.3 },
    { name: "공격(매칭 3.0x)", private_multiple: 3.0, first_loss_pct: 0.4 },
  ],
};
