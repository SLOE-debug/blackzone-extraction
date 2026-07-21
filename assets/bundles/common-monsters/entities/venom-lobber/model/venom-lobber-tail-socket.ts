/** Venom Lobber 尾刺蓄力点的局部领域坐标。 */
export const VENOM_LOBBER_TAIL_SOCKET = Object.freeze({
  forward: -4.72,
  lateral: 2.28,
});

/** 尾节动画绕身体后缘卷曲的局部前向支点。 */
export const VENOM_LOBBER_TAIL_PIVOT_FORWARD = -2.15;

/** 尾刺世界空间位置的可复用写入目标。 */
export interface MutableVenomLobberTailSocket {
  x: number;
  y: number;
}

/** 根据身体朝向、体型和卷尾程度原地计算蓄力点，避免高频创建向量。 */
export function writeVenomLobberTailSocket(
  output: MutableVenomLobberTailSocket,
  rootX: number,
  rootY: number,
  heading: number,
  scale: number,
  tailCharge: number,
): void {
  const curl = Math.max(0, Math.min(tailCharge, 1)) * 0.68;
  const cosineCurl = Math.cos(curl);
  const sineCurl = Math.sin(curl);
  const relativeX = VENOM_LOBBER_TAIL_SOCKET.forward
    - VENOM_LOBBER_TAIL_PIVOT_FORWARD;
  const localY = VENOM_LOBBER_TAIL_SOCKET.lateral;
  const curledX = VENOM_LOBBER_TAIL_PIVOT_FORWARD
    + relativeX * cosineCurl
    - localY * sineCurl;
  const curledY = relativeX * sineCurl + localY * cosineCurl;
  const cosineHeading = Math.cos(heading);
  const sineHeading = Math.sin(heading);
  output.x = rootX + (curledX * cosineHeading - curledY * sineHeading) * scale;
  output.y = rootY + (curledX * sineHeading + curledY * cosineHeading) * scale;
}
