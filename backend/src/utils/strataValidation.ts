export interface DepthRange {
  depth_from_m: number;
  depth_to_m: number;
}

/**
 * ตรวจสอบว่าชั้นดิน/หินแต่ละช่วงมีความลึกที่ถูกต้อง ไม่เกินความลึกรวมของบ่อ
 * และไม่ทับซ้อนกับช่วงอื่นในรายการเดียวกัน (รวมชั้นที่มีอยู่แล้ว + ชั้นใหม่)
 */
export function validateStrataList(ranges: DepthRange[], totalDepthM: number | null | undefined): string | null {
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (!(r.depth_from_m >= 0) || !(r.depth_to_m > r.depth_from_m)) {
      return `ช่วงความลึก ${r.depth_from_m}-${r.depth_to_m} ม. ไม่ถูกต้อง`;
    }
    if (totalDepthM != null && totalDepthM > 0 && r.depth_to_m > totalDepthM) {
      return `ความลึกสิ้นสุด ${r.depth_to_m} ม. เกินความลึกรวมของบ่อ (${totalDepthM} ม.)`;
    }
    for (let j = 0; j < ranges.length; j++) {
      if (i === j) continue;
      const o = ranges[j];
      if (r.depth_from_m < o.depth_to_m && o.depth_from_m < r.depth_to_m) {
        return `ช่วงความลึก ${r.depth_from_m}-${r.depth_to_m} ม. ทับซ้อนกับช่วง ${o.depth_from_m}-${o.depth_to_m} ม. ที่มีอยู่แล้ว`;
      }
    }
  }
  return null;
}
