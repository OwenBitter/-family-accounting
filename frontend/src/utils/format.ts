/** 千分位格式化 */
export const fmt = (v: number) => v.toLocaleString('zh-CN');

/** 金额格式化：¥ + 千分位（无小数） */
export const fmtMoney = (v: number) => `¥${fmt(v)}`;

/** 金额格式化：¥ + 千分位 + 2位小数 */
export const fmtMoney2 = (v: number) =>
  `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** 整数千分位（无符号） */
export const fmtNoDec = (v: number) => Number(v.toFixed(0)).toLocaleString();
