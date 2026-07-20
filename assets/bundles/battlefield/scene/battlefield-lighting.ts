/** 战场只使用半球环境光；交互提示由自发光几何承担，避免逐灯追加渲染 Pass。 */
export const BATTLEFIELD_LIGHTING = Object.freeze({
  ambientIlluminance: 2600,
  shadowsEnabled: false,
});
