import { DEV } from 'cc/env';
import { LOBBY_OBSERVATION_SPIDER_CONFIG } from '../model/lobby-observation-spider-config';
import { type LobbyDebugControls } from './lobby-debug-controls';

const PANEL_ID = 'lobby-debug-panel';

/** 浏览器预览使用的轻量大厅调试面板。 */
export class LobbyDebugPanel {
  private root: HTMLElement | null = null;

  constructor(controls: LobbyDebugControls) {
    if (!DEV || typeof document === 'undefined') {
      return;
    }

    document.getElementById(PANEL_ID)?.remove();
    const snapshot = controls.getSnapshot();
    const root = document.createElement('section');
    root.id = PANEL_ID;
    applyPanelStyle(root);

    const header = document.createElement('button');
    header.type = 'button';
    header.textContent = '大厅调试 －';
    applyHeaderStyle(header);
    root.appendChild(header);

    const body = document.createElement('div');
    body.style.padding = '6px 10px 10px';
    root.appendChild(body);

    addNumberControl(body, '环境光', 0, 2000, 10, snapshot.ambientIlluminance, (value) => {
      controls.setAmbientIlluminance(value);
    });
    addColorControl(body, '天空环境色', snapshot.ambientSkyColor, (value) => {
      controls.setAmbientSkyColor(value);
    });
    addColorControl(body, '地面环境色', snapshot.ambientGroundColor, (value) => {
      controls.setAmbientGroundColor(value);
    });
    addBooleanControl(body, '轨道相机', snapshot.orbitCameraEnabled, (value) => {
      controls.setOrbitCameraEnabled(value);
    });
    addNumberControl(
      body,
      '蜘蛛大小',
      LOBBY_OBSERVATION_SPIDER_CONFIG.minimumScale,
      LOBBY_OBSERVATION_SPIDER_CONFIG.maximumScale,
      0.1,
      snapshot.observationSpiderScale,
      (value) => {
        controls.setObservationSpiderScale(value);
      },
    );
    addNumberControl(body, '主射灯流明', 0, 24000, 100, snapshot.keyLightFlux, (value) => {
      controls.setKeyLightFlux(value);
    });
    addNumberControl(body, '主射灯锥角', 15, 75, 1, snapshot.keyLightAngle, (value) => {
      controls.setKeyLightAngle(value);
    });
    addNumberControl(body, '主射灯范围', 1, 20, 0.1, snapshot.keyLightRange, (value) => {
      controls.setKeyLightRange(value);
    });
    addNumberControl(
      body,
      '边缘衰减',
      0,
      1,
      0.01,
      snapshot.keyLightAttenuation,
      (value) => {
        controls.setKeyLightAttenuation(value);
      },
    );
    addBooleanControl(body, '主射灯启用', snapshot.keyLightEnabled, (value) => {
      controls.setKeyLightEnabled(value);
    });
    addBooleanControl(body, '实时阴影', snapshot.keyLightShadowEnabled, (value) => {
      controls.setKeyLightShadowEnabled(value);
    });

    header.addEventListener('click', () => {
      body.hidden = !body.hidden;
      header.textContent = body.hidden ? '大厅调试 ＋' : '大厅调试 －';
    });

    document.body.appendChild(root);
    this.root = root;
  }

  /** 从浏览器页面移除调试面板。 */
  public dispose(): void {
    this.root?.remove();
    this.root = null;
  }
}

/** 创建布尔开关。 */
function addBooleanControl(
  parent: HTMLElement,
  label: string,
  initialValue: boolean,
  onChange: (value: boolean) => void,
): void {
  const row = createRow(label);
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = initialValue;
  input.style.width = '18px';
  input.style.height = '18px';
  input.style.accentColor = '#d63b4d';
  input.addEventListener('change', () => onChange(input.checked));
  row.appendChild(input);
  parent.appendChild(row);
}

/** 创建带实时数值显示的滑杆。 */
function addNumberControl(
  parent: HTMLElement,
  label: string,
  min: number,
  max: number,
  step: number,
  initialValue: number,
  onChange: (value: number) => void,
): void {
  const row = createRow(label);
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(initialValue);
  input.style.flex = '1';
  input.style.accentColor = '#d63b4d';

  const output = document.createElement('output');
  output.textContent = formatNumber(initialValue, step);
  output.style.width = '58px';
  output.style.textAlign = 'right';
  output.style.color = '#f2c8cd';

  input.addEventListener('input', () => {
    const value = Number(input.value);
    output.textContent = formatNumber(value, step);
    onChange(value);
  });

  row.append(input, output);
  parent.appendChild(row);
}

/** 创建浏览器原生颜色选择器。 */
function addColorControl(
  parent: HTMLElement,
  label: string,
  initialValue: string,
  onChange: (value: string) => void,
): void {
  const row = createRow(label);
  const input = document.createElement('input');
  input.type = 'color';
  input.value = initialValue;
  input.style.width = '82px';
  input.style.height = '22px';
  input.style.padding = '0';
  input.style.border = '1px solid #555';
  input.style.background = 'transparent';
  input.addEventListener('input', () => onChange(input.value));
  row.appendChild(input);
  parent.appendChild(row);
}

/** 创建统一标签与控件布局。 */
function createRow(label: string): HTMLLabelElement {
  const row = document.createElement('label');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '8px';
  row.style.minHeight = '28px';
  row.style.fontSize = '12px';

  const text = document.createElement('span');
  text.textContent = label;
  text.style.width = '82px';
  text.style.flex = '0 0 auto';
  text.style.color = '#e8e8e8';
  row.appendChild(text);
  return row;
}

/** 设置调试面板容器样式。 */
function applyPanelStyle(root: HTMLElement): void {
  Object.assign(root.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    zIndex: '2147483647',
    width: '290px',
    color: '#fff',
    background: 'rgba(22, 22, 24, 0.94)',
    border: '1px solid rgba(255, 255, 255, 0.16)',
    borderRadius: '4px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.42)',
    fontFamily: 'Arial, Microsoft YaHei, sans-serif',
    userSelect: 'none',
  });
}

/** 设置折叠标题按钮样式。 */
function applyHeaderStyle(header: HTMLButtonElement): void {
  Object.assign(header.style, {
    width: '100%',
    padding: '8px 10px',
    color: '#fff',
    background: '#a51f32',
    border: '0',
    borderRadius: '3px 3px 0 0',
    textAlign: 'left',
    fontWeight: '700',
    cursor: 'pointer',
  });
}

/** 根据滑杆精度格式化实时数值。 */
function formatNumber(value: number, step: number): string {
  return step < 1 ? value.toFixed(2) : String(Math.round(value));
}
